# C/H/O attribution and eight additional exploratory pairs

> **HISTORICAL under `ts-evo-poc/0.8.0+chem/0.8.0`.** This panel was measured
> under the retired `ts-evo-poc/0.8.0+chem/0.7.8` engine, whose flat pool-map
> inventory the multielement C/H/O contract replaced (`CHEM-080-CONTRACT.md`).
> Nothing in this record was relabelled or retroactively certified: the strict
> `ok:false` audits it reports are the recorded verdicts of that engine, the
> first H/O failure at tick 17 is that engine's measurement, and the burial
> clamp it exposes is the defect the contract tranche repairs. The archive is
> verified as recorded under its own frozen convention
> (`scripts/chem-attribution-078.mjs`), not re-explained with the new contract.
> The current re-measurement is `CHO-080-RESULTS.md`.

Scope: Owner-authorized investigation on 2026-10-17, preregistered in
`CHO-ATTRIBUTION-PREREGISTRATION.md`. Raw record:
`evidence/cho-attribution-20261017/`. This is not held-out confirmation.

## Decision summary

**The discrepancy is not just a misleading report.** Two independently
reproduced mechanisms in the state transitions and inventory convention
explain the measured residuals. Carbon creation is state-affecting; H/O is a
reaction-versus-inventory contract inconsistency whose biological correction
depends on the accepted meaning of the pools. No biology was repaired. Diagnostic
corrections now expose the decomposition and preserve every failed strict audit.
Recommend separate repair design/approval before conservation-valid confirmation.

## Attribution, not cosmetic closure

### H/O: reaction table versus declared pool inventory

`Chemistry.elementTotal()` (`src/world/chemistry.ts`) counts each ordinary
pool only against its declared element; H2O is counted once in both H and O.
OC has C only in that inventory, and the O2 pool is counted as O, not doubled
as molecular oxygen. `REACTIONS` (`src/bio/metabolism.ts`) nevertheless carries
water/O2 transfers described in molecular/organic stoichiometric comments.
Those descriptions and this elemental pool convention are not interchangeable.

Products minus substrates, using the actual inventory mapping, yield these
unbooked element changes per unit realized extent:

| Reaction | H | O |
| --- | ---: | ---: |
| photosynthesis | -0.9 | -0.7 |
| aerobic respiration | +0.9 | +0.7 |
| nitrification | 0 | -1.8 |
| sulfur oxidation | 0 | -1.1 |
| iron oxidation | 0 | -0.35 |

The diagnosis is **internal reaction/inventory inconsistency**, not an
unrecorded reservoir top-up. The top-up and death exports remain explicit
boundary books. Unequal H/O death exports are allowed by different tissue/store
holdings; they do not imply that uptake stopped being 1:1. Five nonvacuous
one-cell reaction controls retain per-pool start/end inventories and actual
deltas with top-up, demonstrating the defect without birth/death complexity.
They do not prove every possible transfer path is correct.

Across the measured panel, H and O first fail their existing strict criterion
at tick 17 in both arms. This **does not falsify nitrification's contribution**:
it removes an O sink but does not remove respiration's H/O inconsistency.
Nitrification is neither the only cause nor a remedy for H/O accounting.

### C: burial bypasses the shared reservation

`World.chemistryBoundaries()` writes burial `-OC/+SC` into the delta buffer
without reserving that OC. Later `reactionExtent()` and `assimilate()` read
the old field minus reaction/uptake claims, not the pending burial draw.
They can use carbon already allocated to burial. `Chemistry.settle()` floors
the resulting negative OC at zero while sediment keeps its credited carbon.
That floor creates carbon; it is not an exported or harmless lost amount.

The minimal one-cell control uses the real reaction limiter and settle path:
with burial absent, no carbon is created; with burial present and respiration
taking the unreserved stock, positive carbon creation matches the OC clamp.
This is a reservation defect in the boundary phase, not evidence that the
existing reaction/assimilation gross-budget fix never worked.

First strict C failure varies by seed and occurs later than the H/O failure.
The per-tick records preserve its exact tick and chemical witnesses. These are
whole-tick live witnesses plus phase-isolating controls, **not a newly captured
full live-world per-phase history**. Source-linked ordering and the counterexample
identify an unsafe path; no claim is made that every conceivable clamp has this
unique cause.

### Quantitative check and diagnostic correction

The read-only `chem-residual-attribution.mjs` computes cumulative reaction
defects plus cumulative clamp creation. `check-cho-evidence.mjs` reconstructs
every retained tick and tests the remainder against the **existing** strict
audit criterion. It never rewrites `chemAudit`, books the defect as an external
input/output, relaxes tolerances or turns `ok:false` into conservation success.
An intentionally unbooked carbon increment is rejected. Missing completion,
raw ticks, first-failure witnesses or source integrity cannot count as passes.

The near-zero unexplained remainder supports this scoped accounting
decomposition, not uniqueness across all possible hidden transfers. No new
global conservation or fully integrated food-web claim follows.

## Eight additional matched pairs

Control → nitrification omitted; 400 founders, 1000 ticks. Seeds are reused
from the previously registered exploratory range, not selected as held-out.

| Seed | Final population | Total births | Offspring-produced births |
| --- | --- | --- | --- |
| 41003 | 18 → 14 | 33 → 36 | 0 → 6 |
| 41004 | 19 → 16 | 25 → 35 | 10 → 6 |
| 41005 | 20 → 41 | 24 → 62 | 6 → 16 |
| 41006 | 34 → 75 | 30 → 72 | 24 → 60 |
| 41007 | 9 → 12 | 5 → 16 | 0 → 0 |
| 41008 | 18 → 12 | 21 → 31 | 9 → 0 |
| 41009 | 12 → 19 | 5 → 23 | 2 → 6 |
| 41010 | 14 → 39 | 17 → 73 | 2 → 22 |

New-pair mean final population: **18 → 28.5**; mean births: **20 → 43.5**.
Births increased in every new pair, but final population decreased in three;
offspring reproduction also has negative and zero contrasts. All arms remain
below their founder population. An exploratory mean is not a success threshold,
a general effect distribution, ecological recovery or nutrient-only causation.
Energy/products, resources and later RNG feedback remain coupled.

Offspring-produced births include later descendants and use actual producing/
primary-parent birth edges, not recombinant generationDepth. Secondary genetic
ancestry is not reconstructed. Full birth graphs and cohort gate counts are
retained; proposal counts are subject-tick decisions, not unique organisms.

## Evidence, boundaries and next decision

Completed eight new pairs plus two discovery-pair replays: **20 unique runs,
40 plain/observed full-horizon executions**. Discovery hashes and births match
their frozen records. Observer run hashes match every tick, broad state/RNG
digests match at declared checkpoints, unread trace loss is zero. Per-tick raw
audits/extents/clamps are retained; all first failures have live chemical
witnesses. Chemical events were consumed losslessly for uptake totals; full
post-divergence chemistry histories were not archived. Controls and the checker
are regression evidence, not an independent replication of the panel.

The runner protocol freezes source/runtime/configuration and commands. The
compiled JS receipt was captured after launch, after a successful fresh CLI
compile; it records matching source/build hashes and freshness checks, not an
independent compiler certification or a retroactive old-log qualification.
No engine TS source or biological state transition was changed in this work.

**Separate repair decision required:** (1) establish one consistent meaning
for H/O in organic/inorganic pools and reaction transfers, including water/O2
boundary conventions; (2) include burial in the shared allocation contract.
Neither is safely fixed by relabeling the residual or adding compensating
subsidies. A state-affecting correction needs accepted semantics, a new identity
where appropriate, requalified controls and a corrected exploratory baseline.
Freeze the old discovery as historical; do not carry its effect size forward
as a confirmed expectation. If those repairs remain unresolved, stop short of
conservation-valid confirmatory demography. PR stays draft/unmerged.

## Qualification receipt

Local typecheck passed; 59/59 behavioral gates, 11/11 contracts and 157/157
workflow checks passed. W10 now invokes the attribution guard, including raw
tick replay, report-figure consistency, retained-control reruns and negative
unbooked-carbon checks. Eight discriminating controls passed. Receipts are
`attribution-check.txt`, `gates.txt`, `contracts.txt`, and `workflow.txt` in the
raw directory. No new browser behavior was introduced.

The configured review specialist was unavailable. Independent test-specialist
inspection of the actual diff, source and evidence found no blocker and
confirmed follow-up guard additions. It did not independently execute the
panel. The burial counterexample models the source-linked boundary operation;
it is not a production-call-site regression test for a future repair. A repair
must add that live-world gate, not mistake this attribution test for one.
Exact-head CI and follow-up Design review are reported on PR #14 separately.

## Continued self-audit and repair handoff

`CHO-REPAIR-DECISION-PACKET.md` specifies the proposed carbon reservation fix
and H/O alternatives without implementing them. The subsequent self-audit
also found and corrected a verifier gap: null boundary values could coerce to
zero, and stored strict-audit flags were not independently reconstructed.
The corrected checker requires complete finite numeric books, recomputes held
inventory from compartments and the exact strict reports, and checks attribution
against its terminal raw tick. Missing/corrupt/false-green and coherent-but-
unbooked records now have dedicated negative fixtures. This strengthens evidence
integrity; it does not repair the biological discrepancies or change the panel.
