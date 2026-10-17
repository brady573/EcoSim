# O2 evidence (Stage 3, 2 seeds, read-only mediation observation)

Engine: `ts-evo-poc/0.6.6`, gates `gates/0.8.0` (G35). Baseline: O1
Gate-2-accepted source; this stage adds only the O2 rescue knob, G35, REPORT
entry and this evidence dir.

## Replay (clean checkout of the PR head)

```sh
npm install
npm run view:build
node evidence/o2-rescue-20261016/o2-mediation.mjs
```

Compiled build used; never `tsx` for horizons. SHAs in `o2-SHAs.txt`:
baseline O1 source, candidate this PR head (`git rev-parse HEAD`).

## What the archived output shows (arm-by-arm description; NO verdict)

Matched A/B/C @500t viability, suppression `{recalcOnly:0}` + rescue
`{recalcOnly:true}`. Two seeds only, no uncertainty or detection threshold is
estimated, and no post-hoc effect threshold is applied.

- Delivery: exogenous accepted 1175.8 (517) / 2897.9 (41001) at the suppressed
  events' cells/ticks/pools; C-twins 0 mismatches, digests equal;
  null-rescue parity equal. Populations retained on all arms.
- Producer-DISPLAYED photo uptake t500 (per pool A/B/C):
  517 — A [3230.6,3083.4,2906.4], B [3295.9,3072.4,3046.0],
  C [3330.3,3023.3,2996.1];
  41001 — A [2733.1,2671.7,2769.8], B [2797.8,2792.6,2915.3],
  C [2835.1,2718.3,2945.4].
  (Consumer/decomposer-displayed uptake is 0.0 in this config, so the
  all-guild aggregate coincides numerically — it is still labeled all-guild,
  never producer uptake.)
- Producer energy t500: 517 — A 3733.3, B 4167.2, C 3943.5;
  41001 — A 3005.9, B 3142.1, C 3032.3. Suppressed-B reads HIGHEST on both
  seeds — heterogeneity, not a dose-response curve.
- Realized births (placed, cumulative t500, P/C/D): 517 — A 161/123/42,
  B 166/92/24, C 170/86/32; 41001 — A 83/235/80, B 102/168/61,
  C 91/247/101. Census trajectories at t0/t100/t250/t500 plus deaths per
  interval via the engine's DIRECT `World.demographics().deaths` counters by
  guild and cause (starve/age/damage) are in the raw output, cross-checked
  against the aggregate census+placed identity (they agree exactly here; the
  identity would additionally assume no inter-guild role reclassification).
- Demographics diverge markedly in places (41001 B P203/C150/D104 vs
  C P210/C242/D144) for reasons the code and reports do not establish.
- abioticRegen moves with trajectories (confounded) — reported per pool,
  never a mediation coefficient.

**Verdict: two-seed descriptive outcomes mixed/heterogeneous; producer
nutrient-mediated benefit or reliance INCONCLUSIVE.** The delivery instrument
is proven (G35); the biology neither confirms nor denies mediation here.
- Standing validation: typecheck clean, 43/43 gates (incl. G35), 11/11
  contract (C1 pins unchanged), 154/154 workflow.
