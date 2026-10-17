# Rapid process omissions — two seeds, descriptive only

Approval: PR #14 review 5540863270 and Owner request. Original predeclaration:
`939575c:D3D4-SELECTIVE-PREREGISTRATION.md`. Source/config/runtime/commands and
77 measured source digests are in `evidence/rxomit-rapid-20261016/protocol.json`.

Eight primary arms reached 1000 ticks with 400 founders at registered seeds
41001/41002. Each was executed untraced and traced (16 full-horizon primary
executions). Six additional null-selector prefix references ran only until
first divergence, at tick 17 in each case; they are separate from the primary
execution count. No combined arms or permanent physiology was implemented.

## Recorded outcomes

`iron uptake` below names the environmental Fe2→OFE reaction; actual organism
Fe uptake is retained. N/Fe columns are cumulative actual assimilation credits
(mol), rounded for display; no nutrient subsidy was enabled.

| Seed | Omitted reaction | Population | Births | N uptake | Fe uptake |
| --- | --- | ---: | ---: | ---: | ---: |
| 41001 | control | 13 | 31 | 129.143 | 0.145717 |
| 41001 | nitrification | 26 | 44 | 1592.924 | 0.179789 |
| 41001 | iron oxidation | 10 | 27 | 124.491 | 0.214211 |
| 41001 | iron uptake | 24 | 45 | 136.132 | 4.561395 |
| 41002 | control | 8 | 17 | 119.038 | 0.112472 |
| 41002 | nitrification | 40 | 60 | 1634.584 | 0.122449 |
| 41002 | iron oxidation | 31 | 59 | 124.859 | 0.220355 |
| 41002 | iron uptake | 26 | 71 | 130.778 | 3.998336 |

## What passed, and what is not a causal conclusion

Runtime integrity passed: per-tick observer state/RNG hashes, broad checkpoint
digests, no unread ring loss, exact null-control replay against qualified
0.7.8 states, and target extent zero in every omission. All six corresponding
control target activities were non-zero: none of these contrasts was vacuous.
First-divergence witnesses start from matched broad state excluding only the
selector's two representations and standard timing/diagnostic fields.

The recorded outcomes show increased N credit in both nitrification-omission
runs and increased Fe credit in both OFE-omission runs. They are consistent
with the measured reaction/uptake competition, but they do not quantify a
nutrient-only demographic cause. Omission also removes the target's energy
income/products; later resources, populations and RNG trajectories diverge.
Iron-oxidation omission has mixed demographic directions. No ecological
success threshold was preregistered; no distribution verdict, permanent
physiology recommendation or integrated-food-web success follows from n=2.
Every arm ended below its founding population, although none ended at zero.

## Raw measurement and trust boundaries

Review follow-up: `RXOMIT-DESCENDANT-SCOREBOARD.md` derives actual descendant
births and cohort proposal-gate counts from these retained archives, without
new simulations. The demographic integrity guard accepts both extinction and
growth; historical table pins check quoted figures, not desirable outcomes.

Per-arm `*-events.jsonl.gz` files retain every reached reproductive decision,
queue/admission outcome, the fixed chemical samples and first-divergence
chemical witnesses. Unreached gates are not passes. Pair-level mating
rejections are not counts of exclusive individual blockers. Full cumulative
chemical extent/gross/uptake totals come from lossless runtime consumption;
sparse raw chemistry samples cannot independently reconstruct those totals.
The guard reconstructs gate counts and queue/admission closure, checks sampled
gross books and cumulative lower bounds, and validates identities/configs.

Inherited strict C/H/O accounting remains an open separate issue. All raw
audit fields are retained; scoped gates and observer parity do not certify
global mass closure. `CHO-CLOSURE-INVESTIGATION-PLAN.md` is a plan only.
Complete chemical life histories or death-cause attribution are not claimed
from this archive. D5 provisioning/frequencies and permanent D3/D4 costs,
genetics and allocation rules remain outside these trials.

Independent code/evidence review found no material blocker before this
descriptive interpretation. Local qualification passed typecheck, CLI/app
builds, 59/59 gates, 11/11 contracts, eight observer/repeat cases and all four
headless viewer modes. W10 streams the full archive and rejects missing
completion, wrong selectors, corrupt gzip and missing gate records; the
workflow fixtures passed 157/157. Receipts are `evidence/rxomit-*-20261016.txt`
and `evidence/rxomit-boundary-20261016.jsonl`. New-head CI is reported separately;
no merge, combined-arm trial or later research-stage promotion is granted.
