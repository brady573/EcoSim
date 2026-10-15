# E15-PILOT-0 feasibility scratch (UNREGISTERED, NOT a verdict) + A2 reachability (Tier-0)

Engine: ts-evo-poc/0.6.3. Engine source SHA in source-SHA.txt
(`8956699fa28497993fb58fb6b455130daf778777`); engine source unchanged —
working tree adds only docs/ + this evidence dir. Evidence scripts are versioned
at the PR head; verify with `git rev-parse HEAD` and `git log --oneline -3`.

## Portable replay (clean checkout)

All three scripts use repository-relative compiled imports (`../../build/...`),
so they replay from any checkout of this revision:

```sh
npm install
npm run view:build
node evidence/issue15-pilot-scratch-20261015/mini-flux.mjs
node evidence/issue15-pilot-scratch-20261015/mini-attrib.mjs
node evidence/issue15-pilot-scratch-20261015/a2-reachability.mjs
```

- `mini-flux.mjs` — 500 ticks, seeds 517/41001, CONTROL/NO_BIO/NO_EXCR (6 worlds).
  Verified portable replay reproduces the six archived rows byte-identically
  (hashes e4211a02/0ff04fa3/921099e7, b93a97b3/3df4e8b2/686685df).
  Measured wall time on this device: ~5.0 s per 6-world run including node
  startup (~0.84 s/world); CI hardware differs — treat as budget formula input,
  not a pinned constant.
- `mini-attrib.mjs` — 500 ticks, seed 517: per-guild accepted bio flux
  (662.0 CONSUMER-displayed + 894.6 DECOMPOSER-displayed = 1556.6), live
  mineraliser census 134 = 0/46/88 P/C/D, pool totals, hash-read nonperturbation.
  Census denominators are headcounts, NOT flux — see prereg for the distinction.
- `a2-reachability.mjs` — A2 candidate (floor 0 + rain 0) reachability:
  6 configs × 2 seeds @500t, 3 trajectories × 2 seeds @2000t (t500/1000/1500/2000),
  disjoint phenotype-branch census (carrionOnly/recalcOnly/dual/neither from
  `role.ts:208-211` qualifiers), PA2 positive control, N repeat determinism,
  observer-read nonperturbation at A2. Wall time on this device: ~26–37 s total
  (see archived `elapsed` line; varies with contention).
  Headline: A2 NOT limiting at 500t (util 0.52–0.53 both strata; photo −3–4%);
  harsher over 2000t (util →0.43–0.46; photo −23–25% vs A; extinctions incl.
  full B1A2 collapse seed 41001) but B1-vs-A2 contrast seed-inconsistent
  (−16% seed 517, +7% seed 41001) and confounded (cyclic off-target + collapse
  dynamics). Valid outcome: do NOT proceed to 12+24 on this regime; test-design
  decision returned in the prereg.

Compiled build used (`node build/...`, `npm run view:build`); never `tsx` for
horizons. Raw outputs archived alongside scripts. Apparatus checks only
(knockout reaches site, arms differ, controls behave); not preregistered,
not cohort evidence, never a biological verdict.
