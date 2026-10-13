# Pre-declaration: H9, H10, H11 re-run under `ts-evo-poc/0.7.0`

**Committed BEFORE the intervention matrix below is executed.**
Engine: `ts-evo-poc/0.7.0+chem/0.7.0`
Seeds: 517, 1013, 24601, 7, 99 (same panel as the original).
Horizon: 1000 ticks. Founders: 400. Commit: current `integrated-biogeochemistry` HEAD at run time.

## Why this re-run exists

The original H9/H10/H11 matrix was executed under `ts-evo-poc/0.6.0+chem/0.7.0`,
whose legacy canopy lookup was defective. `EVIDENCE-INVENTORY.md` marks those
verdicts HISTORICAL/PENDING. The two inert-intervention bugs found during the
original run (world coordinates passed to a 100×100 field index; flag read off
the wrong object) were fixed before that correction and remain fixed, so this is
a **sensitivity replay of the interventions on the corrected engine**, not a
different experiment.

## Hypotheses (unchanged from `PREDECLARATION-H9H10.md`)

- **H9** — organic-carbon SUPPLY per cell is the binding constraint.
  Intervention: `chemistryCo2WeatheringScale` ∈ {1, 3, 10, 30}.
  Falsified if population is flat (±20%) or non-monotonic across that range.
  **UNTESTED-not-falsified rule stands:** if the lever moves DIC but not OC, H9
  is untested, not falsified.

- **H10** — chemistry matter is invisible to the legacy food web.
  Intervention: `chemistryToLegacyDetritus` ∈ {false, true} at the declared
  arbitrary 0.5 legacy units per mole of tissue carbon.
  Falsified if the bridged arm is not higher than the unbridged arm.

- **H11** — the mechanisms are additive.
  Intervention: both together; falsified if the combination is no better than
  the better single arm.

Controls: `chemistryFreeNutrients` and chemistry-off reported as external
references. Every arm is checked for byte-distinct output; identical expected
arms are reported as identical rather than dropped.

## Controls on my own reading

- If `chemistryCo2WeatheringScale` changes DIC but not OC, H9 is **untested**.
- If the bridged arm changes population but legacy detritus does not move, the
  bridge is not where the effect came from.
- No arm is expected to reach any particular population; chemistry-off is a
  reference, not a target.
