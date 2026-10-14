# Pre-registration results under `ts-evo-poc/0.7.0` — H1–H7

**Run:** 2026-10-13, after the Owner-authorized legacy canopy correction.
**Model identity:** `ts-evo-poc/0.7.0+chem/0.7.5`
**Seeds:** 517, 1013, 24601, 7, 99, 31337, 4242, 8080, 555, 12345 (10)
**Horizon:** 1000 ticks, 400 founders.
**Command:** `node scripts/chem-cohort.mjs 1000`
**Raw output:** `evidence/chem-cohort-1000-075-20261013.txt`

The hypotheses and thresholds below are unchanged from `PREREGISTRATION.md`,
which was written before any cohort ran under `0.6.0`. This file records only the
re-measured verdicts under the corrected engine. Historical `0.6.0` verdicts are
retained in `PREREGISTRATION.md` and `EVIDENCE-INVENTORY.md` §3 as provenance.

## Verdicts

| Hypothesis | 0.7.0 result | Basis |
|---|---|---|
| H1 nutrient vs energy limitation | **SUPPORTED** | nutrient/energy ratio median 1549.7:1 (min 1172.5, max 21382.4); >10:1 on 10/10 seeds |
| H2 nutrients gate reproduction | **SUPPORTED** | births nonzero 10/10 with nutrients; exactly 0 on 10/10 without |
| H3 anaerobic opportunity | **FALSIFIED** | fermentation, sulfate reduction, denitrification zero on 10/10; hypoxic fraction identically 0 |
| H4 chemosynthesis | **PARTIAL** | iron oxidation nonzero 10/10 (median 49.08 extent); sulfur oxidation zero on 10/10; photosynthesis nonzero 10/10 |
| H5 capability heritability | **NOT SUPPORTED / INCONCLUSIVE** | iron-uptake capability segregated on only 5/10 seeds (prediction required ≥8/10). Offspring correlation was not measured by this run, so the registered falsification condition is not established. |
| H6 performance floors | HISTORICAL under `chem/0.7.0` | 207 ticks/s chem-on vs 404 chem-off median; not yet re-measured under `chem/0.7.5` |
| H7 does not self-sustain | **SUPPORTED** | 10/10 seeds end below 400 founders; median terminal pop 6 |

## Secondary observations (not verdicts)

- Chemistry-on terminal population median 6 (range 3–29) versus chemistry-off
  median 640 (range 391–1520): the ~107× collapse is reproduced on this run.
- `noChemo` ablation: births median 27 vs base 10; `noAnaerobic` is
  byte-identical to base in every reported column (the anaerobic arm never
  fires, so removing it changes nothing — an arms-differ check passed only for
  the arms whose variable actually varied).
- `noNitrogen` changes births (median 15) but not the qualitative collapse.

## What this does NOT establish

- One cohort, one machine, one runtime. No cross-platform claim.
- H5 offspring-capability correlation remains **NOT MEASURED**.
- H9/H10/H11 are measured under `chem/0.7.5` in `PREDECLARATION-H9H10-075-RESULTS.md`.
- Nothing here is an ecological improvement claim: every arm lost population
  under the corrected canopy because density-dependent light now binds.
