# Evidence inventory — supersession under the Owner-authorised canopy correction

> **CURRENT chemistry:** `ts-evo-poc/0.8.0+chem/0.8.1` applies the
> Owner-directed multielement C/H/O contract (`POOL_COMPOSITION` as the
> authoritative inventory table, the burial-reservation repair, eight derived
> reaction corrections) **with nitrification isolated as unsupported**. The
> pathway was kept live at `chem/0.8.0` with its oxygen reduced to a presence
> gate while it still earned energy — a material mechanism departure found by
> the Owner review of PR #14 (2026-10-18) — and `chem/0.8.1` removes it from
> the live reaction network into `ISOLATED_REACTIONS`, retaining its omission
> selector as a declared no-op whose control/omission contrast is VACUOUS.
> Current qualification is recorded in `CHEM-080-CONTRACT.md` and the
> preregistered isolation replay `CHO-081-RESULTS.md`; the `chem/0.8.0`
> re-measurement `CHO-080-RESULTS.md` remains the record of those semantics.
> No broad ecological panel has been requalified. All chemistry figures below
> labelled current at their time, including `chem/0.8.0` and `chem/0.7.8`, are
> now HISTORICAL under their recorded identities. They are not rewritten.
> Chemistry-unset base parity remains unchanged.
>
> **HISTORICAL reconciliation:** `ts-evo-poc/0.8.0+chem/0.7.7` combines main's
> 0.6.3 fixes with the experimental branch. All 0.7.0 cohort results below are
> historical; completed 0.8.0 measurements are in `RECONCILIATION-080-RESULTS.md`.
> This supersession applies to all "current" labels in the historical sections
> below. The old raw files
> retain their original identities; they must not be relabelled. Current base
> parity is 517 → 503/126/69 and 24601 → 337/119/95 at 500 ticks.

**Decision:** Owner authorised the legacy coarse-canopy correction and the
resulting parity re-pin on **2026-10-13**. Applied at `b4614cd` decision point
`824dcc0`.

**Why anything is superseded:** the legacy photosynthesis path indexed the COARSE
canopy array `shadeMass` (`shadeCols × shadeRows`, `shadeGrain` 4) with a
FULL-RESOLUTION substrate cell. With the default grain it read an unrelated cell
for 15/16 of the world and ran off the end of the array for the rest.
Beer–Lambert self-shading was therefore effectively disabled in that path and
producer income had **no density dependence there**.

Every figure produced under `ts-evo-poc/0.6.0` was measured through that defect.

## Status legend

| Status | Meaning |
|---|---|
| **HISTORICAL** | Measured under a retired engine version or with the canopy defect. Provenance. Not current behaviour. Not comparable to current figures. |
| **SUPERSEDED** | Was the live claim; replaced by a re-run under `0.7.0`. |
| **CURRENT** | Matching the live identity in the engine table, only for the explicitly measured scope. |
| **PENDING** | Not yet re-measured. Must not be quoted as current. |

---

## 1. Engine identity

| Identity | Status | Note |
|---|---|---|
| `ts-evo-poc/0.6.0` | **HISTORICAL** | Pins measured through the canopy defect. |
| `ts-evo-poc/0.7.0` | **HISTORICAL** | Canopy-corrected parent before main reconciliation. |
| `ts-evo-poc/0.8.0` | **CURRENT** | Main reconciliation; chemistry-off pins 503/126/69 and 337/119/95. |
| `ts-evo-poc/0.8.0+chem/0.8.1` | **CURRENT** | Multielement C/H/O contract + burial reservation, with nitrification isolated as unsupported; qualification in `CHEM-080-CONTRACT.md`, isolation replay in `CHO-081-RESULTS.md`; broad ecological verdicts not requalified. |
| `ts-evo-poc/0.8.0+chem/0.8.0` | **HISTORICAL** | Recorded multielement contract panel; its nitrification arm contrast is VACUOUS under the isolation (pathway was live with an oxygen presence gate). Original figures retained; re-measurement in `CHO-080-RESULTS.md` remains as measured. |
| `ts-evo-poc/0.8.0+chem/0.7.8` | **HISTORICAL** | D1/D2 targeted qualification in `CHEM-078-CORRECTIONS.md`; superseded by the multielement contract. Strict `ok:false` audits retained as recorded, first H/O failure at tick 17. |
| `ts-evo-poc/0.8.0+chem/0.7.7` | **HISTORICAL** | Reconciliation, factorial and family panels before D1/D2; never relabelled. |
| `ts-evo-poc/0.6.0+chem/0.7.0` | **HISTORICAL** | Base component superseded. |
| `ts-evo-poc/0.7.0+chem/0.7.0` | **HISTORICAL (identity-only supersession)** | Chemistry semantics calculation unchanged, but accounting composition changed. No ecological rerun is implied except residual/G36 accounting. |
| `ts-evo-poc/0.7.0+chem/0.7.1` | **HISTORICAL (identity superseded)** | Causal energy reconciliation, H/O death release, and bridge bookkeeping identity. |
| `ts-evo-poc/0.7.0+chem/0.7.2` | **HISTORICAL (identity superseded)** | Per-organism gross substrate budgets. |
| `ts-evo-poc/0.7.0+chem/0.7.3` | **HISTORICAL (identity superseded)** | `freeNutrients` is an explicit booked exogenous subsidy; carbon uptake, growth ceilings and offspring gates stay physical. |
| `ts-evo-poc/0.7.0+chem/0.7.4` | **HISTORICAL (identity superseded)** | H2O uptake credits H and O at 1:1. |
| `ts-evo-poc/0.7.0+chem/0.7.5` | **HISTORICAL (identity superseded)** | Aerobic respiration returns 0.9 H2O per extent. |
| `ts-evo-poc/0.7.0+chem/0.7.6` | **HISTORICAL (identity superseded)** | Gross reaction budget moved into Chemistry and shared across organisms. |
| `ts-evo-poc/0.7.0+chem/0.7.7` | **HISTORICAL** | Shared reaction/uptake reservation budget before main reconciliation. |

## 2. Parity pins (knobs unset, 500 ticks, contract probe)

| Seed | 0.6.0 pin | 0.7.0 pin | Status |
|---|---|---|---|
| 517 | 808/159/58 | **492/136/74** | 0.6.0 value HISTORICAL, retained verbatim in `scripts/contract-checks.mjs` |
| 24601 | 558/290/96 | **296/171/74** | 0.6.0 value HISTORICAL, retained verbatim |
| — | 881/187/73 @ 0.4.1 | — | HISTORICAL |
| — | 778/169/63 @ 0.5.0 | — | HISTORICAL |

The 0.6.0 triples are preserved exactly as recorded. They are **not**
restated in current units and are **not** compared digit-for-digit with the new
triples; this correction changes what the guild figures are measured over.

Repeat runs of the new pins are byte-identical on this runtime.

### Historical raw chemistry panels

`evidence/chem-cohort-1000-070-20261013.txt`,
`evidence/chem-matrix-91011-070-20261013.txt`,
`evidence/chem-predation-knob-070-20261013.txt`,
`evidence/chem-predation-knob-10seed-20261013.txt`, and
`evidence/chem-predation-knob-gd3-10seed-20261013.txt`, the `-072-`
and `-073-` panels are intermediate `chem/0.7.0`–`chem/0.7.3` provenance only. Current panels end in `-077-` and run under `chem/0.7.7`.

## 3. Pre-registered results — `PREREGISTRATION.md`

| Hypothesis | 0.6.0 result | Status | Current status (`chem/0.7.7`) |
|---|---|---|---|
| H1 nutrient vs energy limitation | SUPPORTED, 3235:1, 10/10 seeds | **HISTORICAL** | **CURRENT** — SUPPORTED, median 1593.4:1, 10/10 seeds (`PREREGISTRATION-070-RESULTS.md`) |
| H2 nutrients gate reproduction | SUPPORTED, 10/10 vs 0/10 | **HISTORICAL** | **CURRENT** — SUPPORTED, births nonzero 10/10 with nutrients, exactly 0 on 10/10 without |
| H3 anaerobic opportunity | FALSIFIED, 0/10 | **HISTORICAL** | **CURRENT** — FALSIFIED again, all three reactions zero 10/10, hypoxia identically 0 |
| H4 chemosynthesis | PARTIAL | **HISTORICAL** | **CURRENT** — PARTIAL again, iron oxidation nonzero 10/10, sulfur oxidation zero 10/10 |
| H5 capability heritability | SUPPORTED, 8/10 | **HISTORICAL** | **CURRENT but not supported** — segregated on only 6/10 seeds; offspring correlation NOT MEASURED, so the registered falsification condition is unestablished |
| H6 performance floors | SUPPORTED | **HISTORICAL** | **HISTORICAL** — the 207/404 ticks/s figures were measured under chem/0.7.0 and are not current under chem/0.7.7 |
| H7 does not self-sustain | SUPPORTED, 10/10 declining | **HISTORICAL** | **CURRENT** (still 10/10 declining, median terminal pop 8) |

H1–H5 were re-measured under `ts-evo-poc/0.7.0+chem/0.7.7` on 2026-10-13; see
`PREREGISTRATION-070-RESULTS.md` for thresholds and raw data. The historical
`0.6.0` verdicts above are retained as provenance and are not comparable to the
current figures digit-for-digit.

## 4. H9/H10/H11 — `PREDECLARATION-H9H10.md`

| Hypothesis | 0.6.0 result | Status | Current status (`chem/0.7.7`) |
|---|---|---|---|
| H9 organic-carbon supply | UNTESTED (lever wrong) | **HISTORICAL** | **CURRENT — UNTESTED again** (lever moved DIC 29×, OC flat; see `PREDECLARATION-H9H10-077-RESULTS.md`) |
| H10 legacy food-web bridge | FALSIFIED | **HISTORICAL** | **CURRENT — FALSIFIED again** (detritus 286→572, pop 5→5) |
| H11 additive | FALSIFIED | **HISTORICAL** | **CURRENT — FALSIFIED again** (5 vs 5 and 5) |

H9–H11 were re-run under `ts-evo-poc/0.7.0+chem/0.7.7` on 2026-10-13 using the same seed panel and horizon; see `PREDECLARATION-H9H10-070.md` (pre-declaration) and `PREDECLARATION-H9H10-077-RESULTS.md`. The `chem/0.7.0` results file is historical. The `0.6.0` verdicts are
retained as provenance.

**The two inert-intervention bugs found there** (world coordinates passed to a
100×100 field index; flag read off the wrong object) were fixed before this
correction and remain fixed. Those fixes are not superseded.

## 5. Diagnosis: the limiting mechanism

The finding that the nutrient gate, not energy, is the dominant constraint, and
that the limit is **per-cell** rather than environmental-total, was measured
under 0.6.0. Its **mechanism** rests on conservation and store dynamics that the
canopy correction does not touch. Its **population figures** are **HISTORICAL**.

The conclusion "chemistry is not neutral" survives in direction but not in
magnitude — see §6.

## 6. Cohort comparison — current panel under `chem/0.7.7`

The detailed demographic table below was measured under the now-historical `chem/0.7.0` panel and is retained as provenance. The current `chem/0.7.7` run measured base population median 8 (2–36), births median 9, chemistry-off population median 640 (391–1520); median terminal population 8, and H5 segregation 6/10. See `evidence/chem-cohort-1000-077-20261013.txt`. Under the corrected explicit-subsidy semantics, the `freeNutrients` reference arm measures population median 26 (9–182) with births median 62 — the largest response in the matrix, and an explicitly booked exogenous subsidy, not a gate bypass.

### Historical detailed table under `chem/0.7.0`

10 seeds (517, 1013, 24601, 7, 99, 31337, 4242, 8080, 555, 12345), 1000 ticks,
400 founders.

| | chemistry ON | free nutrients | chemistry OFF |
|---|---|---|---|
| population median | **6** | 64 | **668** |
| range | 3–29 | 15–271 | 391–1520 |
| declining vs 400 founders | 10/10 | 10/10 | 1/10 |
| births total | 135 | 2901 | 12509 |
| asexual / sexual | 131 / 4 | 2833 / 68 | 12016 / 493 |
| deaths: starve / age / damage | 3020 / 105 / 905 | 5031 / 133 / 720 | 7049 / 342 / 1857 |
| max generation depth | 1 | 1 | 3 |
| mean generation depth | 0.02 | 0.08 | 0.07 |
| conservation C / N / P / S / Fe | 0.0002 / 0 / 0 / 0 / 0 % | 0.0004 / 0 / 0 / 0 / 0 % | n/a |
| performance (median) | 207 ticks/s | 211 | 404 |

### Before / after, same script, same seeds

| Arm | 0.6.0 median pop | 0.7.0 median pop |
|---|---|---|
| chemistry ON | 19 | **6** |
| free nutrients | 325 | **64** |
| chemistry OFF | 1465 | **668** |

**These numbers must not be read as "the correction improved or worsened the
ecosystem."** The correction removed a density-dependent light term that was
silently absent; every arm lost population because light is now genuinely
limiting. The chemistry-on/off **ratio** moved from ~77x to ~111x, so the
qualitative conclusion — chemistry is not neutral, and is worse — **survives
unchanged in direction**. No claim of ecological improvement is made, and none
should be inferred from the absolute decrease.

### Three-guild coexistence — measured under `chem/0.7.7`

Per-guild births are measured by `scripts/chem-cohort.mjs` (10 seeds, 1000 ticks):

| arm | producer births | consumer births | decomposer births |
|---|---:|---:|---:|
| chemistry ON (`base`) | 8/10 | 4/10 | **0/10** |
| chemistry OFF | 10/10 | 10/10 | **2/10** |

Chemistry does not solve the three-guild coexistence shortfall: with chemistry
on the decomposer guild does not reproduce on any seed, and without it only two
seeds reproduce at all. The DIRECTION survives from the retired panels, but the
magnitude moved — chemistry-OFF decomposer reproduction is 2/10 under
`chem/0.7.7`, not the 6/10 quoted in the historical table below. This is a
current measurement, not a carried-over claim.

### Generations — measured under `chem/0.7.7`

| arm | asexual births | sexual births | max generation depth | mean live depth |
|---|---:|---:|---:|---:|
| chemistry ON | 166 | 4 | 1 | 0.012 |
| chemistry OFF | 2787 | 52 | 3 | 0.033 |

Reproduction is 97.6% asexual with chemistry on and 98.2% with it off. Sexual
recombination occurs on a minority of seeds and does not persist: no arm
sustains a recombined lineage at 1000 ticks. **Same conclusion as under 0.6.0,
now measured on the current panel.**

## 7. Gates exposed by the correction

| Gate | Status | Note |
|---|---|---|
| G12 | **CHANGED** | Asserted a biotic flux on the FINAL tick. The corrected legacy ecosystem's mineralisation loop decays to zero by ~tick 100 (flux is non-zero on 106/150 ticks, peaking 1.43 at tick 1). It now asserts the read/clear **ordering** the gate exists to catch. The sustained-cycle question is **PENDING** as an ecological claim the gate never made. |
| G28 | **CHANGED** | Asserted NET standing tissue rises. The corrected balance has deaths exceeding growth inside 400 ticks (400 → 97.68 mol). It now asserts growth **occurs**, as the largest single-organism tissue gain. |
| G34 | **NEW** | Spatial canopy test. Non-default `shadeGrain` 3, non-square 1500×900 world (12×7 coarse grid), corner and edge lookups, and legacy **capture** response requiring ≥2× attenuation. |

Neither G12 nor G28 change weakens the original detection: G12's kill-switch is
still caught (OFF arm must be exactly 0 at every tick), and G28's growth claim
is now measured directly rather than inferred from a net.

## 8. Declared limits that remain in force

Unchanged by this correction and **not** addressed by it:

- Predation transfers **energy but no elemental matter**.
- Chemical energy **is now reconciled through the legacy ledger when
  chemistry is on; see `AGENTS.md` §"Declared integration limits" and the new
  G36 (base residual 0.00011%, income 2118.11 = flux, spend 150.02 = flux;
  gate saved in `evidence/ledger-reconciliation-20261013.txt`).  Earlier historical figures tagged 6.65/0.73% never ran against the
  chemical-income correction, so do not quote them as reconciled numbers.
- Death reaches the two economies by **separate paths**.
- **No fully integrated food web is demonstrated.** A fixed legacy canopy does
  not establish matter transfer through predation. The chemistry/legacy food-web
  limitations are distinct from this correction and remain declared in
  `AGENTS.md`.

## 9. Evidence limitations of this correction

- One machine, one runtime. Cross-platform parity is not claimed.
- The spatial gate reaches private engine state structurally. That is deliberate
  — widening the public API for a gate is worse — but it means the gate depends
  on the private method name `canopyAt`.
- `rebuildCanopy()` recomputes the canopy every tick, so canopy mass cannot be
  injected; the gate creates density by repositioning organisms instead. That
  tests the real path but also moves organisms, so the two arms differ in
  position as well as density.
- G34's spatial half tests `canopyAt` directly, which is self-consistency: if the
  deposit and the lookup shared the SAME wrong convention (swapped axes, say)
  both would agree and the test would pass. The capture half is what closes that
  hole, because it exercises deposit → lookup → ledger.
- H1–H5 and H9–H11 verdicts were re-measured under `chem/0.7.7`; older
  0.7.0/0.7.1 figures remain historical provenance.

## 10. Defect found during the correction review

**Stale TypeScript compiler output was tracked beside the sources.**
20 `.js` files under `src/` are `tsc` output committed accidentally. They are not
on the runtime import path — every probe imports from `build/` — but
`src/world/world.js` still contained the coarse-canopy defect **for one commit
after it was corrected in `world.ts`**, and `src/world/version.js` reported
`ts-evo-poc/0.4.1`.

A stale copy of code is a version of the code that looks healthy while being
wrong, which is precisely the failure mode this repository's discipline targets:
someone reading or importing it would see a working engine that does not match
the sources. `src/**/*.js` is now in `.gitignore` and those files are removed
from the index. They were left **on disk**, so nothing is destroyed and they can
be regenerated by the build.

## 11. Chemistry accounting extension (current identity `chem/0.7.7`) (G36 — current semantics)

Before this extension, chemistry-on `residualPct` values printed in any
chemistry-on diagnostic/ladder log were computed without the ledger-level
`chemicalIncome`/`chemicalSpent` bookings.  They are **historical under the
prior identification**, even though the shift is small (residual ~0.5% on H10
runs already fell within tolerance, and the corrected base arm is now 0.00011%).

- `G36` is the new two-sided guard for the energy-integration limit.
- Old residual percentages must not be quoted as current without noting the
  new identity.
- `G33` remains an income-share measurement only, unchanged in definition;
  its figure is **8.388%** under `0.7.0+chem/0.7.7` (see same evidence file).
