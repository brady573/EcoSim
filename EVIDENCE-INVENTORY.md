# Evidence inventory — supersession under the Owner-authorised canopy correction

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
| **CURRENT** | Re-measured under `ts-evo-poc/0.7.0`. |
| **PENDING** | Not yet re-measured. Must not be quoted as current. |

---

## 1. Engine identity

| Identity | Status | Note |
|---|---|---|
| `ts-evo-poc/0.6.0` | **HISTORICAL** | Pins measured through the canopy defect. |
| `ts-evo-poc/0.7.0` | **CURRENT** | Canopy corrected. |
| `ts-evo-poc/0.6.0+chem/0.7.0` | **HISTORICAL** | Base component superseded. |
| `ts-evo-poc/0.7.0+chem/0.7.0` | **CURRENT** | Chemistry semantics **unchanged** — the chemistry light path already mapped the coarse canopy correctly. Only the base component moved. |

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

## 3. Pre-registered results — `PREREGISTRATION.md`

| Hypothesis | 0.6.0 result | Status | 0.7.0 status |
|---|---|---|---|
| H1 nutrient vs energy limitation | SUPPORTED, 3235:1, 10/10 seeds | **HISTORICAL** | **CURRENT** — SUPPORTED, median 1755:1, 10/10 seeds (`PREREGISTRATION-070-RESULTS.md`) |
| H2 nutrients gate reproduction | SUPPORTED, 10/10 vs 0/10 | **HISTORICAL** | **CURRENT** — SUPPORTED, births nonzero 10/10 with nutrients, exactly 0 on 10/10 without |
| H3 anaerobic opportunity | FALSIFIED, 0/10 | **HISTORICAL** | **CURRENT** — FALSIFIED again, all three reactions zero 10/10, hypoxia identically 0 |
| H4 chemosynthesis | PARTIAL | **HISTORICAL** | **CURRENT** — PARTIAL again, iron oxidation nonzero 10/10, sulfur oxidation zero 10/10 |
| H5 capability heritability | SUPPORTED, 8/10 | **HISTORICAL** | **CURRENT but not supported** — segregated on only 5/10 seeds; offspring correlation NOT MEASURED, so the registered falsification condition is unestablished |
| H6 performance floors | SUPPORTED | **HISTORICAL** | **CURRENT** (re-measured, all floors cleared) |
| H7 does not self-sustain | SUPPORTED, 10/10 declining | **HISTORICAL** | **CURRENT** (still 10/10 declining, median terminal pop 6) |

H1–H5 were re-measured under `0.7.0` on 2026-10-13; see
`PREREGISTRATION-070-RESULTS.md` for thresholds and raw data. The historical
`0.6.0` verdicts above are retained as provenance and are not comparable to the
current figures digit-for-digit.

## 4. H9/H10/H11 — `PREDECLARATION-H9H10.md`

| Hypothesis | 0.6.0 result | Status | 0.7.0 status |
|---|---|---|---|
| H9 organic-carbon supply | UNTESTED (lever wrong) | **HISTORICAL** | **PENDING** |
| H10 legacy food-web bridge | FALSIFIED | **HISTORICAL** | **PENDING** |
| H11 additive | FALSIFIED | **HISTORICAL** | **PENDING** |

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

## 6. Cohort comparison — re-run under `0.7.0`

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

### Three-guild coexistence — the question this PR exists to answer

- **chemistry ON**: decomposer births `0` on **10 of 10 seeds** (was 9 of 10).
- **chemistry OFF**: decomposer births present on 6 of 10 seeds.

**Unchanged in direction and now measured under the corrected engine.** Chemistry
does not solve the three-guild coexistence shortfall; it removes the decomposer
guild from reproduction. This is the headline result and it did **not** depend on
the canopy defect.

### Generations

Maximum generation depth 1 (chem ON) / 3 (chem OFF); mean depth 0.02–0.08;
reproduction 95%+ asexual. No arm demonstrates sustained multi-generation
inheritance at 1000 ticks. **Same conclusion as under 0.6.0**, now re-measured.

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
- Chemical energy is **not** reconciled through the legacy ledger (measured
  share 6.65%, G33).
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
- H1–H5 and H9–H11 verdicts remain **PENDING** re-measurement and must not be
  quoted as current.

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
