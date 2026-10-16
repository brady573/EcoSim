# Owner-authorized D1/D2 corrections — chemistry 0.7.8

D1/D2 release identity: `ts-evo-poc/0.8.0+chem/0.7.8`; its recorded gate suite
is `gates/0.8.1`. The later research-selector suite is `gates/0.8.2`; that
does not relabel these original qualification receipts.
Authority: https://github.com/brady573/EcoSim/pull/14#issuecomment-6193809477 .
D1/D2 were already authorized on 2026-10-15. Prior statements that approval
was pending were incorrect and are superseded, not treated as new Owner gates.

## Changes, separately tested

**D1:** `grow()` converts each element's fraction of the requested complement
to carbon moles before applying the matter/energy minimum. Every element of
the assembled tissue and every corresponding store debit are checked.
Requests below and above one mole are covered, with partial P/Fe, absent Fe,
abundant matter, energy limitation, conservation and no double spending.

**D2:** `canAffordOffspring()` uses the already-scaled macronutrient demand
once. Carbon and trace-cofactor reserve retain their existing linear contracts.
Below/exact/above thresholds are checked separately for C/N/P/S/Fe at scales
0.5, 1 and 2. Default 1 is unchanged by D2. Negative/non-finite world demand
inputs now throw; explicit zero retains the zero-demand diagnostic endpoint,
while null retains the declared default of 1. No nominal threshold was
lowered as a rescue.

The two corrections share one chemistry identity transition and qualification
panel; their distinct D1/D2 case records are retained separately in the raw
targeted output. There is no intervening unqualified biological checkpoint.
No nitrogen/iron pathway, founder distribution or offspring provisioning
allocation was implemented. D3–D5 accepted directions retain their explicit
experiment, cost/allocation and parameter-review gates.

## Targeted results

Raw targeted cases: `evidence/chem078-final-targeted-20261015.jsonl`.
The table is rounded to 12 significant digits; raw doubles are retained.

| D1 case | Requested carbon | Built carbon |
| --- | ---: | ---: |
| half-P | 0.012 | 0.006 |
| half-Fe | 0.012 | 0.006 |
| absent-Fe | 0.012 | 0 |
| abundant | 0.012 | 0.012 |
| energy-limited | 0.012 | 0.003 |

G48 checks D1 helper postconditions; G49 checks D2 boundaries and input
rejection; G50 observes live tissue/store deltas and actual energy debits.
Legacy energy storage is Float32, so its net debit is checked against the
actual rounded subtraction. The Float64 chemical flux and causal ledger
must separately equal the cost of valid tissue. The difference between
summed Float32 net debits and booked Float64 cost is bounded explicitly by
storage rounding, not misreported as exact equality or uncharged growth.

## Narrow matched follow-up

Final-source panel: `evidence/chem078-final-20261015/` (protocol, source digests, exact
resolved configurations, trajectories, repeat records and completion marker).
This uses only the first two already registered factorial seeds, not a new
seed search or broad cohort. The initial correction and input-guard candidate
runs are also retained in `evidence/chem078-correction-20261015/` and
`evidence/chem078-qualified-20261015/` with their actual source manifests.

| Seed | Arm | Historical population | New population | Historical births | New births |
| --- | --- | ---: | ---: | ---: | ---: |
| 41001 | legacy | 894 | 894 | 1498 | 1498 |
| 41001 | advanced | 12 | 13 | 28 | 31 |
| 41002 | legacy | 1095 | 1095 | 1691 | 1691 |
| 41002 | advanced | 11 | 8 | 25 | 17 |

Historical rows retain `chem/0.7.7`; new chemistry rows use `chem/0.7.8`.
Legacy controls must exactly match their prior deterministic records; each
new run and trajectory must repeat exactly. D2 is defaulted to 1 in this
panel, so it is not evidence about nondefault dial effects. The directions
of population changes differ between seeds. These are qualification runs,
not a distribution verdict, survival improvement or reaction-level cause.

**Global accounting limit:** both historical and new sampled chemistry runs
retain C/H/O `ok:false` flags in the raw strict elemental audit. These flags
already existed before D1/D2; their attribution was not reinvestigated here.
Passing the scoped gates and the local growth-conservation postconditions is
NOT certification that every strict world-level elemental audit closes.
The complete before/after residual records are preserved in `comparisons.jsonl`.

## Engineering qualification

Local typecheck and both CLI/app builds are clean. Results: **58/58 gates**,
**11/11 contracts**, **157/157 workflow fixtures**, all four headless viewer
modes, and eight trace on/off/repeat cases passed. Final panel runs and sampled
trajectories repeat exactly; both chemistry-unset historical controls match.
The final panel's 75 source digests were recomputed against the working tree
and matched. The portable artifact was rebuilt from `tsconfig.app.json`
separately before assembly; bundle/CLI parity checks passed.

Receipts: `evidence/chem078-final-gates-20261015.txt`,
`evidence/chem078-final-contracts-20261015.txt`,
`evidence/chem078-release-workflow-20261015.txt`,
`evidence/chem078-final-viewer-20261015.txt`,
`evidence/chem078-boundary-20261015.jsonl` and
`evidence/chem078-historical-refusal-20261015.jsonl`.
New-head CI/browser execution is reported separately on the PR, not inferred
from these local checks.

## Historical record and remaining scope

Chemistry-unset parity remains P503/C126/D69 (517) and P337/C119/D95 (24601).
All old chemistry cohorts, the factorial panel and family histories remain
historical under their recorded `chem/0.7.7` identity. Historical replay
scripts refuse a mismatched engine and direct users to source `8fddb08`.
W10 preserves their figure pins separately from the live correction evidence.
No broad ecological verdict is requalified by targeted tests or green CI.

PR stays draft/open/unmerged. The subsequent experiment-only D3/D4 selector
was accepted in review 5540863270 and its isolated rapid trials are recorded
in `RXOMIT-RAPID-RESULTS.md`. Permanent physiology, broader causal attribution,
D5a frequencies and D5b provisioning allocations remain outstanding. Issue
#15 O3/Gate 1/O1/Gate 2/O2 is separate; these trials promote none of its gates.
