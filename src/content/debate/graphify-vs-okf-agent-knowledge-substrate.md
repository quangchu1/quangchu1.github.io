---
title: "Co-working — Should a multi-agent infra repo adopt Graphify or OKF as its knowledge substrate?"
description: "An autonomous Claude + Codex co-working assessment of Graphify v0.9.49 vs OKF v0.2 as the knowledge base for an 8-agent Terraform automation repo. Outcome: NEITHER — Graphify resolved 0 of 69 real cross-repo module calls."
pubDate: 'Aug 25 2026'
---

> An autonomous **co-working** run — not a debate — between **Claude (`claude-fable-5`)** and **Codex (`openai.gpt-5.6-sol`)**, driven by the `collaborate.sh` cooperative draft⇄ratify engine in the `codex-claude-debate` skill. One agent drafts, the other verifies against the source and either ratifies or returns a corrected artifact; roles swap each round. Four rounds, ~53 minutes, both models on Amazon Bedrock.
>
> **Outcome: `NEITHER`, confidence 0.90.** The interesting part is not the verdict but *how* they got there: they installed Graphify 0.9.49 and ran it against the real repositories instead of arguing from documentation, then killed the hypothesis with a single measurement.
>
> **→ [Part 2](/debate/graphify-vs-okf-part-2-implementation/)**: the two agents then *built* the index recommended here, re-assessed it — and proved my competing call-count wrong in the process.

## The question

> Should a multi-agent infrastructure-automation repo adopt **Graphify v0.9.49** (a code knowledge graph), **OKF v0.2** (Google Cloud's Open Knowledge Format markdown bundle), **both in layered roles**, or **neither**, as the knowledge substrate for the 8 agents configured in its `.claude/agents/` directory?

The subject is a Terraform request-automation repo: 8 agent definitions, 4 CI workflows, an inter-agent contract protocol (`CONTRACTS.md`, templates T1–T7), operating alongside 29 sibling repositories. The agents reason **across** repository boundaries — a change to a shared module has consumers in the nonprod, deployment and prod repos — so cross-repo reach was set as the crux of the assessment up front.

The brief forced every factual claim to be labelled `[MEASURED]` or `[INFERRED]`, required a measured token-budget delta, and required a named open-disagreements section.

## The measurement that decided it

The consumer repos make **69 explicit `source =` module calls** into 17 distinct shared modules. Graphify resolved **0 of 69** as cross-repository edges — after *both* documented composition strategies:

- `merge-graphs` across five independently extracted graphs → 1,238 nodes, 2,466 edges, **0 cross-repo edges**
- a single extraction of the common parent directory → 2,416 nodes, 4,449 edges, **0 Terraform cross-repo edges**

`same_type_as`, the feature marketed for cross-repo linking, also produced 0 edges — it matches fully-qualified *type declarations*, which is not Terraform module-source resolution.

They also found Graphify recovered all 30 module inputs and 18 outputs for one module, but **zero of those nodes carried type, default or description attributes** — so it can say a variable exists, not what shape it is.

And OKF v0.2 turned out to have no Terraform story at all: zero Terraform/HCL mentions in the spec or README, with a BigQuery-based reference producer. Their OKF prototype resolved a cross-repo link correctly, but that link was hand-authored — storage reach without discovery reach.

## A note on this text

Identifiers belonging to the client organisation have been generalised (org prefix, repository paths, private commit SHAs). Every measurement, command, count and conclusion below is verbatim from the agents' ratified output.

---

# Knowledge-substrate assessment for `infra-requests`

## 1. Verdict

**NEITHER** as the authoritative knowledge substrate. **Confidence: 0.90**, inferred from Graphify's measured 0/69 cross-repository Terraform-call recall, incomplete T2 representation, and OKF's lack of a Terraform producer. [MEASURED] Graphify v0.9.49 extracts useful repository-local structure, but merging five graphs and scanning their common parent both produced zero Terraform cross-repository edges. [MEASURED] OKF can represent an explicitly authored cross-repository link, but the supplied v0.2 implementation documentation contains no Terraform/HCL extractor. [INFERRED] Adopt a deterministic HCL-derived contract index instead; permit Graphify as a non-authoritative query accelerator and OKF as an optional generated publication format only after freshness and derivation gates pass.

## 2. Evidence table

| ID | Command | Real result |
|---|---|---|
| E1 | `find knowledge/infra-requests/.claude/agents -name '*.md' \| wc -l`; equivalent workflow and contract counts | [MEASURED] `agents=8 workflows=4 T1-T7=7 T8=1` |
| E2 | `awk -F'|' 'NR>=9 && /^\|/ {n++; files+=$3; tf+=$4; md+=$5} END{print n,files,tf,md}' knowledge/_refs/REPO-LANDSCAPE.md` | [MEASURED] `29 4437 143 48` |
| E3 | `git -C <repo> rev-parse HEAD` | [MEASURED] Five repository HEAD SHAs recorded (redacted here; private repositories). |
| E4 | `graphify --version`; `rg '^\*\*Version 0\.2' knowledge/_refs/okf-SPEC.md` | [MEASURED] `graphify 0.9.49`; `3:**Version 0.2**`. |
| E5 | `/usr/bin/time -p graphify extract <repo> --out <workspace-dir> --code-only --no-cluster` | [MEASURED] Modules: 73 files, 704 nodes, 1,605 edges, 1.05s. Nonprod: 7/140/223, 0.33s. Deployment: 14/139/257, 0.29s. Network: 8/95/209, 0.24s. Prod: 13/108/173, 0.28s. |
| E6 | `graphify merge-graphs <five graph.json files> --out .measure/recheck-20260825-merged.json` | [MEASURED] `Merged 5 graphs -> 1238 nodes, 2466 edges`; `real 0.18`. |
| E7 | `rg '^\s*source\s*=.*infra-terraform-modules' ... --glob '*.tf'` plus grouping | [MEASURED] 69 explicit module calls from four consumer repositories to 17 distinct shared modules. |
| E8 | `jq '[.links[] \| select((.source\|split("::")[0]) != (.target\|split("::")[0]))] \| {cross_repo_edges:length,same_type_as_edges:(map(select(.relation=="same_type_as"))\|length)}' ...merged.json` | [MEASURED] `{"cross_repo_edges":0,"same_type_as_edges":0}`. |
| E9 | `/usr/bin/time -p graphify extract <org-infra> --out ... --code-only --no-cluster` | [MEASURED] 372 code files, 3,647 non-code files skipped, 47 potentially sensitive files skipped, 2,416 nodes, 4,449 edges, 31.20s. A node-to-file join returned `terraform_cross_repo_edges=0`. |
| E10 | `graphify query "Which repositories call the ec2-instance Terraform module, and what inputs and outputs does that module expose?" --graph ... --budget 2000` | [MEASURED] Eight nodes returned, including module files plus unrelated heuristic matches; no caller-to-module relation or repository answer. |
| E11 | `graphify path "module.jumpbox" "var.key_name" --graph <parent graph>` | [MEASURED] `No directed path found`. |
| E12 | `jq` counts over EC2 variable/output nodes and their attributes | [MEASURED] 30 variable nodes and 18 output nodes; zero nodes carried type, default, or description attributes. |
| E13 | `uv run --with tiktoken python .measure/count_tokens.py` | [MEASURED] Five-repo Terraform: 72,938 tokens; operating documents: 28,307; EC2 task files: 20,898; Graphify query: 287; OKF T2 index/concept: 282; layered payload: 528. Encoding: `o200k_base`. |
| E14 | `rg -i 'terraform\|hcl' knowledge/_refs/okf-{SPEC,README}.md`; `rg -- '--source bq\|BigQuery metadata alone' ...` | [MEASURED] Zero Terraform/HCL mentions; the documented reference producer uses BigQuery metadata and `--source bq`. |
| E15 | Python Markdown-link resolution over `.measure/okf` | [MEASURED] `docs=4 links=2 resolved=2 broken=0`; raw size 2,194 bytes. The module dependency link was hand-authored. |
| E16 | `wc -c <parent graph> <merged graph>`; `jq '{input_tokens,output_tokens}' <parent graph>` | [MEASURED] Parent graph 2,517,749 bytes; merged graph 1,411,217 bytes; `input_tokens=0`, `output_tokens=0`. |
| E17 | `rg -l 'uses: actions/checkout@v4' workflows`; search for artifact/cache actions | [MEASURED] All four workflows checkout `infra-requests`; zero upload-artifact, download-artifact, or cache references. |
| E18 | `rg 'same_type_as\|Terraform / HCL\|merge-graphs'` over Graphify references | [MEASURED] Graphify documents Terraform AST extraction and `merge-graphs`; its cross-repository release feature links matching fully qualified type declarations through `same_type_as`. |

## 3. Fit against `CONTRACTS.md` T1-T7

[MEASURED] `CONTRACTS.md` defines per-issue contracts that are discarded after the issue, rather than a long-lived registry. [INFERRED] This favors runtime derivation and validation over a durable hand-maintained knowledge bundle.

| Contract | Graphify v0.9.49 | OKF v0.2 | Finding |
|---|---|---|---|
| T1 `generated-names` | **Store only** | **Store only** | [INFERRED] Both can retain policy or examples; neither executes the naming policy from issue semantics. |
| T2 `module-interface` | **Partially derivable** | **Store only** | [MEASURED] Graphify found all 30 EC2 inputs and 18 outputs but omitted their types, defaults, descriptions, required status, `aws_arg` mappings, and consumer edges. |
| T3 `resource-reference` | **Partially derivable** | **Store only** | [INFERRED] Graphify can expose static Terraform addresses and references, but not reliably derive logical role, expected type, cross-repository consumer intent, or post-apply identity. |
| T4 `external-lookup` | **Derivation out of scope; record storable** | **Store only** | [MEASURED] T4 values originate from an issue, management account, or manual source. |
| T5 `network-handoff` | **Partially derivable** | **Store only** | [INFERRED] Static expressions and CIDRs may be indexed; live TGW, route-table and prefix-list IDs require state, AWS inspection, or a completed producer step. |
| T6 `autofix-context` | **Derivation out of scope; record storable** | **Store only** | [MEASURED] Its fields originate from workflow inputs, plan output, PR metadata, and prior comments. |
| T7 `autofix-proposal` | **Retrieval support only** | **Store only** | [INFERRED] Neither performs diagnosis, constructs a safe minimal diff, classifies destructive changes, or proves convergence. |

[INFERRED] No T1-T7 contract is fully and mechanically derivable from either candidate alone. [MEASURED] `CONTRACTS.md` also contains T8 `manual-step`; it was not scored because the requested scope was T1-T7.

## 4. Cross-repo reach

### Graphify

[MEASURED] The measured source contains 69 explicit calls from deployment, network, nonprod, and prod into 17 modules in `infra-terraform-modules`. [MEASURED] Graphify resolved zero corresponding cross-repository edges after both documented composition strategies: merging five independently extracted graphs and extracting their common parent. [MEASURED] Effective recall for this required relation was therefore 0/69.

[MEASURED] `same_type_as` also produced zero edges. [INFERRED] That feature targets equivalent fully qualified type declarations, not Terraform module-source resolution, and does not repair this result.

### OKF

[MEASURED] An explicitly authored OKF link from `consumers/nonprod-jumpbox.md` to `/modules/ec2-instance.md` resolved successfully. [MEASURED] OKF links are untyped according to the specification, and consumers must tolerate broken links. [INFERRED] OKF therefore has cross-repository storage reach but no measured discovery reach; a separate producer must first find and type every dependency correctly.

## 5. Context-budget delta

| Payload | Tokens | Comparison | Correctness status |
|---|---:|---:|---|
| Five Terraform repositories | [MEASURED] 72,938 | Corpus baseline | [MEASURED] Raw source |
| EC2 module plus two consumer files | [MEASURED] 20,898 | Task baseline | [MEASURED] Raw source |
| Operating contract plus eight agent prompts | [MEASURED] 28,307 | Documentation baseline | [MEASURED] Raw source |
| Graphify EC2 query | [MEASURED] 287 | 72.8× below task baseline; 254.1× below corpus | [MEASURED] Incomplete: no caller edge or complete T2 fields |
| OKF T2 index and concept | [MEASURED] 282 | 100.4× below operating documents | [MEASURED] Not equivalent: schema text, not current module facts |
| Graphify query plus OKF concept | [MEASURED] 528 | 39.6× below task baseline | [MEASURED] Still incomplete |

[MEASURED] Token counts use `tiktoken` with `o200k_base`, not Claude's production tokenizer. [INFERRED] The candidates demonstrate potential retrieval compression, but no defensible equivalent "after" budget exists until cross-repository recall and contract-field completeness pass CI.

## 6. What breaks

| File | Required change |
|---|---|
| `CLAUDE.md` | [INFERRED] Define source SHAs, freshness validation, query-first behavior, raw-source fallback, and a rule that generated contracts and source remain authoritative over either candidate. |
| `orchestrator.md` | [INFERRED] Retain its mandatory clone-and-read module inventory until module-call recall passes; consume only a SHA-matched deterministic index. |
| `infra-terraform-modules.md` | [INFERRED] Generate T2 from parsed HCL, not Graphify query text or hand-authored OKF. Compare generated fields with the emitted contract before PR creation. |
| `infra-terraform-network.md`, `infra-terraform-deployment.md`, `infra-terraform-nonprod.md` | [INFERRED] Add SHA/freshness checks and scoped index queries; continue reading authoritative module files whenever an entry is missing or stale. |
| `terraform-autofix-analyzer.md` | [INFERRED] Allow graph-assisted localization, but retain error text, source-branch diff, module source, and a valid unified diff as authorities. |
| `naming-convention.md` | [INFERRED] An OKF concept may publish policy, but T1 must still be generated and validated at runtime. |
| `management-agent.md` | [INFERRED] OKF may publish lookup procedure and provenance; live lookup results must continue to produce T4. |
| `process-request.yaml` | [INFERRED] Pin index tooling, clone required repositories at recorded SHAs, validate freshness, and expose only the validated index to plan mode. |
| `execute-request.yaml` | [INFERRED] Rebuild or retrieve an index for the approved SHAs and fail closed if any repository moved after planning. |
| `autofix-suggest.yaml` | [INFERRED] Index the exact PR branch plus its module dependency SHA; reject a main-branch-only graph. |
| `autofix-apply.yaml` | [INFERRED] Carry source SHAs in T7 or its approval marker and verify them before applying; a proposal reconstructed from comment text alone cannot prove substrate freshness. |

## 7. Adoption plan

| Phase | Work | Objective CI exit criterion |
|---|---|---|
| 0 | [INFERRED; proposed gate, not extrapolated] Freeze current module-call and EC2 T2 fixtures. | [INFERRED; proposed gate] CI identifies all measured 69 calls, 17 targets, 30 EC2 inputs, and 18 outputs from the recorded SHAs. |
| 1 | [INFERRED] Run Graphify v0.9.49 in shadow mode only. | [INFERRED; proposed gate] 69/69 call edges, zero incorrect targets, and complete T2 attributes. [MEASURED] Current Graphify results fail this gate. |
| 2 | [INFERRED] Implement a deterministic HCL dependency/interface extractor independent of either format. | [INFERRED] Repeated CI runs produce byte-identical SHA-keyed output and fail when module sources or interfaces drift. |
| 3 | [INFERRED] Optionally emit the canonical index as OKF and enrich Graphify with its edges. | [INFERRED] Every OKF link resolves, every concept records source SHA, and Graphify edges equal the canonical edge set. |
| 4 | [INFERRED; proposed evaluation size, not extrapolated] Shadow 20 real requests before reconsidering the verdict. | [INFERRED; proposed gate] Zero stale-index uses or contract mismatches, at least 50% median context reduction, and no increase in failed raw-source fallbacks. |

## 8. Costs and risks

- [MEASURED] Full local code-only extraction took 31.20 seconds and generated a 2.52 MB graph without LLM extraction tokens.
- [INFERRED] Forgejo runtime will exceed the local measurement because jobs must clone multiple authenticated repositories; actual CI minutes were not measured.
- [MEASURED] Graphify's compact EC2 response consumed 287 context tokens, but omitted required facts.
- [MEASURED] The OKF prototype used 2,194 raw bytes for four documents. [INFERRED] Its main cost is a trustworthy producer and drift validator, not storage.
- [INFERRED] Layering both adds two schemas, two freshness mechanisms, two query paths, upgrade testing, and additional stale-data failure modes without supplying the missing derivation.
- [INFERRED] Graphify lock-in centers on its CLI, JSON graph schema, query behavior, and Terraform extractor semantics.
- [INFERRED] OKF is format-portable, but the system would remain coupled to its custom HCL producer, concept taxonomy, path conventions, and validation rules.
- [INFERRED] A stale Graphify graph can silently omit dependencies while presenting a compact, plausible answer.
- [INFERRED] A stale OKF bundle can preserve resolved links and polished prose after the underlying Terraform interface has changed.
- [INFERRED] Both failures are more dangerous than a loud raw-source failure unless workflows compare repository SHAs and fail closed.

## 9. Open disagreements

**None — genuinely converged.** [MEASURED] Claude independently re-ran the pivotal measurements against the same snapshots and reproduced them exactly: 69 module calls to 17 distinct modules (E7), zero cross-repository and zero `same_type_as` edges in the merged graph (E8), zero Terraform cross-repository edges in the 2,416-node parent graph (E9), 30 EC2 variable and 18 output nodes carrying no type/default/description attributes (E12), all six token counts (E13), zero Terraform/HCL mentions in the OKF v0.2 documentation (E14), and the recorded repository SHAs (E3). [INFERRED] Both agents hold the same position: **NEITHER as authoritative substrate**, with a deterministic HCL-derived contract index as the substrate that actually addresses `CONTRACTS.md` drift, and Graphify/OKF eligible only for bounded, non-authoritative roles after the Phase 1–3 gates pass.

## 10. What we did NOT verify

- [MEASURED] Graphify deep/semantic document extraction, global graphs, MCP serving, watch mode, hooks, clustering, or Bedrock-backed extraction were not tested.
- [MEASURED] No Forgejo runner timing, authentication overhead, cache behavior, or artifact transfer was tested.
- [MEASURED] No live AWS lookup, Terraform plan/state inspection, Forgejo API mutation, or end-to-end agent replay was executed.
- [MEASURED] The OKF reference implementation was not run; only the supplied specification, README, and local link prototype were assessed.
- [MEASURED] Full OKF conformance validation was not performed.
- [MEASURED] Graphify and OKF licensing, dependency security, SBOMs, and upgrade compatibility were not established.
- [MEASURED] Token counts are not Claude billing-token measurements.
- [MEASURED] Cross-repository behavior was tested only on the recorded local snapshots, not historical branches, pending PRs, or every repository in the 29-repository landscape.
- [MEASURED] T8 `manual-step` was not assessed because the requested contract scope was T1-T7.
