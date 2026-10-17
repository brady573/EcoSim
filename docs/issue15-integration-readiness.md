# Integration readiness inventory — #17 -> #18 -> #19 (administrative only)

> **No merge, no auto-merge, no draft-flip, no retargeting, no history rewrite,
> no main change is performed or authorized by this document.** It is the
> separately authorized administrative preparation: dependency order, conflicts,
> merge readiness, and the regression-check plan a merge would require.
> Scientific feasibility (the L1 screen result) is a SEPARATE question from
> integration readiness and is not decided here.

## 1. Branches and accepted review anchors

| PR | Branch | Accepted head | Engine | Role |
|---|---|---|---|---|
| #17 | `issue15/o3-phenotype-flux` | `2f4c2b2` (Gate 1) | 0.6.4 | phenotype books + G33 |
| #18 | `issue15/o1-pheno-knockout` | `a156490` (Gate 2) | 0.6.5 | suppression knob + G34 + shadow |
| #19 | `issue15/o2-exogenous-rescue` | `1893782` (Stage 3) | 0.6.6 | rescue knob + G35 |
| #14 | `integrated-biogeochemistry` | `3346e5c` | 0.7.x | **NOT in this stack** |

All three share merge-base `8956699` (current `main`). None has been merged;
all three remain draft. `origin/main` is still `8956699`.

## 2. Dependency order and why it is strict

Each branch's PR base is the previous branch, and each later engine step reads
state the earlier step introduced:

- #18 reads the O3 books (`getFluxSnapshot().bioticMineralizationByPheno`) and
  the shared `ceilingOutcome` helper added by #17.
- #19 reads the O3 shadow books and the O1 `acceptedAmt` return value, and its
  G35 asserts identities over all four book families.

Out-of-order merges would leave `getFluxSnapshot` without fields that later
code destructures. Merge order must therefore be #17 -> #18 -> #19, each
rebased or merged on the previous, with `main` updated between steps only under
explicit Owner approval.

## 3. Conflict surface

Every layer touches the same seven "hot" files: `src/world/world.ts`,
`src/world/version.ts`, `src/gates.ts`, `src/world/config.ts` (from #18 on),
`AGENTS.md`, `REPORT.md`, `scripts/contract-checks.mjs`, plus the rebuilt
bundle `evidence/app/evo-sim-poc.html`.

Consequences:

- **Source conflicts are expected** on world.ts/version.ts/gates.ts because each
  layer appends to the same regions (book arrays, snapshot builder, gate main()).
  These are additive and should resolve mechanically, but `version.ts` constants
  and `GATE_SUITE_VERSION` are single-line values that MUST take the newest
  value (0.6.6 / gates/0.8.0) — a silent "keep ours" would mislabel every run.
- **`evidence/app/evo-sim-poc.html` is a generated bundle**: it must be
  REGENERATED (`npm run build:app`) after the final merge resolution, never
  hand-merged. A stale bundle would pass C5 only if the keys happen to survive;
  C4 compares bundle vs CLI, which is the real guard.
- **Doc files (`AGENTS.md`, `REPORT.md`, contract-checks comments)** carry the
  retirement chain and per-version statements; the merged text must describe the
  0.6.4/0.6.5/0.6.6 progression in order, and the retired-pair list must not
  lose entries.

## 4. Merge readiness checklist (what a merge would need)

1. All three PRs explicitly approved for merge by the Owner (none currently is;
   all three carry scoped, draft-preserving approvals only).
2. A single integrated branch (e.g. `integration/issue15-o3-o1-o2`) built by
   stacking #17 <- #18 <- #19, resolved, then re-validated as a unit.
3. Regenerated `evidence/app/evo-sim-poc.html` from the resolved tree.
4. Version constants verified to read 0.6.6 / gates/0.8.0 in the merged
   `version.ts` and in every live label.
5. The L1 prereg/result docs and the three evidence dirs retained unmodified.
6. No PR #14 chemistry files pulled in.

## 5. Regression-check plan for the integrated tree (to run ONCE, after merge)

Narrow first, then the standing suite:

1. `npm run typecheck`
2. `npm run view:build` then `node scripts/contract-checks.mjs .` — C1 parity
   (517 -> P882/C170/D65, 24601 -> P563/C279/D90 @500 ticks; NO re-pin), C4
   bundle-vs-CLI, C5 key presence (9 keys), C7 repeat determinism.
3. `npm run build:app` then re-run `npm run contract` so C4/C5 test the freshly
   built bundle, not the pre-merge one.
4. `npm run gates` — expect 43/43 including G33/G34/G35.
5. `npm run workflow` — 154/154 evidence fixtures.
6. Re-run the three portable evidence scripts (`o3/ab-063-064-digest.mjs`,
   `o1/o1-demonstration.mjs`, `o2/o2-mediation.mjs`) and confirm the archived
   outputs still reproduce.
7. Re-run `evidence/issue15-L1-20261017/l1-screen.mjs` ONLY if the integrated
   engine differs from 0.6.6; otherwise reuse the accepted L1 archive unchanged.

No G26-G35 / W9 / old costly panel is re-run absent a typed invalidation: all
three layers are null-default and the pins above are the typed invalidation
guard.

## 6. What is explicitly NOT authorized here

Merging, auto-merge, draft-state changes, branch retargeting, history/squash
rewrites of historical evidence, and any change to `main`. Any second
nutrient-limitation candidate, any broader study, or any new biological
semantics must be submitted as one consolidated Owner decision.