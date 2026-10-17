# L1 screen — archived evidence (2026-10-17)

Execution of `docs/issue15-L1-preregistration.md` (frozen in commit `d972ed0`
before any candidate outcome was observed). Result and classification:
`docs/issue15-L1-result.md`.

Engine `ts-evo-poc/0.6.6` (PR #19 accepted O2 head). Seeds 517, 41001.
Horizon 500 ticks; samples t0/t100/t250/t500. Candidate L1 = viability +
`producerCaptureScale 1.0`, `nutrientRegen 0`, `nutrientFloor 0`.

## Files

- `l1-screen.mjs` — read-only panel script (no engine change, no RNG draw,
  no perturbation). Portable, repository-relative compiled imports.
- `l1-screen.output.txt` — archived stdout (per-arm, per-sample text).
- `l1-panel.json` — machine-readable panel (censuses, producer-displayed
  uptake, producer energy, local-limitation statistics, pool stocks/capUtil,
  births, DIRECT deaths by guild/cause, O3 per-class/source accepted returns,
  lost flow per pool, exogenous books, abiotic regen, twin-digest flags).

## Replay (clean checkout of the PR head)

```sh
npm install
npm run view:build
node evidence/issue15-L1-20261017/l1-screen.mjs
```

The script rewrites `l1-panel.json`; stdout matches the archived output.

## Headline (full detail in the result doc)

- **R1 local-limitation reachability: NOT MET** under the frozen rule
  (>= 5% of alive producer-displayed organisms with an empty affinity pool at
  both t250 and t500): 0.00-2.18% at t250, 17.07-31.82% at t500.
- Preregistered **STOP-A** executed: no second candidate, no tuning, no
  threshold shift, no B/C expansion.
- **H-L1 NOT EVALUATED** (conditional on R1).
- Arm C is bit-identical to arm A at every declared sample on both seeds:
  with `nutrientRegen = 0` the cyclic term is inert, so exact same-event
  replacement restores the suppressed world exactly — an instrument result,
  not biology.
- Disclosed defects: single-pass execution order (B/C ran before R1 was read);
  prereg rationale wrongly claimed the cyclic path stays live under
  `nutrientRegen 0`; R1's window is timescale-mismatched to when limitation
  actually appears here.