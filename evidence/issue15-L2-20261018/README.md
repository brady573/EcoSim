# L2 screen — archived evidence (2026-10-18)

Execution of `docs/issue15-L2-preregistration.md` (frozen in commit `f368029`
before any L2 candidate outcome was observed). Result and classification:
`docs/issue15-L2-result.md`.

Engine `ts-evo-poc/0.6.7` (measurement-only observer release; branch
`issue15/l2-observer-rescue` from merged `main` `06be7da` / 0.6.6). Seeds
517, 41001. Horizon 750 ticks; snapshots 0/100/250/500/625/750. Candidate:
viability + `producerCaptureScale 1.0`, `nutrientFloor 0`,
`nutrientRegen 0.0002` (positive restored), `nutrientCyclic true`,
`photoObserver true`.

## Files

- `l2-screen.mjs` — read-only panel script. A-first discipline built in: arm
  A runs for both seeds and preregistered R1 is evaluated before ANY B/C
  world is constructed; the script refuses to run B/C unless its own computed
  R1 is true. No engine change, no RNG draw, no perturbation.
- `l2-screen.output.txt` — archived stdout (R1 block, twin determinism, R2
  book-delta block).
- `l2-panel.json` — machine-readable panel (per-arm per-sample census/
  uptake/energy/pools/capUtil/births/deaths/abiotic-regen cumulatives, per
  window per-guild observer stats, C-arm exogenous totals).

## Replay (clean checkout of the PR head)

```sh
npm install
npm run view:build
node evidence/issue15-L2-20261018/l2-screen.mjs
```

The script rewrites `l2-panel.json`; stdout matches the archived output.
A-twin determinism (same A config re-run, state-digest equality at t750) was
verified TRUE in a separate invocation of the same engine build and is
reported in the result doc; to re-verify it yourself, reconstruct the A
config from the JSON's `candidate` + seed field and diff `hashState()` at
750 across two runs.

## Headline (full detail in the result doc)

- **R1 (event-time producer nutrient limitation): MET on both seeds** —
  14.30% / 18.21% (seed 517) and 11.06% / 16.55% (seed 41001) of eligible
  producer-displayed photo events in the late windows (500,625] and
  (625,750] have `lim <= 0.90`, far above the 5% floor, with >=100 events per
  window, lim never exactly 0 (all partial in (0,1)), bound pools B and C
  dominating (A contributes on seed 517).
- **R2 MET** — recalcOnly lost-accepted flow across the two late windows
  1128.107 (517) / 2458.579 (41001), well above the frozen 1.0 accepted-unit
  threshold; C's same-event delivery exactness holds within C's own world
  (C exo accepted == C's own shadow−actual per window; capLoss/eviction 0 at
  t750; G35 identities green).
- **Directional mechanism pattern (B < A with C restoring): NOT
  established => INCONCLUSIVE** by the frozen rule — per-event per-pool
  uptake does not satisfy B<A on both seeds, late-window totals disagree in
  direction between seeds (B<A on 517 but B>A on 41001), and C over-restores
  on 517 (49390 above A's 48977) but falls below A on 41001. No efficacy or
  reliance claim is made; larger confirmatory study remains a future,
  separately authorized decision.
- Determinism: C twins equal (both seeds), A twin equal.
