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

## What the archived output shows (NOT a rescue-efficacy verdict)

Matched A/B/C @500t viability, suppression `{recalcOnly:0}` + rescue
`{recalcOnly:true}`:
- Delivery: exogenous accepted 1175.8 (517) / 2897.9 (41001) at the suppressed
  events' cells/ticks/pools; C-twins 0 mismatches, digests equal;
  null-rescue parity equal.
- Populations retained on all arms (e.g. 517: A P267/C102/D88, B P278/C85/D70,
  C P278/C82/D78).
- Producer photo uptake (A/B/C): 517 within ±2%, 41001 within ±4% — no
  measurable mediation signal in this stratum/interval. The delivery
  instrument is proven (G35); the biology answers without a detectable rescue
  effect here. That is a null observation, not a failed measurement and not a
  reliance verdict in either direction.
- abioticRegen moves with trajectories (confounded) — reported, never a
  mediation coefficient.
- Standing validation: typecheck clean, 43/43 gates (incl. G35), 11/11
  contract (C1 pins unchanged), 154/154 workflow.
