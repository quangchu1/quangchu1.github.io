---
title: "Debate — Split the bootstrap repo, or harden it in place?"
description: "An autonomous Codex-vs-Claude debate on whether a single manually-applied Terraform bootstrap repository should be split into three. Outcome: consensus — split the state and the credentials, not the repositories, and let one unrun test decide the rest."
pubDate: 'Aug 29 2026'
---

> An autonomous structured debate between **Claude (PRO)** and **Codex (CON)**, refereed by the `codex-claude-debate` skill and grounded in a measured live-state assessment of a real Terraform estate. **Outcome: ✅ full consensus**, explicitly ratified by both agents.
>
> **On anonymisation:** the debate was grounded in a production environment. Every identifier has been removed — account numbers, region, hostnames, bucket names, state keys, repository and organisation names, script paths, and the names and email addresses of the engineers whose actions appear in the audit trail. What remains is the reasoning and the *relative* measurements, which is the part worth reading.

## The setup

One Git repository, called "bootstrap", holding **seven applyable Terraform stacks and four modules** across **five AWS accounts**. It is applied by hand from a laptop. It has no CI at all — no workflows, no automated plan, no drift detection — while every other infrastructure repository in the same organisation has them.

That is not an oversight. It is a deliberate decision with a plausible-sounding reason: this repo manages the CI platform itself. A bad automated apply could destroy the plane the automation runs on.

The operator wanted four things:

1. Reduce the risk of a change breaking the CI/GitOps plane.
2. Get out-of-band hotfixes reconciled back into code.
3. Produce a clear upgrade process for the CI server and its runners.
4. Separate bootstrap from day-2 operations from cross-account IAM.

And one binding constraint: **the result must be lightweight and easy to operate for a very small team.** Any proposal that adds repositories, pipelines or ceremony has to justify that cost against the *measured* blast radius.

## The motion

*"The bootstrap repository should be **SPLIT** — the server/runner day-2 lifecycle moved into its own repo with automated plan and a human-gated apply, and cross-account IAM moved into a third repo — rather than **KEPT** as one manually-applied repository hardened in place with guardrails."*

- **Claude — Proponent (PRO):** argues *for* the split.
- **Codex — Opponent (CON):** argues *against*.

Both sides were required to ground every claim in the live assessment, to take an explicit position on two specific findings, and — crucially — to answer whether the *state* should be split and how. Where the assessment said **NOT VERIFIED**, neither agent was allowed to argue past the marker; they had to name the test that would settle it.

## What the measurements did to the question

The assessment produced three numbers that reframed the debate before either side spoke.

**One state file, three lifecycles.** The main platform stack holds **57 managed resources** in a single state: a VPC with subnets and routing and eight endpoints, a load balancer, the server instance, its launch template and auto-scaling group, a managed database, a generated password and the secret holding it, and a dozen inline IAM policies. Foundation that should be created once, stateful data that must never be replaced casually, and day-2 mutable compute that changes every week — all in one blast radius, behind one apply.

**The repo owns the state bucket for the entire estate.** The bucket this repository creates holds the Terraform state of at least **five other repositories**, one of which alone manages 200 resources. Roughly **500 resources across five accounts** sit behind a stack that also lives in the repo being debated. And the repo shipped a script whose only purpose was bulk bucket deletion in that region.

**The real inputs are not in Git.** The variable files that actually apply are fetched from object storage. From a fresh clone you cannot reproduce the environment, and — the part that matters for goal 2 — an out-of-band hotfix has *nowhere in the repository to be reconciled to*.

That last one had already caused the thing the operator was worried about.

## The hotfix that was invisible by construction

The audit trail shows **seven launch-template versions created outside Terraform** in a single month, all by an assumed administrator role, all with a browser user agent — that is, by hand in the console, not by Terraform. State believed version 10; live was version 17.

The interesting part is not the console edits. It is the two commits either side of them.

Two commits, minutes before and after the console work, each changed one line — the runner instance type, and the Node version — in a **module default**. But the environment layer passes those values explicitly, so the environment default wins and the module default is dead code. Both commits were no-ops. Each was followed within minutes by a console edit.

Someone tried to do it properly in code, watched it not take effect, and then did it by hand. Twice.

The measured result:

| Value | What code would apply | Live |
|---|---|---|
| runner instance type | `t4g.medium` (2 vCPU / 4 GB) | **`c7g.xlarge`** (4 vCPU / 8 GB) |
| Node version | `22.16.0` | **`24.19.0`** |

The live instance type exists in *neither* layer of the code. And since the auto-scaling group tracks the latest launch-template version, the next `terraform apply` — including the one the planned CI-platform upgrade requires — would silently halve the runner fleet's CPU and roll Node back a major version.

This is what "documentation is not a control" looks like with numbers attached. Nobody was careless. The feedback loop simply did not exist: no committed inputs to diff against, no drift plan to fail, no signal at all.

## Where the debate actually landed

Both agents converged on a distinction that dissolves the motion as written:

> **Terraform containment comes from state boundaries, narrowly scoped credentials, and apply policy. Repository boundaries can strengthen *approval and ownership* controls — they cannot replace the containment mechanisms.**

The motion asked "how many repositories?" The evidence said the repository count was the *least* load-bearing variable in the question. A second repository with the same wide credentials and the same shared state file buys approval theatre. Separate states with separate credentials in *one* repository buy real containment.

So the consensus splits what actually needs splitting:

**The 57-resource state becomes three states**, via reviewed `terraform state mv`:

1. foundation and network,
2. stateful data — database, secret, generated password,
3. day-2 — server, runners, load balancing.

Each gets an explicit backend key, its own credentials, and an independent plan. **Only the day-2 state is ever eligible for CI apply.** That one change decouples a routine runner edit from the foundation *and* from the resource that regenerates a password.

**The state-backend stack stays exactly where it is** — in bootstrap, in its own state, human-applied, never CI-applied, with deletion protection, human-only permissions and a *tested* state-version recovery procedure. Versioning is on; deletion protections beyond that are unverified, so they get a named test rather than an assumption. The bulk-purge script gets deleted.

**Non-secret inputs get committed to Git**, including the live values that drifted, at the layer that actually takes precedence. Secrets stay external references. Without this, goal 2 is unachievable by construction.

**Every stack gets an explicit backend.** Five of the seven could initialise against empty local state from a fresh clone — a class of mistake where the failure mode is a plan that proposes to create everything. The state-backend stack additionally needs a documented two-stage recovery, because its own backend depends on the bucket it creates.

**Plan everywhere, apply narrowly.** Plans on pull requests and on a schedule for every state — plans are read-only, though a real remote-backend plan does take a state lock. Bootstrap, foundation, stateful data and IAM stay locally applied. Only day-2 becomes a candidate for gated CI apply, and only with verified approval controls, isolated credentials and a working local fallback.

## The verdict on the motion itself

**Split the state and the credentials now. Add at most *one* day-2 repository, and only if a specific test says you must. Do not create the third IAM repository at all yet.**

Claude — arguing *for* the split — signed that. What it got in exchange is the part worth copying: the repository decision is not resolved by argument, it is **deferred to an unrun read-only test**.

The forge's own enforcement capabilities were marked NOT VERIFIED: whether branch protection can scope reviews to *paths*, whether CI secrets and environments can be scoped below repository level, what credentials each existing workflow actually holds. Until that is inspected:

- If path-scoped enforcement **is** verified → keep one repository, with separate states, roles and gates.
- If it **is not** → create exactly one day-2 repository, with plan-on-PR, human-gated apply, a day-2-only role, and a locally runnable fallback.
- If the test is **inconclusive** → keep one repository and retest.

Neither agent could win that point by asserting, so it became a task instead of an opinion.

### Where they genuinely did not agree

1. **The day-2 repository.** PRO: forge controls conventionally operate at repository scope, so a separate repo is the *likely* enforceable boundary. CON: show me that path-scoped controls are unavailable before I accept the extra operational surface. Both accept the same inspection as dispositive.
2. **The IAM repository.** PRO valued it as an ownership boundary. CON held that per-account states, roles and backends already achieve it. Both agreed: **not now** — reconsider only if repository isolation proves to enforce something that state and credential separation cannot.
3. **What the evidence weighs toward.** PRO emphasised the console edits as proof that process was bypassed. CON emphasised the missing versioned inputs and absent drift signals as the reason it *could* be bypassed unnoticed. Same fix, different diagnosis — and both agreed that if the mechanical controls fail, that failure is the argument for stronger enforcement.

## The order of operations

The agreed sequence is deliberately verification-first, because three of the load-bearing facts were unverified:

1. **Read-only verification.** Inspect the forge's enforcement controls and every workflow's credentials. Test the state bucket's actual deletion protections with permission simulations. Identify who owns an **orphan state file** — four IAM resources in a state that no directory in the repository obviously corresponds to. Check what downstream repositories assume about the shared bucket.
2. **Harden in place.** Pin the Terraform version (the constraint allowed laptop divergence even though the state was written by one specific patch release). Add backends and recovery notes. Commit the live inputs. Add reusable PR-plan and scheduled-drift automation — with **no CI apply initially**. Delete the purge script. Enable termination protection. Reconcile an unmanaged live bucket into state. Add the minimum server and runner liveness alarms, because the region had none.
3. **Then split the state**, after a clean locked plan proves the code and the world agree.
4. **Publish the upgrade runbook before upgrading anything** — reconcile code and inputs first, preserve the server's on-disk configuration byte-for-byte, verify snapshot and rollback, upgrade the server in place, replace runners immutably.
5. **Decide repository topology from the evidence** gathered in step 1.

Note where step 2 sits: the drift is fixed *before* the upgrade that would otherwise have shipped the regression. The dependency was found by requiring both agents to cite line numbers.

## What the exercise was worth

Not "split it" or "don't split it". Neither is a finding.

**It reframed the question from topology to containment.** The motion offered a choice between one repository and three. The evidence showed that the number of repositories was nearly orthogonal to every stated goal, and that the real variables — state boundaries and credential scope — were available *within* either shape. A debate obliged to cite measurements found the question itself slightly wrong.

**It converted the loudest disagreement into a read-only test.** The single point the two agents could not settle is now an inspection with three pre-committed branches and a default. Nobody has to win.

**It found a scheduled self-inflicted regression.** A drift that had been harmless for a month was about to be applied by the *next* planned change — an upgrade whose whole purpose was to reduce risk. That link only surfaces when someone is forced to read the launch-template state, the module defaults, the environment defaults and the live values as one argument.

The general lesson is the boring one, restated with a number: **an out-of-band fix is not a process failure when the code has nowhere to record it.** Seven console edits, two no-op commits, and an engineer doing the right thing first and giving up. Fix the loop before you add the ceremony.
