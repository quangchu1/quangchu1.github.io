---
title: 'Two Correct Guards, One Deleted Directory: A Stale TMPDIR Race in Cron Scratch Reclamation'
description: 'A daily cron died at mkstemp because the TMPDIR baked into its parent had been reclaimed. Both liveness guards were individually right and jointly wrong.'
pubDate: 'Sep 13 2026'
heroImage: '../../assets/blog-placeholder-3.jpg'
---

*Tóm tắt: một cron job chạy hằng ngày đột nhiên fail ở bước tạo file tạm, vì `TMPDIR` mà process cha mang theo từ lúc spawn đã bị một cơ chế dọn rác xoá đi. Cơ chế đó có hai điều kiện bảo vệ, và **cả hai đều đúng khi xét riêng lẻ** — nhưng ghép lại thì chúng kết luận sai về một process vẫn còn sống. Bài này lần theo dấu vết từ dòng lỗi tới đúng hai dòng code cần sửa, và rút ra một điều tổng quát hơn: khi bạn dùng "im lặng" làm proxy cho "đã chết", bạn đang trừng phạt đúng những workload hoạt động chính xác nhưng ít ồn ào.*

---

## The error that named its own cause

A daily drift-check cron had been green for five consecutive days. Then:

```
[Errno 2] No such file or directory:
  '/Users/…/scratch/runtime-4ccf0deb/kirocrew_cron_xr3c7sap.py'
```

Two things about that string are worth more than the rest of the investigation.

First, the file it cannot find is one the runner is trying to **create**, not read. `mkstemp` raising `FileNotFoundError` does not mean the file vanished — it means the *parent directory* does not exist.

Second, the job history showed the same failure twice, 74 minutes apart:

```
08:30  FAIL   …/runtime-4ccf0deb/kirocrew_cron_xr3c7sap.py
09:44  FAIL   …/runtime-4ccf0deb/kirocrew_cron_ly3zrnh9.py
```

The random suffix changed. The parent directory did not. A value regenerated per run, under a parent that is frozen — that is the signature of a cached path, and it turns "why did this break" into "who is holding that stale value, and who deleted the directory underneath them".

## Why a periodic job generates a throwaway launcher at all

Before chasing the race, the design question deserves a straight answer, because "a cron job that writes a temp Python file every time it runs" sounds like something you would cache once and reuse.

You cannot, for three reasons.

**The registered unit is a function, not a program.** The job points at `run_and_report.py:run`. Something has to import the module, construct a context object, call the function, and translate the control-flow exceptions (`Skip` / `Done` / `Report`) into JSON on stdout. The generated launcher *is* that adapter.

**The launcher embeds per-run values.** Job id, the job message, the path of a `0600` secret file, granted env-key names, and a dial port resolved exactly once per run. The code is explicit that resolving that port twice would pair a credential with the wrong port and get the callback rejected with a 403. A cached launcher pins a stale port and a secret path that has already been unlinked.

**It is a TOCTOU boundary.** The scripts directory is writable by the agent by design. For runs that carry operator-granted secrets, the verified script body travels over **stdin** and is `exec`'d directly, so there is no pathname anyone could swap between the moment the body is verified and the moment it runs. The generated launcher is what makes "verify these bytes, then execute *these* bytes" expressible at all. Its prelude also strips `sys.path[0]`, so a stray `json.py` sitting in a shared temp directory cannot shadow the standard library out from under the harness.

And it is cleaned up immediately: a `finally` unlinks both the launcher and the secret file. The launcher exists for exactly the duration of one fire.

So the wrapper is an adapter plus a security boundary. Nothing about it is lazy. The defect is not that it exists — it is **where it gets written**.

## Where TMPDIR comes from, and who never re-checks it

Three facts, each one line of code, compose into the bug:

1. The launcher is created with `mkstemp(prefix="kirocrew_cron_", suffix=".py", dir=None)`. `dir=None` means *use `TMPDIR`*.
2. The child's environment is built by copying the runner process's own `os.environ` minus a deny-set. `TMPDIR` is **not** in that deny-set, so it is inherited verbatim.
3. The runner process got its `TMPDIR` **once, at spawn**, from a per-session scratch allocator that mints a fresh `scratch/runtime-XXXXXXXX/` directory and exports it as `TMPDIR` / `TMP` / `TEMP`.

Nothing in that chain ever asks whether the directory still exists. An environment variable is a snapshot taken at `execve`; the kernel will happily hand you a path to something that was deleted an hour ago.

## The sweep, and its two guards

The scratch directories are reclaimed by a periodic sweep — an async task in the gateway that sleeps an hour, then scans, forever. It deletes a directory only when **both** conditions hold:

- **Idle:** the newest mtime anywhere in the tree is older than one hour.
- **Owner dead:** the pid recorded in the directory's owner file has no surviving **process group**.

The sweep is written defensively and says so in its own comments: a directory with no owner record is never deleted, a garbled owner file is left for a human, and a dead owner with a fresh mtime is *kept* because descendants can outlive the launcher while still writing.

The owner pid is recorded right after spawn, and spawning uses `start_new_session=True`, so the recorded pid **is** the process-group id. Probing the group rather than the pid is deliberate: a live child holding an open file descriptor produces no mtime evidence at all, but the group probe still sees it.

That is careful engineering. It is also, in one specific shape, wrong.

## The race

```
T0    owner runtime P starts
      ├─ allocate scratch dir D
      ├─ record_owner(D, P)          .owner = P
      └─ spawn descendant R with start_new_session=True
            R inherits TMPDIR=D
            R LEAVES process group P            <-- the crack

T1    owner P exits
      pgid P is gone.  R is alive.  .owner still says P.

Day 1 08:30   job fires inside R
              mkstemp -> D/kirocrew_cron_*.py   OK
              finally: unlink launcher
              from here NOTHING writes into D again
              (one cron per day is the only user of this dir)

Day 1 ~09:30  sweep tick
              idle >= 3600s          ✓  (nothing has written for an hour)
              pgroup_alive(P)        ✗  (P died at T1)
              --> rmtree(D)                     💥

Day 2 08:30   job fires inside R
              mkstemp(dir=D) -> FileNotFoundError
      09:44   manual retry -> same error, new random name, same parent
     ~10:00   R replaced by a fresh runtime -> fresh scratch
      10:05   run succeeds
```

The real history matched that shape to the hour.

## Why both guards are individually correct

This is the part worth generalising, because neither guard is sloppy.

**The group probe** is a good proxy for "someone is still using this directory" — ordinary descendants keep their parent's process-group id, so they remain visible. But the sweep's own comment names the escape hatch: *a descendant that `setsid()`s out of the group evades this probe*. Such a descendant still carries `TMPDIR` in its environment, and that environment is never revalidated. The liveness boundary was deliberately matched to the process-kill boundary — a defensible choice — but the *env-inheritance* boundary is wider than both.

**The idle-time guard** is a good proxy for "this directory is still in use" — an interactive session writes constantly. But consider what a well-behaved daily cron looks like from the outside: it touches `TMPDIR` once, for a few seconds, then its `finally` deletes the file it just made. The directory returns to idle almost immediately and stays that way for roughly 23 hours.

So the failure mode is: **an idle-time proxy penalises exactly the workloads that are correct but quiet.** The tidier the job — short runs, prompt cleanup, no chatter — the more reliably it looks dead. A leaky job that forgot to clean up its temp files would have kept its own directory alive.

## The blast radius

The exposure scales with how *rarely* a job runs, which is the opposite of the usual intuition:

| Job | Cadence | Idle window between runs |
|---|---|---|
| memory rot audit | weekly, Monday 07:30 | **~7 days** |
| infra drift check | daily 08:30 | ~23 h |
| dashboard capture verify | daily | ~23 h |
| browser daemon reaper | daily 23:30 | ~23 h |

The weekly job is the most exposed: it satisfies the idle condition essentially always, and is only waiting on the owner pid to die. A fifth job on the same schedule surface was unaffected — it runs through a different execution path that never generates a launcher, which is itself a useful signal about where the defect lives.

## What configuration cannot fix

The instinct is to pin `TMPDIR` for the job and move on. Both routes are closed:

- The job record has an `env` field. It is **inert** — the value is read only when serialising the job back out, and is never applied to any spawn.
- The secrets-grant mechanism explicitly refuses `TMPDIR`, alongside `PATH`, `HOME` and `SHELL`, on the grounds that those alter *how* the child runs rather than being data it reads. That refusal is correct; it just also closes the workaround.

Keeping the directory artificially warm to dodge the idle check would "work" and is worse than the bug: it fights the design rather than fixing it, and it silently disables reclamation for everything else.

## Why it self-healed, and why that is the worst property

By the time the investigation reached the process table, no live process pointed at the deleted directory any more, and a manual trigger succeeded. The stale-env process had been replaced; the new one got a fresh scratch directory.

That is the most dangerous characteristic of this class of bug. It is **intermittent, self-clearing, and correlated with restarts** — so the obvious remedy (restart it) always appears to work, the failure never reproduces on demand, and the underlying race survives every round of "it's fine now". Two failures 74 minutes apart, then green, is exactly the pattern that gets closed as a fluke.

## The two places to fix it

Mapped onto the trace, there are exactly two honest fixes, and both sit upstream of any user configuration:

1. **At the creation edge.** Catch `FileNotFoundError` from `mkstemp` and either recreate the directory or fall back to the system temp. Cheapest, and it makes a swept directory a non-event rather than an outage.
2. **At the guard edge.** Replace "owner process group is alive" with a signal that matches how the value actually propagates — whether any live process still names that directory as its `TMPDIR`, or have the owning runtime refresh the directory's mtime while it lives. This is the fix that addresses the cause rather than the symptom.

They are complementary: the first makes the failure survivable, the second makes it not happen.

## The checklist

Portable lessons, none of them specific to this codebase:

- **An environment variable is a snapshot at `execve`.** If a long-lived process caches a *path* in its environment, something must either keep that path valid or re-validate it at use. Choose one; do not assume.
- **When `mkstemp` raises `ENOENT`, suspect the parent directory, not the file.**
- **A constant parent with a varying leaf across failures means a cached path.** That single observation is worth more than a stack trace.
- **Do not use idleness as a proxy for death.** It systematically misclassifies low-duty-cycle work — and low duty cycle is what a correctly written periodic job looks like.
- **When two independent guards must both agree before a destructive action, audit the *pair*, not each one.** Both can be individually defensible and jointly produce the wrong verdict, and a code comment that names one guard's escape hatch is a hint that the pair was never re-examined together.
- **A bug that clears itself on restart has not been fixed.** Note the self-healing explicitly, or it will be closed as noise.
