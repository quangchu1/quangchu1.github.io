---
title: 'codex-plugin-cc: Using Codex from Claude Code'
description: 'A technical explainer of OpenAI''s codex-plugin-cc — what it is, its architecture, how to install and use it, key design choices, and caveats.'
pubDate: 'Jul 26 2026'
heroImage: '../../assets/blog-placeholder-1.jpg'
---

> This explainer was produced autonomously by a Claude + Codex collaboration (both agents ratified the result), grounded strictly in the [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) repository.

`codex-plugin-cc` is a Claude Code plugin marketplace maintained by OpenAI. It lets Claude Code users invoke their local Codex CLI for code review, delegated coding tasks, and session handoff without leaving their current workflow.

The repository contains one plugin, `codex`, implemented as dependency-free Node.js scripts, Claude Code command definitions, agent skills, lifecycle hooks, and a small JSON-RPC client for the Codex app server.

## What Problem It Solves

Using Codex separately normally requires opening another tool and re-establishing context. This plugin instead uses:

- The same repository checkout
- The same local Codex installation
- The same authentication state
- The same user and project Codex configuration

It does not reimplement or bundle Codex. Calls run through the globally installed `codex` binary and count against the user's Codex usage limits.

The plugin exposes eight slash commands:

| Command | Purpose |
|---|---|
| `/codex:setup` | Check installation and authentication; configure the review gate |
| `/codex:review` | Run Codex's built-in read-only reviewer |
| `/codex:adversarial-review` | Run a steerable review that challenges design decisions |
| `/codex:rescue` | Delegate investigation or implementation to Codex |
| `/codex:transfer` | Import the current Claude session into a persistent Codex thread |
| `/codex:status` | Show active and recent jobs |
| `/codex:result` | Retrieve a completed job's stored output |
| `/codex:cancel` | Cancel an active background job |

It also provides the `codex:codex-rescue` subagent, visible through `/agents`.

## Architecture

The main execution path is:

```text
Claude Code
  |
  +-- commands/*.md             Slash-command contracts
  +-- agents/codex-rescue.md    Delegation subagent
  +-- skills/*/SKILL.md         Internal forwarding, prompting, and output rules
  +-- hooks/hooks.json          Session and stop hooks
  |
  v
scripts/codex-companion.mjs     Command dispatcher and job launcher
  |
  +-- lib/git.mjs               Review target and diff collection
  +-- lib/state.mjs             Per-workspace configuration and jobs
  +-- lib/tracked-jobs.mjs      Job lifecycle and progress
  +-- lib/render.mjs            Markdown rendering
  +-- prompts/*.md              Adversarial-review and stop-gate templates
  +-- schemas/review-output...  Structured review contract
  +-- lib/codex.mjs             Codex operation orchestration
  |
  v
lib/app-server.mjs              JSON-RPC-over-JSONL client
  |
  +-- direct: codex app-server over stdio
  +-- broker: shared socket or named-pipe connection
  |
  v
scripts/app-server-broker.mjs   Shared Codex app-server process
```

### Command Contracts

Files under `plugins/codex/commands/` are Markdown prompts with YAML frontmatter. They declare allowed tools and constrain Claude's behavior.

For example, the review commands are explicitly read-only and require Claude to return the companion command's output without rewriting it. The command definitions also decide whether to wait or launch a review through Claude Code's background `Bash` mode.

Most commands set `disable-model-invocation: true`, so `/codex:review`, `/codex:adversarial-review`, `/codex:transfer`, `/codex:status`, `/codex:result`, and `/codex:cancel` only run when the user asks for them. `/codex:setup` and `/codex:rescue` deliberately stay model-invocable, which is what allows Claude to hand work to Codex on its own initiative.

The rescue command routes work to `codex:codex-rescue`. That subagent has only the `Bash` tool and is instructed to make exactly one companion CLI call, preventing it from independently inspecting or modifying the repository.

### Bundled Skills

Three internal skills carry the behavioral rules that would otherwise be duplicated across prompts. All three are marked `user-invocable: false`.

- `codex-cli-runtime` — the forwarding contract for the rescue subagent: one `task` call, which flags are routing controls, and which subcommands are off-limits.
- `gpt-5-4-prompting` — how to shape Codex prompts: compact XML-tagged blocks, explicit output contracts, grounding and verification rules. Backed by reference files for reusable blocks, end-to-end recipes, and antipatterns.
- `codex-result-handling` — how Claude must present Codex output: preserve findings, severities, paths, and evidence boundaries, and never auto-apply fixes from a review without asking first.

### Companion CLI

`scripts/codex-companion.mjs` is the central entry point. Its public operations include:

```text
setup
review
adversarial-review
task
transfer
status
result
cancel
```

It also has internal operations such as `task-worker` for detached tasks and `task-resume-candidate` for finding resumable work.

The CLI produces human-readable Markdown by default. Its handlers also accept `--json` for command wrappers and automation.

### Codex App-Server Client

`lib/app-server.mjs` implements two transports:

- `SpawnedCodexAppServerClient` starts `codex app-server` and communicates over standard input and output.
- `BrokerCodexAppServerClient` connects to a shared broker over a Unix socket or Windows named pipe.

`lib/codex.mjs` builds on this transport to start or resume threads, run turns, launch native reviews, interrupt turns, inspect authentication, and import external-agent sessions.

### Shared Broker

Every slash-command invocation starts a new Node.js process. To avoid repeatedly starting Codex, `app-server-broker.mjs` owns one app-server process and forwards requests from command invocations.

The broker permits only one active request or streaming operation at a time. A competing request receives JSON-RPC error `-32001`. The caller then falls back to a dedicated app-server process instead of failing.

`turn/interrupt` is allowed through while another socket owns an active stream, making cancellation possible during a long-running turn.

### State and Jobs

`lib/state.mjs` stores data per workspace. Its directory name combines a readable workspace slug with the first 16 hexadecimal characters of a SHA-256 hash of the canonical workspace path.

State includes:

```text
state.json
broker.json
jobs/<job-id>.json
jobs/<job-id>.log
```

At most 50 jobs are retained. Pruning removes both job payloads and logs.

Jobs record their Claude session ID when available. Listings and defaults are then scoped to the current session: `/codex:status` without an ID, `/codex:result` without an ID, `/codex:cancel` without an ID, and rescue resume selection all consider only this session's jobs. Passing an explicit job ID deliberately bypasses that filter, so a job from another session can still be inspected or cancelled. Session cleanup removes that session's jobs and terminates its active process trees.

### Lifecycle Hooks

`hooks/hooks.json` registers three hooks:

- `SessionStart` exports the Claude session ID, transcript path, and plugin data directory.
- `SessionEnd` shuts down the broker, terminates remaining session jobs, and removes session state.
- `Stop` optionally runs the review gate.

## Installation

Requirements:

- Node.js 18.18 or later
- A ChatGPT subscription, including Free, or an OpenAI API key
- A local Codex CLI installation and authentication

Inside Claude Code:

```bash
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

If Codex is missing, `/codex:setup` can offer to install it when npm is available. Manual installation uses:

```bash
npm install -g @openai/codex
```

To authenticate:

```bash
!codex login
```

Setup verifies both `codex --version` and `codex app-server --help`, so an older CLI without app-server support is treated as unavailable.

## Using the Plugin

### Review Current Work

```bash
/codex:review
/codex:review --base main
/codex:review --background
```

An explicit `--base` selects branch review. Otherwise, automatic selection uses the working tree when it is dirty and a comparison against the detected default branch when it is clean. `--scope` accepts only `auto`, `working-tree`, or `branch`.

This command calls Codex's native `review/start` operation. It does not accept custom focus text, staged-only scope, or unstaged-only scope.

### Run an Adversarial Review

```bash
/codex:adversarial-review
/codex:adversarial-review --base main challenge the caching and retry design
/codex:adversarial-review --background look for race conditions
```

Unlike the native reviewer, this mode builds a dedicated prompt and runs a normal Codex turn. Its prompt emphasizes material risks such as authorization failures, data loss, retries, races, schema drift, and degraded dependencies.

Results must match `schemas/review-output.schema.json`, which defines a verdict, summary, findings, and next steps. Each finding includes severity, file and line locations, confidence, and a recommendation.

Both review modes use a read-only sandbox.

### Delegate Work

```bash
/codex:rescue investigate why the tests started failing
/codex:rescue fix the failing test with the smallest safe patch
/codex:rescue --resume apply the top fix from the last run
/codex:rescue --model gpt-5.4-mini --effort medium investigate the flaky test
/codex:rescue --model spark fix the issue quickly
/codex:rescue --background investigate the regression
```

The `spark` alias maps to `gpt-5.3-codex-spark`. Other model names pass through unchanged. Valid effort values are `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`.

Rescue runs default to write-capable access. The subagent adds `--write` unless the user explicitly asks for read-only behavior or only wants review, diagnosis, or research without edits. App-server threads use an approval policy of `never`, so write-capable runs do not prompt before editing.

Detached tasks are executed by an internal `task-worker` process. Their request, progress, and final result are persisted in the job store.

### Transfer a Claude Session

```bash
/codex:transfer
/codex:transfer --source ~/.claude/projects/-Users-me-repo/<session-id>.jsonl
```

The default source comes from the `SessionStart` transcript path. Transfer uses Codex's `externalAgentConfig/import` operation and prints a command such as:

```bash
codex resume <session-id>
```

The implementation verifies the import against Codex's `external_agent_session_imports.json` ledger using both the canonical source path and its SHA-256 content hash.

### Manage Jobs

```bash
/codex:status
/codex:status task-abc123
/codex:status task-abc123 --wait --timeout-ms 60000
/codex:status --all
/codex:result
/codex:result task-abc123
/codex:cancel task-abc123
```

Unique job-ID prefixes are accepted. Ambiguous prefixes produce an error asking for a longer ID. `--wait` polls a single job until it leaves the queued or running state, and requires a job ID.

Cancellation first requests `turn/interrupt`, then terminates the job's process tree and records both outcomes.

### Enable the Review Gate

```bash
/codex:setup --enable-review-gate
/codex:setup --disable-review-gate
```

When enabled, the `Stop` hook asks Codex to review only edits made during Claude's immediately preceding turn. Its output must begin with:

```text
ALLOW: <reason>
```

or:

```text
BLOCK: <reason>
```

A blocking result prevents Claude from stopping so the issue can be addressed.

### Configure Defaults

The plugin inherits normal Codex configuration. For example, a trusted project's `.codex/config.toml` can contain:

```toml
model = "gpt-5.4-mini"
model_reasoning_effort = "high"
```

User configuration comes from `~/.codex/config.toml`; trusted project configuration overrides it.

## Notable Design Choices

### Native and Steerable Review Paths

The project intentionally separates review modes:

- `/codex:review` delegates directly to Codex's built-in reviewer and inherits its behavior.
- `/codex:adversarial-review` trades that direct inheritance for custom focus text and structured output.

This avoids maintaining a replacement for the standard reviewer while still supporting design-oriented review.

### Thin Forwarding Instead of Orchestration

The rescue path is deliberately dumb. The subagent may reshape the user's request into a tighter Codex prompt, then makes a single `task` call and returns stdout unchanged. It is explicitly forbidden from reading the repository, polling status, fetching results, or substituting its own answer when Codex fails. This keeps one agent responsible for the work and prevents two models from silently interleaving edits.

### Diff-Size-Adaptive Context

Adversarial review inlines complete diff context only when the change contains at most two files and no more than 256 KiB of Git output.

Larger changes receive status, file lists, and summary statistics, with instructions for Codex to inspect the diff using read-only Git commands. Untracked files larger than 24 KiB, binary files, directories, and unreadable symlinks are represented by explicit skip markers.

### Resilient Turn Completion

Codex turns may spawn subagents without delivering the expected parent `turn/completed` notification. The runtime tracks pending collaboration and subagent turns. After a final answer appears and all subagent work drains, it can infer completion after a short delay instead of hanging indefinitely.

### Progress Translation

Protocol notifications are converted into phases such as `investigating`, `editing`, `running`, `verifying`, and `finalizing`. Commands containing test, lint, build, type-check, or similar terms are classified as verification work.

### Cross-Platform Process Handling

Unix systems use sockets and process-group signals. Windows uses named pipes and `taskkill /T /F`.

Git commands always run without a shell so repository-derived branch names are passed literally. Codex may use a shell on Windows because its executable can be a command shim.

### Protocol Types Generated by Codex

The prebuild step runs:

```bash
codex app-server generate-ts --out plugins/codex/.generated/app-server-types
```

TypeScript then checks the JavaScript implementation with `allowJs`, `checkJs`, and `noEmit`. This exposes app-server protocol drift during CI without converting the runtime to TypeScript.

Tests use a fake executable named `codex` that implements enough of the protocol to exercise broker reuse, session scoping, cancellation, transfer, authentication, diff limits, and missing completion events without network access.

### Version Metadata Kept In Sync

`scripts/bump-version.mjs` writes one version into `package.json`, `package-lock.json`, the plugin manifest, and both version fields in the marketplace manifest, and its `--check` mode fails when they diverge.

## Limitations and Caveats

- **Codex is not bundled.** The global CLI must be installed, authenticated, and new enough to support `app-server`.
- **Usage and latency remain Codex usage.** Reviews consume Codex limits, and multi-file reviews may take long enough that background execution is preferable.
- **Native review is intentionally inflexible.** It supports uncommitted changes or a base branch, but not custom focus text, staged-only review, or unstaged-only review.
- **Large adversarial reviews depend on tool inspection.** Once inline limits are exceeded, Codex must fetch the relevant diff itself.
- **The broker is single-flight.** Contended requests start separate app-server processes, preserving correctness but losing broker startup savings.
- **Broker startup is best-effort.** If its endpoint is not ready within two seconds, the runtime falls back to direct startup.
- **Transfer sources are restricted.** They must be `.jsonl` files beneath `~/.claude/projects` after resolving symlinks. Transfer always uses a direct app server.
- **Job history is bounded and session-scoped.** Only 50 jobs are retained, temporary fallback state may be cleared by the operating system, and `SessionEnd` removes the current session's jobs.
- **The review gate can loop and consume substantial usage.** The README recommends enabling it only while actively monitoring the session.
- **Gate failure behavior is mixed.** Once a gate review runs, timeout, execution failure, invalid JSON, empty output, or an unexpected first line blocks stopping. If Codex is detected as unavailable before the review starts, the hook instead prints setup guidance and permits the stop.
- **Rescue can edit without approval prompts.** Write-capable rescue tasks use `workspace-write` with approval policy `never`, and write-capable is the default.
- **Review commands require a Git repository.** Other operations, including setup, task delegation, transfer, and job management, do not universally impose that requirement.
- **Structured output may degrade.** If adversarial-review JSON is invalid or has the wrong shape, rendering falls back to the raw final message plus a parse or validation error.
- **Distribution is marketplace-only.** The root package is private and exposes no npm `bin`, `main`, or `exports`.
- **Repository documentation has gaps.** The package version is `1.0.6`, while the changelog only documents `1.0.0`. The README references `docs/plugin-demo.webm`, but no `docs` directory is present in the repository.
