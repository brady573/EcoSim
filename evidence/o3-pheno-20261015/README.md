# O3 Gate-1 evidence (Tier-0+O3, 2 seeds, read-only demonstration)

Engine source base SHA in source-base-SHA.txt (`8956699`; O3 working tree adds
only the files in its PR — no biology/knob/RNG changes). Engine identity after
the change: `ts-evo-poc/0.6.4`, gates `gates/0.6.0` (measurement-only re-base,
same parity pair).

## Replay (clean checkout of the PR head)

```sh
npm install
npm run view:build
node evidence/o3-pheno-20261015/pheno-demonstration.mjs
```

Compiled build used; never `tsx` for horizons.

## What the archived output shows (NOT a biological verdict)

- `bioticMineralizationByPheno[4][3][3][3]` present with correct shape, both seeds.
- Event-flux (accepted) by class @500t viability:
  seed 517 — carrionOnly 124.9 / recalcOnly 1302.8 / dual 128.8 / neither 0.0
  (total 1556.6; recalc-branch event flux ≈ 92%, vs 42.5% CONSUMER-displayed
  share — different instruments, as the withdrawn O1 prediction confused);
  seed 41001 — 42.7 / 2730.7 / 193.1 / 0.0 (total 2966.4).
- Reconciliation guild==sum(classes) worst residual ~1e-13 (G32 bound 1e-6×);
  neither share 0.00% (reported, not asserted).
- Twin-run new-book mismatches 0; trajectory digests equal.
- Standing validation on the same tree: typecheck clean, 41/41 gates (incl. G33),
  11/11 contract (C1 pins 517→P882/C170/D65, 24601→P563/C279/D90 unchanged),
  154/154 workflow. See the PR body for SHAs and CI run.

## Pre/post-mirror nonperturbation A/B (local cross-worktree check)

`ab-063-064-digest.mjs` steps the pre-mirror 0.6.3 build
(`/root/EcoSim-issue15/build`, source 8956699) against this tree's 0.6.4 build
with identical viability config, seeds 517/41001, 500 ticks. Device-local paths
— NOT clean-checkout replay; the archived output is the observation:
5 trajectory digests equal per seed, all pre-existing guild books elementwise
identical (mismatches 0), census identical. Third nonperturbation leg alongside
C1 pins and code inspection.
