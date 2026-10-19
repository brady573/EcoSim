# `chem/0.8.1` correction — nitrification isolated, preregistered replay

Status: **PREREGISTERED, THEN MEASURED.** The predictions and falsifiers below
were frozen in `scripts/cho-081-trials.mjs` before any run of this replay; the
Results section was appended only after the raw archive existed on disk
(`evidence/cho-081-20261019/`, `complete.json` written by the runner).

## What this replay corrects

The Owner review of PR #14 (2026-10-18, head `066d55b`) found one material
mechanism departure: at `chem/0.8.0` the nitrification pathway remained live
with its oxygen reduced to a presence gate while the reaction still earned
energy and converted NH4 → NO3 — an oxygen-consuming pathway drawing no booked
oxidant. Under the composition vocabulary the pathway cannot be balanced
honestly: NH4 and NO3 are single-element nitrogen carriers, so the oxidant draw
has no product to reach; changing either carrier breaks denitrification (its
only consumer would need ~15 C per 2 NO3 to shed the oxygen) or the sediment
release path (H manufactured from nothing).

Per the review's accepted fallback, the pathway is **isolated as
unsupported/disabled** in `chem/0.8.1`: it is absent from the live reaction
network and preserved in `ISOLATED_REACTIONS` with its historical
stoichiometry. `CAP.NITRIFY` remains heritable but inert; a future nitrification
pathway requires an explicit Owner decision on vocabulary.

Identity: `ts-evo-poc/0.8.0+chem/0.8.1`; the retained selector arm is
`ts-evo-poc/0.8.0+chem/0.8.1+rxomit/1/nitrification`. Raw archive:
`evidence/cho-081-20261019/` (`protocol.json`, `summary.json`,
`arm-identity.json`, `cross-version-contrast.json`, `isolation-witness.json`,
`one-cell-controls.json`, per-run config/result/ticks/witnesses).

## Frozen selection (before outcomes)

- Seeds: `41001, 41002` — the recorded discovery replays, same seeds and same
  400 founders / 1000 ticks / observer twins as `CHO-080-RESULTS.md`.
- Arms: `null` and `nitrification` — the retained single-reaction omission,
  which is now a declared no-op.
- Predictions, all mechanical invariants of the isolation:
  1. no nitrification extent or energy income in any run;
  2. the two arms identical in every recorded field at every tick — the
     control/omission contrast is **VACUOUS** by construction;
  3. the corrected null arm reproduces the recorded `chem/0.8.0` **omission**
     arm state-for-state at every tick — nothing else moved;
  4. the corrected null arm diverges from the recorded `chem/0.8.0` **control**
     arm, which ran the gated pathway — the isolation is operative;
  5. no strict-audit first failures at 1000 ticks.
- Falsification: any nitrification extent, any arm difference, any
  non-reproduction of the recorded omission hashes, any equality with the
  recorded control hashes, or a non-empty `firstFailures` grid.

## Results (measured)

**1. Isolated — no extent, no income, no draw.** The live network holds 12
reactions and no `nitrification`; the declaration preserves the removed
pathway (energy `0.10` per extent, `minO2 0.02`). The one-cell witness (NH4
`0.004`, O2 `1`, a NITRIFY-capable organism) books zero extent, zero energy and
zero transfer, and moves neither NH4 nor O2; the retained selector changes
nothing in that cell either (`isolation-witness.json`).

**2. VACUOUS contrast.** At both seeds the null and `+rxomit/1/nitrification`
arms are byte-identical in all 1000 recorded per-tick rows (state hash, audit,
extents, clamps, attribution, demography). There is no nitrification effect to
measure here because the pathway does not execute; a difference would have
meant the isolation leaked.

**3. Nothing else moved.** The corrected null arm reproduces the recorded
`chem/0.8.0` omission arm hash-for-hash at every tick: final hash `f940e23d`
(seed 41001) and `79a758ce` (seed 41002), population 30/38 and births 47/58 —
exactly the recorded omission results. The only difference from the prior head
is the isolation itself.

**4. The isolation is operative.** Against the recorded `chem/0.8.0` control
arm, which ran the gated pathway, the corrected arm diverges from tick 17 at
both seeds, and the recorded books show the nitrification activity that is now
absent:

| seed | recorded 0.8.0 control hash | corrected hash | first divergence (ticks) |
|---|---|---|---|
| 41001 | 68ad4253 | f940e23d | 17 |
| 41002 | 1a78252d | 79a758ce | 17 |

| seed | recorded nitrification extent | recorded energy credit | corrected extent | corrected energy credit |
|---|---|---|---|---|
| 41001 | 1145.8289832197681 | 114.58289832197681 | 0 | 0 |
| 41002 | 1142.6191269948672 | 114.26191269948673 | 0 | 0 |

Energy credit is `0.10 × extent`. The coefficient is preserved verbatim from
the pre-correction declaration (the removed `rx('nitrification', …, 0.10,
0.040, …)` line at the recorded head `066d55b`, visible in the git history),
and the recorded archive carries each reaction's element-defect vector but not
its energy coefficient — so the credit column is a **derived** figure: the
preserved coefficient times the raw recorded extent, stated as such. The
recorded extents and credits are **removed** books,
not corrected ones: at `chem/0.8.0` they were earned by a pathway with no
accountable oxidant draw, which is the departure this correction removes.

**5. Strict audit.** No strict-audit first failures in any of the four runs
across 1000 ticks; 8 full-horizon executions (observer twins, exact parity).
The controls recorded with this panel are the corrected ones; the retired
`nitrification-correction` control is not recreated — the
`nitrification-isolation` control replaces it (`one-cell-controls.json`).

**Reinterpretation of the 0.8.0 trial.** The `CHO-080-RESULTS.md` demographic
contrast (mean population 17.75 → 24.5) was measured by switching the gated
reaction on and off at `chem/0.8.0`. It is historical provenance for those
semantics, and it is **VACUOUS** as evidence about an oxygen-consuming
nitrification pathway: under `chem/0.8.1` the same arm pair is byte-identical.
It is not promoted here as confirmation of anything, and no demographic
prediction is made or tested.

## Limits of this result

Two seeds, exploratory replay; it confirms the isolation's mechanical
invariants, not any ecology, and carries no held-out inference. The recorded
`chem/0.8.0` and `chem/0.7.8` panels are immutable provenance and were not
relabelled or retroactively certified. Nothing here authorises a new
nitrification pathway, a merge, or issue #15 work.
