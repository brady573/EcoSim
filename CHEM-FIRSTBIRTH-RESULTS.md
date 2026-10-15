> HISTORICAL under `chem/0.7.7` after the D1/D2 transition. Figures unchanged.
> Replay requires matching source at `8fddb08`, not the current engine.

# Chemical endowment and first birth — one-seed witness

Identity: `ts-evo-poc/0.8.0+chem/0.7.7`, advanced arm, seed 41001,
400 founders, horizon 1000 ticks. No biology changed.

Raw evidence: `evidence/chem-firstbirth-41001-20261015/`.
The protocol preceded discovery/measurement. Baseline discovery identified
every actual offspring and its parent, then the traced replay retained all
their chemical birth transfers, pre-check affordability observations and
deaths. Relevant rings were drained every tick with an unread-loss assertion;
ordinary hashes matched every tick, broad state/RNG digests matched at the
specified checkpoints, and the final hash matched the factorial panel.
`families.jsonl.gz` contains the complete retained event records for these
selected individuals; `life-summaries.json` derives their timing observations.

## Measured, not inferred from generation depth

| Selected cohort | Individuals | Ever matter-affordable | Ever mature and matter-affordable | Ever actually produced offspring | Dead by horizon |
| --- | ---: | ---: | ---: | ---: | ---: |
| founders | 3 | 3 | 3 | 3 | 3 |
| offspring | 28 | 8 | 8 | 0 | 19 |

The three successful founders first produced offspring at ticks **241, 267, 295**.
All births in this run were their offspring. No selected offspring produced a
further child during the observed horizon. This conclusion comes from actual
parent/child events, NOT the recombinant-only generation counter.

Each child received conserved parent tissue and zero nutrient stores at the
chemical transfer boundary; the parent's stores were unchanged. Energy
provisioning occurs later and is **not** measured as part of this endowment
record. Subsequent affordability observations include tissue/store evolution,
but matter+maturity is not full breeding eligibility: cooldown, energy
fraction, damage, surplus, mating availability, admission and later viability
are not collectively established by these two conditions.

The observed affordable/mature offspring mean that an absolute claim that
offspring **never** refill enough chemical matter is false for this witness.
This does not rule out a severe, time-dependent matter bottleneck or quantify
its demographic contribution. We did not intervene on endowment or physiology.

## Selection and generality limits

The selected founders are exactly those that actually reproduced. This is
outcome-dependent sampling, not a representative sample of founders or a
population-wide breeding success rate. Offspring are observed only from birth
to death/horizon. Missing first-birth times for survivors are right-censored;
dead offspring were observed not to breed during their entire lifetimes.
Readiness is a pre-check observation, not proof that a breeding
attempt reached or passed every downstream gate. No universal extinction or
sustained food-web conclusion is supported by this one seed.

## Replay

After `npm run view:build`, run
`node scripts/chem-firstbirth-panel.mjs --out NEW_DIRECTORY`.
Output cannot overwrite an existing directory. Exact resolved configuration,
source panel and command are recorded in the protocol. The completion marker
requires non-vacuous births, all selected lifetime gate observations, flushed
compressed data and the matching final state.
