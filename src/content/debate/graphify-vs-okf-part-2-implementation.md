---
title: "Co-working part 2 — Building what the assessment recommended, then grading it"
description: "Claude and Codex built the deterministic HCL contract index their own assessment recommended, then re-assessed it. Verdict: MERGE WITH CHANGES. Along the way they proved the human's competing count wrong: 69 module calls, not 79."
pubDate: 'Aug 25 2026'
---

> Part 2 of an autonomous **co-working** run between **Claude (`claude-fable-5`)** and **Codex (`openai.gpt-5.6-sol`)** on Amazon Bedrock. [Part 1](/debate/graphify-vs-okf-agent-knowledge-substrate/) assessed Graphify v0.9.49 against OKF v0.2 as the knowledge substrate for an 8-agent Terraform automation repo and concluded **NEITHER**, recommending a deterministic HCL-derived contract index instead.
>
> This time they **built that index**, then assessed what they had actually built. Four alternating build rounds — Claude builds, Codex adversarially verifies *and fixes*, Claude hardens, Codex verifies from clean — followed by a re-assessment. Both agents worked in the same git branch, so the code was the handoff channel rather than a summary of it.
>
> **Outcome: `MERGE WITH CHANGES`, confidence 0.93.** 8 commits, 5,788 insertions, 38 tests passing, and a 27-item defect list.

## The part worth reading: the human was wrong

Before launching the build, I tried to verify Part 1's headline number and could not reproduce it. Part 1 claimed **69 module calls to 17 distinct modules**. A straightforward grep found **79** raw `source =` occurrences and roughly **19** distinct targets.

So the build brief did not hand the agents a target. It handed them a contradiction:

> **79 ≠ 69 and 19 ≠ 17.** One of these is wrong, or they are counting different things. Your first deliverable is to settle it by real HCL block parsing, not regex. Do not silently adopt 69 or 79. Derive it, then say which prior number was wrong and how.

They settled it against the human. Of the 79 raw hits, exactly **ten are not live module calls**: seven commented-out alternative `source` lines sitting *inside* live network blocks, two entirely commented-out blocks targeting `rds` and `ecs-cluster`, and one `<name>` header placeholder. 79 − 10 = **69**. The ~19 distinct targets collapse to **17** once the placeholder and the two dead targets are removed.

They did not stop at matching totals. They ran an independent `python-hcl2==7.3.1` parse and compared **edge by edge** against their own tool:

```text
parse_errors=0 calls=69 distinct=17  styles={'git': 3, 'path': 66}

independent_edges=69 tool_edges=69 missing=0 extra=0
```

Their verdict on the discrepancy is worth quoting, because it neither gloats nor overstates:

> The first assessment reached the correct number using a line-anchored grep that happened to exclude commented source lines; its result was correct, but its derivation was less robust than the present reconciliation.

Right answer, weaker reasoning — and the re-assessment says so about its own predecessor.

## Does Part 1's verdict survive?

Yes, and it strengthens. Part 1's central claim was Graphify's **0 of 69** cross-repository recall. Since the denominator is confirmed at 69 rather than 79, that claim holds exactly as stated, now with an independent parser cross-check behind the denominator and the exact edge set. Confidence in `NEITHER` rises from **0.90 to ~0.95**.

They also noted the counterfactual honestly: had the denominator been 79, zero recall still would not have supported adoption — so the correction never actually threatened the conclusion.

## Two blockers, found by the other model

The interesting failure mode in a co-working run is mutual flattery. It did not happen here. Codex tore into Claude's build and found two defects that gate the merge:

1. **Ref-blind interfaces.** Three callers are pinned to `v1.0.0`, but the index joins them to module interfaces parsed from the modules repository's **current HEAD**. The pinned caller and the interface shown beside it may simply disagree.
2. **A shared temp directory.** The CI workflow uses a fixed `/tmp/tfindex-sources` path that concurrent runner jobs can delete underneath each other.

And the workflow has **never run on a live runner** — explicitly marked `UNVERIFIED` rather than assumed.

## A disagreement that survived to the end

Claude's draft concluded that no blocking code defect existed and that everything outstanding was operational. Codex refused to sign that:

> This reassessment disagrees because ref-insensitive interfaces and the shared workflow directory are implementation defects that should be corrected before merge. […] the proposed draft's statement that no blocking code defect exists is too generous.

That disagreement is recorded, unresolved, in the document. They converged on the ground truth, the gate results, the context measurements and the original verdict — and split on merge-readiness.

## A note on this text

Identifiers belonging to the client organisation have been generalised (org prefix, repository paths). The commit SHAs that appear are the build's own commits on a private branch and identify nothing about the client. Every measurement, command, count and conclusion below is verbatim from the agents' output.

**Provenance caveat, stated up front:** the harness was killed mid-round before it wrote its final ratified artifact, so the document below is **Codex's completed revision of Claude's draft, not ratified back by Claude**. The four build rounds completed normally; only the final ratification pass was lost. Read section 1 knowing one of the two models never got to answer the other.

---

Assessed object: `infra-requests` branch `assess/kb-graphify-vs-okf` at `6fd9ac8`, covering commits `d981986..6fd9ac8` and 14 added/changed files [MEASURED]. The five source repositories matched the SHAs recorded in the index and all six worktrees were clean before and after verification [MEASURED].

## 1. Verdict on the implementation

**MERGE WITH CHANGES. Confidence: 0.93.**

The implementation correctly enumerates the current snapshot's 69 shared-module calls and 17 targets, derives useful current-HEAD module interfaces, produces deterministic output, and passes all 38 tests [MEASURED]. It is not yet safe as an authoritative knowledge substrate: three active callers are pinned to `v1.0.0`, while the query joins them to interfaces parsed only from the modules repository's current HEAD; the workflow also uses a shared, fixed `/tmp/tfindex-sources` directory that concurrent runner jobs can delete underneath each other [MEASURED from code and index]. Before merge, make interfaces ref-aware or fail closed for pinned callers, use a job-unique temporary directory, run the workflow once on Forgejo, and assign regeneration ownership [INFERRED]. The architecture does not require redesign, but the proposed draft's statement that no blocking code defect exists is too generous [INFERRED].

## 2. Gate results, re-run now

Full suite [MEASURED]:

```text
$ env TFINDEX_ORG_ROOT=<org-infra> \
    uv run --with tiktoken==0.11.0 \
    python tools/tfindex/test_tfindex.py -v
Ran 38 tests in 6.283s
OK
G6 bytes: index answer=11692 raw=85195 ratio=0.137
G6 tokens (tiktoken 0.11.0, o200k_base): index answer=2895 raw=19197 ratio=0.151
```

| Gate | Command just run | Real output | What the pass establishes and does not establish |
|---|---|---|---|
| G1 | `... test_tfindex.py TestG1CallGraphCompleteness` | `Ran 8 tests in 0.284s / OK`; `calls=69`, `targets=17`, `unresolved=0` [MEASURED] | Confirms current output against aggregate frozen counts, histograms, SHAs, and target existence. The committed gate is not an independent edge-by-edge oracle; an external `python-hcl2` comparison performed below supplies that evidence for this snapshot only [MEASURED]. |
| G2 | `... test_tfindex.py TestG2T2Completeness` | `Ran 4 tests in 0.304s / OK`; EC2 interface `30 inputs / 18 outputs / 3 required` [MEASURED] | Confirms equality to the frozen EC2 fixture, field presence, nonempty types, and description counts. It does not independently prove every type, default, or `aws_arg` value semantically correct [MEASURED]. |
| G3 | `... test_tfindex.py TestG3Determinism` | `Ran 1 test in 0.641s / OK` [MEASURED] | Byte-identical builds under `PYTHONHASHSEED=0` and `424242`, on one OS and Python installation [MEASURED]. Cross-platform identity remains `UNVERIFIED`. |
| G4 | `... test_tfindex.py TestG4FreshnessFailClosed` | `Ran 4 tests in 4.214s / OK` [MEASURED] | Covers recorded-SHA mismatch and real new commit as exit 2, index tamper as exit 3, and clean verification as exit 0 [MEASURED]. It keys module interfaces to modules-repo HEAD, not caller `ref` values [MEASURED]. |
| G5 | `... test_tfindex.py TestG5DriftDetection` | `Ran 1 test in 0.481s / OK` [MEASURED] | Adding one variable changes only the `ec2-instance` entry [MEASURED]. Removed outputs, type changes, nested files, and ref-specific drift were not exercised [MEASURED]. |
| G6 | `... test_tfindex.py TestG6ContextBudget` | `Ran 1 test in 0.159s / OK`; `2,895/19,197 tokens = 0.151` [MEASURED] | Uses `variables.tf`, `outputs.tf`, and two consumer `main.tf` files. This is narrower than the first assessment's 20,898-token EC2 baseline, which also included module `main.tf` and `versions.tf` [MEASURED]. |

Direct verification [MEASURED]:

```text
$ python3 tools/tfindex/tfindex.py verify \
    --org-root <org-infra> \
    --index knowledge/index/index.json
verify OK: 5 sources fresh, index byte-identical on rebuild
exit=0
```

The Forgejo workflow itself was not run and remains **UNVERIFIED** [MEASURED].

## 3. Ground-truth reconciliation

**Authoritative result: 69 live module calls to 17 distinct shared-module targets. The assessment's 69/17 was correct; the independent grep's 79/19 was wrong.** [MEASURED]

Raw scans reproduced the disputed numbers [MEASURED]:

```text
$ grep -rn --include='*.tf' -E \
    'source[[:space:]]*=.*infra-terraform-modules' <four consumers> | wc -l
79

$ ... | grep -cE ':[[:space:]]*#'
10

$ grep -rn -E \
    'source[[:space:]]*=.*infra-terraform-modules' <four consumers> | wc -l
83
```

Raw target extraction produced 20 strings: 17 live targets, `rds`, `ecs-cluster`, and the `<name>` placeholder; excluding the placeholder gives the earlier approximate 19 [MEASURED]. The ten non-call `.tf` hits are one header placeholder, seven commented alternative source lines inside live network blocks, and two entirely commented prod blocks targeting `rds` and `ecs-cluster` [MEASURED].

A fresh independent `python-hcl2==7.3.1` parse produced [MEASURED]:

```text
parse_errors=0 calls=69 distinct=17
styles={'git': 3, 'path': 66}
targets=aurora-postgresql,ec2-instance,ecr-repository,egress-vpc,eks-auto-mode,
ingress-alb,ingress-vpc,inspection-vpc,network-firewall,prefix-list,s3-bucket,
site-to-site-vpn,spoke-vpc,spoke-vpc-attachment,tgw-peering,transit-gateway,vpc
```

The independent records were then compared with the index by repository, file, block label, target, and source style [MEASURED]:

```text
independent_edges=69 tool_edges=69 missing=0 extra=0
```

This establishes exact current-snapshot edge agreement, not merely equal totals [MEASURED]. The first assessment reached the correct number using a line-anchored grep that happened to exclude commented source lines; its result was correct, but its derivation was less robust than the present reconciliation [INFERRED].

## 4. Does this change the original verdict?

**No. NEITHER remains the correct candidate verdict.** [INFERRED] Graphify's measured cross-repository recall remains **0/69**, because the independently verified denominator is 69 rather than 79 [MEASURED now for the denominator; Graphify result measured in the first assessment and not re-run now]. Had the denominator been 79, zero recall would still not support adoption, but that counterfactual is unnecessary [INFERRED].

The original verdict was right for its central stated reason: Graphify did not discover the required relation, and OKF supplied no Terraform producer [MEASURED in the first assessment]. Confidence in NEITHER rises from 0.90 to approximately 0.95 because the disputed denominator and exact edge set now have an independent parser cross-check [INFERRED].

## 5. What the index does that Graphify and OKF could not

| First-assessment probe | Graphify v0.9.49 | OKF v0.2 | Index as built |
|---|---|---|---|
| E7/E8: cross-repo module calls | `0/69` edges [MEASURED previously] | Links require a producer or hand authoring [MEASURED previously] | 69 current-snapshot edge records, matching the independent parser exactly; 17/17 current targets exist [MEASURED]. |
| E10: callers and EC2 interface | Eight heuristic nodes, no caller relation or complete interface [MEASURED previously] | No Terraform producer [MEASURED previously] | Two path-style callers plus 30 inputs and 18 outputs in 2,895 tokens [MEASURED]. |
| E11: `module.jumpbox` to `var.key_name` | No directed path [MEASURED previously] | Not applicable [INFERRED] | Locates `jumpbox` at line 288 and reports `key_name` plus `aws_instance.key_name`; it does not store the caller binding `key_name = var.jumpbox_key_pair_name` [MEASURED]. |
| E12: T2 fields | Names only; no type/default/description attributes [MEASURED previously] | Hand-authored storage [MEASURED previously] | 225 inputs and 169 outputs with required T2 keys; 75 inputs required, 150 optional, zero `$expr` defaults on this snapshot [MEASURED]. |
| Freshness | No measured SHA validation [MEASURED previously] | No specified producer freshness mechanism [MEASURED previously] | Exit 2 on tracked HEAD movement and exit 3 on content drift [MEASURED]. Pinned module refs are not included in freshness validation [MEASURED]. |
| Determinism | Not measured [MEASURED previously] | Not applicable without a producer [INFERRED] | Byte-identical across two processes and hash seeds [MEASURED]. |

The index solves current-snapshot derivation that neither candidate supplied [INFERRED]. It does not yet prove that a pinned caller is compatible with the current-HEAD interface returned beside it [MEASURED].

## 6. Contract coverage now

| Contract | First assessment | Index as built |
|---|---|---|
| T1 `generated-names` | Store only [INFERRED] | Not derived or stored [MEASURED]. |
| T2 `module-interface` | Graphify partially derived names; OKF stored text [MEASURED] | The static payload is substantially derivable: current-HEAD module path, inputs, types, required/default/description/`aws_arg`, and outputs [MEASURED]. The per-issue `type`/`producer_step` envelope is not emitted, and pinned-ref interfaces are not derived [MEASURED]. Therefore this is **strong partial derivation**, not a complete runtime T2 contract [INFERRED]. |
| T3 `resource-reference` | Partially derivable [INFERRED] | Output names and caller labels provide possible `module.<label>.<output>` components, but actual references, logical roles, expected types, and applied identities are absent [MEASURED]. |
| T4 `external-lookup` | Out of scope [MEASURED] | Not addressed [MEASURED]. |
| T5 `network-handoff` | Partially derivable in principle [INFERRED] | Interface names are indexed, but no CIDR, TGW, route-table, or prefix-list values are derived [MEASURED]. |
| T6 `autofix-context` | Out of scope [MEASURED] | Not addressed [MEASURED]. |
| T7 `autofix-proposal` | Retrieval support only [INFERRED] | Caller file and line improve localization, but no diagnosis, diff, safety classification, or convergence proof is produced [MEASURED]. |

Compared with the first assessment, the material gain is the static T2 payload and cross-repository call inventory [INFERRED]. No runtime contract is fully produced end to end [MEASURED].

## 7. Context-budget delta

The first assessment's script was re-run with `tiktoken==0.11.0` and `o200k_base`; every stored baseline reproduced exactly [MEASURED].

| Payload | First assessment | Re-measured |
|---|---:|---:|
| Five-repository Terraform corpus | 72,938 | 72,938 [MEASURED] |
| EC2 task baseline | 20,898 | 20,898 [MEASURED] |
| Operating documents and eight prompts | 28,307 | 28,307 [MEASURED] |
| Graphify EC2 answer | 287 | 287 [MEASURED] |
| OKF T2 index and concept | 282 | 282 [MEASURED] |
| Index EC2 query | Not available | 2,895 [MEASURED] |
| Entire generated index | Not available | 27,098 [MEASURED] |

The scoped index answer is 2,895/20,898 = **0.139**, a **7.2× reduction** against the original task baseline [MEASURED]. Against G6's narrower baseline it is 2,895/19,197 = 0.151, or 6.6× smaller [MEASURED]. It is 10.1× larger than Graphify's answer because it contains the callers and T2 fields Graphify omitted [MEASURED].

Reading the complete index costs 27,098 tokens, 30% more than the original EC2 task baseline [MEASURED]. The context benefit therefore depends on agents using `query`, not loading `index.json` wholesale [INFERRED]. These are not Claude production-tokenizer measurements [MEASURED].

## 8. Residual risk and cost

- Three active prod calls are pinned to `v1.0.0`, while every interface is parsed from modules-repo HEAD; the local modules clone contains no `v1.0.0` tag, and the tool never resolves refs [MEASURED]. Interface correctness for those callers is **UNVERIFIED**.
- Module HEAD movement invalidates the whole index even if all pinned refs remain unchanged; conversely, ref or tag movement is not part of the freshness key [MEASURED].
- The workflow's fixed `/tmp/tfindex-sources` path has no run-specific isolation or concurrency control [MEASURED]. Concurrent jobs can interfere [INFERRED].
- Any movement of the five recorded HEADs makes daily verification red until both index and fixture SHAs are updated, including changes unrelated to Terraform interfaces [MEASURED].
- Manual regeneration instructions exist in the README, but no named owner, service-level expectation, or automated regeneration PR exists [MEASURED].
- No agent or workflow consumes the index, so merging immediately adds maintenance without changing request behavior [MEASURED].
- `verify` fails loudly only when invoked; `query` does not verify freshness itself, and no future-consumer contract currently mandates verification first [MEASURED].
- The maintenance surface includes 820 lines of custom parser/generator, 688 lines of tests, an 86-line workflow, and a 112,465-byte generated artifact [MEASURED].
- Live CI duration, weekly regeneration frequency, and end-to-end agent context savings remain **UNVERIFIED** [MEASURED].

## 9. Honest defect list

1. **Pinned-ref/interface mismatch:** the query joins three `ref=v1.0.0` callers to current-HEAD interfaces instead of interfaces parsed at that ref [MEASURED].
2. **Incorrect freshness model for pinned calls:** module HEAD is tracked; caller refs and their resolved commits are not [MEASURED].
3. **Query does not verify freshness:** a stale committed file can be queried successfully [MEASURED].
4. **Shared CI temporary directory:** `/tmp/tfindex-sources` is predictable and not job-unique [MEASURED].
5. **`aws_arg` coverage is 82/225 inputs (36.4%) and 10/30 for EC2** [MEASURED]. Precision and recall were not independently evaluated and remain **UNVERIFIED**.
6. **Caller argument bindings are absent:** the index cannot answer what value a caller passes to an input [MEASURED].
7. **G1's committed oracle is aggregate and self-frozen:** CI does not run the independent parser or compare exact edges [MEASURED]. Exact edge equality was established only by this re-assessment [MEASURED].
8. **G2's semantic oracle is limited:** equality to a committed fixture and field-presence checks do not prove every extracted value correct [MEASURED].
9. **Every non-shared module is treated as unresolved, and G1 requires zero unresolved blocks:** adding a legitimate registry or repository-local module fails the gate [MEASURED].
10. **Only `*.tf` is scanned:** `.tf.json` and `.tofu` files are invisible [MEASURED]. None exists in the five repositories today [MEASURED].
11. **Recursive module scanning can conflate nested examples or test fixtures with the public module interface** [MEASURED by synthetic probe]. No such nested files exist today [MEASURED].
12. **Duplicate variable/output names are not rejected, and blocks with malformed label counts are silently ignored by interface extraction** [MEASURED by synthetic probe].
13. **Fallback expression normalization changes whitespace inside strings:** `join("  ", var.parts)` becomes `join(" ", var.parts)` [MEASURED].
14. **String decoding is incomplete:** `"\u0041"` is stored as the literal characters `\u0041`, not `A` [MEASURED].
15. **Git-source recognition does not require a `git::` URL:** `vendor/infra-terraform-modules//modules/vpc` is classified as a git source [MEASURED].
16. **Number parsing is incomplete:** signed exponent and leading-dot forms fall back rather than parsing as numeric literals [MEASURED for signed exponent].
17. **Plain-heredoc terminators use `.strip()`:** indentation can terminate `<<EOT` as well as `<<-EOT`; equivalence with Terraform was not tested and is **UNVERIFIED** [MEASURED from code].
18. **Invalid UTF-8 produces a raw decode traceback rather than a filename-qualified parse diagnostic** [INFERRED from code].
19. **Intra-repository module calls are excluded:** four calls under `infra-terraform-modules/examples/` are not indexed [MEASURED].
20. **Coverage is five repositories out of the 29-repository landscape** [MEASURED].
21. **Naive whole-file consumption is expensive:** `index.json` costs 27,098 tokens [MEASURED].
22. **The index has zero consumers** [MEASURED].
23. **G1 and G2 build with `allow_dirty=True`:** those classes do not independently enforce clean source trees; G4 carries that responsibility [MEASURED].
24. **CI downloads `tiktoken==0.11.0` at runtime:** the dependency is version-pinned but not hash-pinned and adds a network dependency [MEASURED].
25. **The clone credential is embedded in an HTTPS command-line URL:** exposure through runner process inspection remains a risk [INFERRED].
26. **Documentation overclaims:** the README labels its work as Phases 0–2 although the original Phase 1 was Graphify shadow mode, which was not built; it also says all 225 defaults are constant although only 150 inputs have defaults [MEASURED].
27. **The G6 test docstring says tokenization is conditional, but the implementation now fails when the pinned tokenizer is absent** [MEASURED].

## 10. What we did NOT verify

- **UNVERIFIED:** any live Forgejo workflow execution, including runner labels, concurrent-job behavior, secret validity, authenticated clones, `uv` availability, cron execution, and pull-request path filters.
- **UNVERIFIED:** the existence or contents of the referenced `v1.0.0` module revision; the local clone has no such tag [MEASURED].
- **UNVERIFIED:** parser equivalence with Terraform or OpenTofu across arbitrary valid HCL; no differential fuzzing was performed.
- **UNVERIFIED:** cross-platform and cross-Python byte determinism.
- **UNVERIFIED:** independent semantic correctness of all 225 types/defaults and all 82 non-null `aws_arg` mappings.
- **UNVERIFIED:** agent outcomes, shadow requests, contract mismatch reduction, or clone-and-read reduction.
- **UNVERIFIED:** Claude production-tokenizer counts.
- **UNVERIFIED:** historical branches, pending PR branches, mutable tags, and non-HEAD module revisions.
- **UNVERIFIED:** regeneration frequency, ownership load, and actual CI minutes.
- **UNVERIFIED:** Graphify/OKF capabilities not revisited from the first assessment, including licensing, security, deep extraction, and OKF conformance.

## Disagreement on record

The collaborator's proposed draft concluded that no blocking code defect existed and treated all required changes as operational [MEASURED from the proposed artifact]. This reassessment disagrees because ref-insensitive interfaces and the shared workflow directory are implementation defects that should be corrected before merge [INFERRED]. There is no disagreement on the 69/17 ground truth, the local G1–G6 results, the context measurements, or the original NEITHER verdict [MEASURED].
