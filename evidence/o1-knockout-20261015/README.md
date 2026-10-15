# O1 Gate-2 evidence (Stage 2, 2 seeds, read-only demonstration)

Engine: `ts-evo-poc/0.6.4` (O1 knob null-default; no version change), gates
`gates/0.7.0` (G34). Engine source base: O3-accepted `2f4c2b2`; this stage adds
only the O1 knob + G34 (see PR).

## Replay (clean checkout of the PR head)

```sh
npm install
npm run view:build
node evidence/o1-knockout-20261015/o1-demonstration.mjs
```

Compiled build used; never `tsx` for horizons. SHAs in `ab-SHAs.txt` pattern:
baseline O3 source `2f4c2b2`, candidate this PR head (`git rev-parse HEAD`).

## What the archived output shows (NOT a biological verdict)

Suppress `{carrionOnly:1, recalcOnly:0, dual:1}` @500t viability:
- seed 517: recalc accepted 1302.8 → exactly 0.0 (deficit 1302.8);
  carrionOnly 124.9 → 41.9, dual 128.8 → 145.8 (untargeted continue;
  levels differ — trajectories diverge once offers differ, no claim beyond
  the deficit identity); neither 0.0 both arms.
- seed 41001: recalc 2730.7 → 0.0 (deficit 2730.7); others continue.
- Cyclic feedback distinctly: abioticRegen 7.08 → 0.82 (517), 11.27 → 1.00
  (41001) — coupled mineralisedCell flux collapses with suppressed offers,
  recorded separately, no direction asserted as a law.
- Populations retained: P278/C85/D70 (517 SUPP), P203/C150/D104 (41001 SUPP) —
  suppression is not extinction by construction.
- null knob digest == unset digest (both seeds); twin runs identical incl. new
  books.
- Standing validation on the same tree: typecheck clean, 42/42 gates (incl. G34),
  11/11 contract (C1 pins unchanged), 154/154 workflow.
