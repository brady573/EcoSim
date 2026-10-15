# Matched four-arm panel — descriptive result

Identity: `ts-evo-poc/0.8.0+chem/0.7.7` (chemistry arms);
`ts-evo-poc/0.8.0` (chemistry unset arms). No biology changed.

Raw panel: `evidence/mechanism-four-arm-20261015/`.
Protocol was written before stepping. All 72 unique runs completed at 1000
ticks, 400 founders, seeds 41001–41018. Both factors are explicitly resolved;
every other configuration key is matched per seed. All 36 repeated historical
legacy/advanced controls matched their deterministic records exactly.

| Arm | Mean population | Median population | Total births | Seeds at zero population |
| --- | ---: | ---: | ---: | ---: |
| legacy | 810.56 | 764 | 27985 | 0/18 |
| genome-only | 204.39 | 165 | 8097 | 0/18 |
| chemistry-only | 17.50 | 17.5 | 0 | 0/18 |
| advanced | 12.67 | 11.5 | 317 | 0/18 |

## Interpretation limits

The decline is not exclusive to the joint chemistry+Genome V2 arm. Neither
factor can be ignored in the mechanism audit. The chemistry-only arm produced
no births, but chemistry without Genome V2 also lacks module-enabled metabolic
capabilities: that arm is NOT an independently viable replacement metabolism
whose performance can be attributed to one contested nutrient reaction.

This is a descriptive factorial comparison, not proof of a nutrient-pathway
cause, a successful ecology or a statistically certified interaction effect.
Knobs consume different random draws; matched seeds do not hold stochastic
trajectories fixed. No seed reached population zero at this horizon; severe
decline and failed replacement must not be called literal universal extinction.

`maxLiveGenerationDepth` retains its existing narrow meaning: recombinant
offspring depth, not a complete count of asexual succession. No lineage-depth
verdict is made. Passive live evidence is documented in
`CHEM-BOUNDARY-INSTRUMENT.md`; proposed decisions are in
`MECHANISM-OWNER-DECISIONS.md`. Selective reaction interventions and Owner
acceptance of altered biology remain outstanding.

## Replay

Compile with `npm run view:build`, then run
`node scripts/mechanism-four-arm.mjs --out NEW_DIRECTORY`.
An existing output is refused. Completion requires every recorded run and all
historical-control comparisons; timings are not part of the measured record.
