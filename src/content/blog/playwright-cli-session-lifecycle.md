---
title: 'The 190 MB Ghost: playwright-cli Session Lifecycle, Naming, and Detach'
description: 'Dropping a browser binding is not reaping the daemon. How automation sessions get named, where their state lives on disk, and how to find orphans when ps is denied.'
pubDate: 'Sep 10 2026'
heroImage: '../../assets/blog-placeholder-2.jpg'
---

*Tóm tắt: mất binding tới browser **không** phải là đã dọn daemon. Mỗi lần `attach` để lại một process `cliDaemon.js` ~190 MB giữ một cổng loopback, và nó **không** tự chết khi script thoát. Bài này ghi lại cách session được đặt tên, state nằm ở đâu trên đĩa, cách detach cho đúng, và cách tìm daemon mồ côi khi `ps` bị sandbox chặn.*

---

## The bug that looked like nothing

A daily automation job drove a real logged-in Chrome through `playwright-cli attach`,
scraped two pages, printed a verdict, exited 0. Clean, for months.

Then a stray process turned up:

```
PID 80837  PPID 1  node cliDaemon.js kc-a7942d05 --browser=chrome --extension
STARTED 10:32:52   RSS 191 MB   ELAPSED 06:48:54   LISTEN 127.0.0.1:55551
```

Six hours and forty-eight minutes old, parented to `init`, holding 191 MB and a
loopback port. Its start time landed inside that morning's job window. One per
day, until reboot.

The script had no cleanup at all — no `detach`, no `tab-close`, no `finally`.
Nobody noticed because the job kept exiting 0.

## Two layers, and the mistake of measuring the wrong one

This is the distinction that matters, and it is easy to get wrong:

```
attach --extension=chrome
   │
   ├─► BINDING  (session ↔ the real browser)
   │      drops when the process holding it exits
   │      check: playwright-cli list / tab-list
   │
   └─► PROCESS  node cliDaemon.js <session> --browser=chrome --extension
          does NOT die on its own, ~190 MB RSS, holds a loopback port
          check: pgrep -lf /cliDaemon.js
```

I originally concluded "the session releases itself when the process exits" from a
single `tab-list` returning *not open*. That reading is true — of the **binding**.
The daemon was alive the whole time, in a different layer, and `tab-list` says
nothing about it.

Worse, once a daemon is **orphaned** the graceful path no longer works:

```
$ PLAYWRIGHT_CLI_SESSION=kc-a7942d05 playwright-cli detach
Browser 'kc-a7942d05' is not attached.
$ ps -p 80837          # still alive, still 191 MB
```

`detach` needs the binding to exist in order to release it. Once the process that
attached has exited, there is nothing left for `detach` to grab — only `SIGTERM`
reaps it. So `detach` **must** run while your process is still alive. That is not
a nicety; it is the only window you get.

## How sessions get named

Three code paths, and only one of them was broken:

```
                    gateway (backend process)
                    env: NO PLAYWRIGHT_CLI_SESSION
                              │
        ┌─────────────────────┼──────────────────────────┐
        │                     │                          │
   AGENT PATH            AGENT CRON                 SCRIPT CRON
   (interactive chat)    (LLM-dispatched job)       (zero-token subprocess)
        │                     │                          │
        ▼                     ▼                          ▼
  session env helper     same helper                subprocess inherits
  generates a name       generates a name           the gateway env
        │                     │                     → variable EMPTY  ✗
        ▼                     ▼                          │
  kc-<uuid4 hex[:8]>    kc-<uuid4 hex[:8]>              ▼
  e.g. kc-e7f1f092      e.g. kc-a7942d05        attach names the session
  NEW per PROCESS       NEW per RUN             after the BROWSER: "chrome"
        │                     │                 bare verbs look for "default"
        │                     │                 → rc=1 "not open"  ✗
        │                     │                          │
        │                     │                 FIX: env.setdefault(
        │                     │                   'PLAYWRIGHT_CLI_SESSION',
        │                     │                   '<one fixed name per job>')
        └─────────────────────┴──────────────────────────┘
                              │
              socket + registry dirs are derived from
              leaf = name with the "kc-" prefix stripped
                              ▼
        <state>/pw/<leaf>/s   ← socket dir
        <state>/pw/<leaf>/d   ← registry dir
                                 └─ <hash>/<session>.session
                                    { name, timestamp, attached, socketPath }
```

Three consequences worth internalizing:

**The `kc-` prefix is reserved.** The generator regenerates any inherited value
that already starts with `kc-`, so a gateway launched from inside an agent process
cannot push its own name down into every session it hosts. An operator who wants a
fixed shared name must pick something else — which conveniently means a cleanup
tool can treat non-`kc-` names as "someone chose this deliberately, leave it alone".

**Random-per-run names are a liability in automation.** If a run dies without
detaching, nothing can ever reclaim that session — the name is gone with the
process. A **fixed name per job** means the job's next run re-attaches to the same
name instead of leaving a graveyard.

**Moving a job from the agent path to a plain subprocess silently drops env.** The
agent process gets variables injected; a subprocess inherits only what the backend
has, which is nothing. The failure is deterministic — it reproduced in under a
second — but it *looks* transient because every manual test passes: a hand-typed
command runs through the agent path, which has the env. Testing the wrong
environment is how this survives review. Diff the two envs before you migrate,
not after.

## The cleanup contract

```python
def cleanup(keep_tab=False):
    """Undo this run's browser side effects. Never raises, never masks the verdict."""
    try:
        if _OUR_TAB and not keep_tab:
            pw("tab-close", timeout=60)      # BEFORE detach
        if _WE_ATTACHED:
            pw("detach", timeout=60)         # reaps the daemon process
    except Exception as exc:
        print(f"warning: cleanup failed: {exc}", file=sys.stderr)

try:
    run()
except CouldNotRun as exc:
    ...
    return 2
finally:
    cleanup()          # in finally: the could-not-run path also attached
```

Four rules earned the hard way:

1. **`tab-close` before `detach`.** After detaching there is no browser left to
   close a tab on.
2. **`finally`, not the end of the happy path.** A run that bailed out early still
   attached and still opened a tab, so it leaks identically.
3. **Only undo what *this* run did.** Track `_WE_ATTACHED` / `_OUR_TAB`. A script
   invoked inside an already-attached session must not detach a browser someone
   else is using.
4. **Cleanup must never raise.** Swallow and warn; the run's verdict is what the
   caller branches on.

And one adjacent trap: open pages with `tab-new`, not `goto`. `goto` navigates
whatever tab the human was looking at. Also never hand a caller the raw output of
`tab-new` / `tab-list` — that output is the whole tab list, and tab 0 is usually
the extension relay whose URL carries the extension **token**. A "did we land on
the right page" check built on grepping that output is both wrong (any tab with a
matching title passes) and a credential-leak footgun. Check the page snapshot
instead.

## When `ps` is denied — and why that is correct

`finally` cannot run when a process is `SIGKILL`ed: a job timeout, an OOM, a
crash. So a nightly sweeper is a reasonable backstop. My first version found
orphans by scanning every process's environment for the session variable:

```
error (exit 2): COULD NOT RUN: ps -A -o pid=,etime=,command= failed:
[Errno 1] Operation not permitted: 'ps'
```

Probing inside the real job environment showed why:

| Probe | Result |
|---|---|
| `ps` (via PATH) | `PermissionError [Errno 1] Operation not permitted` |
| `/bin/ps` (absolute) | same denial — it is not a PATH problem |
| `/bin/echo` | rc=0 |
| `/usr/bin/pgrep` | rc=1 (no match) — allowed |
| `os.kill`, file reads | allowed (no exec at all) |

The sandbox denies `ps` specifically, and it is **right** to: `ps eww` prints the
environment of every process you own — which means every token any of them holds.
I could have reproduced the same read with `ctypes` and `sysctl KERN_PROCARGS2`.
That would be the same operation on the same data, with the control stepped
around rather than satisfied. The correct response to a security control you
tripped is to redesign the approach, not to re-implement it under a different
syscall.

## Detecting orphans without reading anyone's environment

The state on disk turns out to be a better source than the process table:

```json
{
  "name": "kc-a7942d05",
  "timestamp": 1789037648657,
  "socketPath": ".../pw/e7f1f092/s/cli/91238f9996cd4d46-kc-a7942d05.sock",
  "attached": true
}
```

So: `pgrep -lf /cliDaemon.js` for `(pid, session)`, the registry file for age via
`timestamp`, `os.kill(pid, 0)` for liveness, then graceful `detach` and `SIGTERM`
as fallback — never `SIGKILL`. No exec beyond `pgrep`, and nothing read about any
other process.

Two traps cost real debugging time here, and both produced a sweeper that was one
gate away from doing damage:

**A substring test for the daemon is far too loose.** Matching
`endswith("cliDaemon.js")` on any argv token also matched a sibling
`pgrep -fl cliDaemon` — and then the `/bin/zsh -c <script>` running my own tests,
because the script text contains the string. Both were reported as daemons with a
session name of `"|"`. Require `argv[0]` to be a `node` binary **and** a token
that is a path ending in `/cliDaemon.js`.

**Never derive a session's socket directory from its name.** A child process that
inherits the socket-dir variable registers its *own* name inside *another*
session's leaf directory. Point at the wrong registry and a perfectly live session
answers `(no browsers)` — a false orphan, and a sweeper that believes it will kill
live work. Take the directory from where the registry record actually sits.

There is also a satisfying reason an env-based owner scan can never work, quite
apart from the sandbox: **the daemon inherits the session variable from the CLI
that spawned it.** So it shows up in the scan vouching for itself, and nothing is
ever eligible for reaping.

## The checklist

- `detach` reaps the daemon **process**; losing the binding does not. Different layers.
- `detach` only works while the attaching process is alive. After that: `SIGTERM`.
- Run cleanup in `finally`, `tab-close` before `detach`, undo only your own side effects.
- Pin one fixed session name **per job** in unattended code; never a fresh name per run.
- Diff the environment before moving a job between execution paths.
- Open pages with `tab-new`; never print raw `tab-list` / `tab-new` output.
- A denied `ps` is a design signal, not an obstacle to route around.
- Verify with a real run. A clean compile proves nothing; every finding above came
  from watching the process table before and after.
