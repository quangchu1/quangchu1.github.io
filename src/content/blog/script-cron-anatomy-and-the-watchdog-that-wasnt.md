---
title: 'Anatomy of a Script Cron, and the Watchdog That Was Not One'
description: 'A scheduled function is not a scheduled program. What the generated harness actually runs, why three timeouts disagree, and why calling the fix a watchdog was the wrong word.'
pubDate: 'Sep 13 2026'
heroImage: '../../assets/blog-placeholder-5.jpg'
---

*Tóm tắt: bài này là phần đi kèm của [bài trước](/blog/stale-tmpdir-cron-scratch-sweep-race/) — chỗ đó mổ một cái race, chỗ này ghi lại **cơ chế và thuật ngữ** học được khi truy nó. Một cron "chạy một hàm Python" thực ra không chạy hàm đó trực tiếp: nó sinh một harness dùng-một-lần, harness đó nạp file của bạn như **dữ liệu** rồi dịch exception thành verdict trên stdout. Trên đường đi có ba loại timeout mà một cái là vô tác dụng, một sandbox cố tình che đúng thứ mình muốn đọc, một lệnh preview không phản ánh đường chạy thật, và một chữ tôi đã dùng sai: cái tôi gọi là "watchdog" thực ra là reconciler — mà chính con bug lại sinh ra từ việc áp tư duy watchdog vào chỗ nó không đúng.*

---

## A scheduled function is not a scheduled program

The unit registered with the scheduler was `some_file.py:some_function`. Not a
command, not a script — a **function inside a module**. That single fact generates
most of the machinery below, and it took a failure to see why.

Something has to import the module, construct a context object, call the function,
and turn whatever the function does into a result the scheduler can store. That
"something" is generated fresh on every fire, written to a temp file, executed, and
deleted in a `finally`. It is a **harness**, and the interesting property is that it
contains none of your logic.

Three shapes of scheduled job existed, and they differ in exactly what gets run:

| | agent job | **script job** | command job |
|---|---|---|---|
| Unit of work | one LLM turn | **a Python function** | a shell line |
| Token cost | yes | **none** | none |
| Gets a context object | — | **yes** | no |
| Inherits the browser session | yes | no | no |

That last row is not trivia. A job that has to drive a logged-in browser only works
as an *agent* job, because the browser session id lives in the agent process's
environment and a child inherits it. Converting such a job to a script job to save
tokens silently breaks it. The reverse also bites: on the host in question, command
jobs refuse to start at all — *"No POSIX shell available"* — even though `/bin/sh`
plainly exists, which quietly removes an entire escape hatch (more on that at the
end).

## The components

```
① job store (JSON)          id · schedule · script spec · message
                            last_status · last_error · last_run_ts
                                  │
② scheduler loop            matches the cron expression in
                            job.timezone || global.timezone || UTC
                            "strict schedule" = skip the jitter
                                  │ fire
                                  ▼
③ runner                    does NOT run your code. It BUILDS:
                              • generates harness source
                              • mkstemp harness .py into $TMPDIR   <-- the race
                              • mkstemp a 0600 secret file
                              • resolves the callback port ONCE
                              • copies its own env minus a deny-set
                                  │ spawn
                                  ▼
④ sandbox wrapper           masks some paths, exposes others
                                  │
                                  ▼
⑤ harness process           python -I <throwaway>.py
                                  │
                                  ▼
⑥ your module               loaded and exec'd BY the harness
                                  │
                                  ▼
⑦ stdout JSON               the contract: {"status": …}
                                  │
                                  ▼
⑧ runner records            history row + job store update
                            finally: unlink harness + secret
```

## What the harness actually runs

Four steps, in this order:

```
1. CLEAN sys.path
   sys.path[:] = [p for p in sys.path if p not in ('', sys.path[0])]
   so a stray json.py or os.py in the shared temp dir cannot
   shadow the standard library before step 2 imports anything

2. BOOT the platform
   boot_platform(Config.load())
   import the context class and the control-flow exceptions

3. LOAD your module — this is where your file enters
   sys.path.insert(0, <dir of your script>)
   mod = types.ModuleType('_cron_script')
   _src = open('<real path to your file>', 'rb').read()
   exec(compile(_src, '<real path to your file>', 'exec'), mod.__dict__)
   fn = getattr(mod, '<your function name>')

4. CALL and TRANSLATE
   ctx = ScriptContext(job=SimpleNamespace(id=…, message=…))
   try:    fn(ctx)      -> print {"status": "ok"}
   except Skip          -> print {"status": "skip"}
   except Done   as d   -> print {"status": "done",   "message": d.message}
   except Report as r   -> print {"status": "report", "message": r.message}
   except Exception     -> print {"status": "error",  "error": str(e)}
```

Three details in there are worth more than the outline.

**`compile(_src, '<real path>')` keeps the original filename.** Without it every
traceback would point at a temp file that has already been deleted. The harness is
disposable; the identity in the traceback is not.

**Step 3 inserts *the directory of your script* at the front of `sys.path`.** That
one line is why a script in that directory can `from sibling import helper` — sibling
imports are a supported consequence of the harness design, not luck. But when a job
carries operator-granted secrets, that same variable is overwritten with an **empty
private directory**, deliberately: a script trusted with secrets must not be able to
import from a directory an agent can write to. So a sibling import is safe to use and
unsafe to *depend* on — the honest pattern is a `try`/`except` around it with a local
fallback, which costs four lines and removes a whole failure mode.

**`raise Report(...)` is not an error.** It means "I finished; here is the verdict to
record". A plain `return` records success. This is why a well-behaved periodic job is
*silent* on the happy path and only speaks when something is worth a human's
attention — and, as the companion post shows, why that silence later got mistaken for
death.

## Three timeouts, and one of them does nothing

| Field | Enforced by | Bounds |
|---|---|---|
| job-level `timeout` | nobody at fire time | **inert** — only read on an update path |
| runner deadline | the runner | the whole wake |
| an inner `timeout` in the job's message | your own code | the subprocess *you* spawn |

The inert one is the trap. It has the most obvious name, it appears in the job record,
and setting it feels like configuring the thing you meant to configure. Raising it
changes nothing. The lesson generalises past this codebase: **when a config field
does not change behaviour, grep for its reader before believing it.** A field that is
only ever serialised back out is decoration.

## The sandbox: what is hidden is a decision, not an obstacle

The harness runs inside a sandbox that masks some paths and exposes others. Both
lists are curated with stated reasons. Two entries mattered:

- The **run-history directory is masked.** Its rationale, written in the source: the
  authorisation model is "a session reaches only its own", enforced at the HTTP layer,
  so masking the directory closes the sideways path without breaking any legitimate
  reader — every legitimate reader goes through the gateway.
- The **job store JSON is exposed**, explicitly, because the in-sandbox service reads
  and rewrites it.

I wrote the first version of a mitigation that read the run-history files. It worked
in testing and failed on its first real fire with `Operation not permitted`. The
correct response to that was not a workaround. It was to notice that the job store —
already exposed, and carrying `last_status`, `last_error`, `last_run_ts` — held
everything the mitigation needed. **A deliberate block with a documented rationale is
a design boundary; routing around it is how you turn a security control into a bug
report.** The rewrite lost nothing: the store keeps the latest run per job, which is
precisely the run a rescue cares about.

## Why the mitigation tested green and then failed

The dry-run command is documented as running **in-process and not sandboxed**, for
debuggability. So it skipped step ④ entirely. My matcher tests passed, the dry run
passed, and the first live fire died on a path the dry run never touched.

That is a general shape worth naming: **a debug harness that removes a layer is not a
test of the path that includes it.** If a mechanism has a sandbox, an approval gate,
or a different identity in production, a convenience runner that bypasses any of them
proves only that your logic parses. Verification has to touch the real path once —
and the second thing I did was force exactly that, which is when the truth arrived in
eleven words.

## "Watchdog" — where the word comes from, and why I used it wrong

The term is not a metaphor invented for software. A **watchdog timer** is hardware: a
counter running independently of the CPU. Firmware must periodically reset it — the
action is called **kicking** (or *petting*, *feeding the dog*). If the firmware hangs
it stops kicking, the counter overflows, and the hardware forces a reset.

Two properties define it:

1. It does not check whether you are doing the *right* thing. It checks only whether
   you are **still signalling**.
2. It lives **outside** what it watches, because a mechanism inside the hung process
   hangs with it.

The idea surfaces as real interfaces: on Linux you open `/dev/watchdog` and write to
it periodically; stop, and the machine reboots. A service manager can require a
liveness notification within an interval and restart the service otherwise. (An
unrelated Python package also called `watchdog` monitors filesystem events — same
word, different concept, and the usual first search result.)

Now the correction. What I proposed and built is **not** a watchdog. A watchdog is
*passive*: it waits to be kicked and acts on silence. My thing **actively polls and
repairs**. The accurate word is **reconciler** — the controller pattern of comparing
observed state against desired state and closing the gap — or *self-healing loop*, or
plainly *janitor*. I had used "watchdog" in the loose colloquial sense of "a small
background job that keeps an eye on something", which is common and imprecise.

The correction is worth more than pedantry, because of the irony underneath it. **The
component that deleted the directory was itself applying watchdog logic** — silence
means death — **to a population where the assumption is false.** A once-a-day job
that touches its scratch directory for two seconds and cleans up after itself is
*silent because it is healthy*. There was no kick, and nothing had ever asked it for
one. Getting the vocabulary right is what made the design error visible: the guard
needed a liveness *signal*, and instead it inferred liveness from *noise*.

## What a rescue loop can and cannot promise

The mitigation re-triggers an affected job once per failed run. Its honest properties:

- **Narrow matching.** Three independent markers must all be present before anything
  is re-triggered. A false positive would put a genuinely broken job into a retry
  loop — strictly worse than the bug it treats.
- **Two independent brakes.** One retry per failed run, plus a per-job daily cap. On
  hitting the cap it escalates to a human instead of going quiet, because "the same
  job keeps dying" is a different problem from "a directory got swept once".
- **It reports where the human already looks.** The rescue notice goes to the
  destination the *rescued* job reports to, read from that job's own config — not to
  a new channel nobody watches.
- **It is a victim of the same bug.** The rescue runs as a script job, through the
  same harness path, so it can fail in the same window. A command job would dodge the
  mechanism by construction — no temp file at all — but command jobs do not start on
  this host, so that escape hatch is theoretical. Stating this limitation is part of
  the deliverable; a mitigation whose failure mode you have not named is not a
  mitigation, it is a hope.

## Vocabulary, collected

| Term | What it actually means here |
|---|---|
| **harness / launcher** | generated per-run glue that turns a *function* into a *process with a verdict on stdout*; holds no logic of its own |
| **kick / pet** | resetting a watchdog counter to signal liveness |
| **watchdog** | passive, external, acts on **silence** |
| **reconciler** | active, compares observed vs desired state and closes the gap |
| **TOCTOU** | time-of-check to time-of-use: the window where a verified pathname can be swapped before it is executed |
| **duty cycle** | fraction of time a job is actually doing something; a low duty cycle is what *correct* periodic work looks like |
| **fail closed / fail loud** | on an inconclusive probe, refuse rather than assume success; and make the refusal visible |
| **inert config** | a field that is stored and serialised but never read by the code path it appears to configure |

## The checklist

- **Find out what actually executes your code.** "It runs my script" and "it generates
  a harness that loads my script" lead to different debugging in the same way that a
  temp file and a temp *directory* lead to different fixes.
- **Before trusting a config field, grep for its reader.** Inert fields look exactly
  like working ones.
- **A dry-run that removes the sandbox is not a test of the sandboxed path.** Touch
  the real path once before claiming it works.
- **When a platform hides something on purpose, read the rationale before routing
  around it.** The sanctioned source was better than the one I first reached for.
- **Get the word right.** "Watchdog" versus "reconciler" is not style — one waits for
  a signal and one goes looking, and mislabelling which you have is how a liveness
  proxy gets applied to work that is legitimately quiet.
