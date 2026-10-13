# H9/H10/H11 results under `ts-evo-poc/0.7.0`

**Run:** 2026-10-13, after the Owner-authorized canopy correction.
**Model identity:** `ts-evo-poc/0.7.0+chem/0.7.0`
**Seeds:** 517, 1013, 24601, 7, 99 (same panel as original).
**Horizon:** 1000 ticks, 400 founders.
**Command:** `node scripts/chem-matrix-91011.mjs 1000`
**Raw output:** `evidence/chem-matrix-91011-070-20261013.txt`
**Pre-declaration:** `PREDECLARATION-H9H10-070.md` (committed before execution).

## Verdicts (median population across 5 seeds)

| arm | pop median | range | births med | OC med | DIC med | legacy detritus med |
|---|---|---|---|---|---|---|
| base | 6 | 3–28 | 6 | 1909 | 22748 | 277 |
| H9 scale 3 | 7 | 3–50 | 6 | 1887 | 66746 | 284 |
| H9 scale 10 | 6 | 3–40 | 6 | 1910 | 220747 | 284 |
| H9 scale 30 | 7 | 3–36 | 6 | 1898 | 660747 | 284 |
| H10 bridge | 5 | 3–30 | 6 | 1922 | 22744 | **547** |
| H11 both | 5 | 3–10 | 6 | 1924 | 660740 | 544 |
| ref freeNutrients | 58 | 24–271 | 254 | 1625 | 22927 | 212 |
| chemOff | 788 | 409–1011 | 0 | 0 | 0 | 0 |

## H9 — UNTESTED again (lever wrong), not falsified

Exactly the pre-declared failure mode: the intervention moved DIC 29× (22,748 →
660,747 mol) and left OC flat (1,909 → 1,898, within ±1%). Population stayed at
6–7. Photosynthesis declares `limits: [DIC, PO4, NH4]` and is additionally
light-gated, so CO2 weathering does not touch the organic pool. **H9 remains
open**; the right lever is phosphate/ammonium supply or the photosynthetic rate
itself.

## H10 — FALSIFIED again

The bridge works: legacy detritus rises 277 → 547 (+97%). Population does not
recover (6 → 5) and births do not rise. Chemistry matter becoming visible to the
legacy food web does not relieve the binding constraint — the same conclusion
the 0.6.0 run reached, now reproduced on the corrected engine.

## H11 — FALSIFIED again

The combination (5) is no better than either single arm (7 and 5).

## What survives all three

`chemistryFreeNutrients` gives 58 against base 6 — ~10×, the only intervention
in the matrix that moves the outcome, and it is not one of the two hypothesized
mechanisms. The binding constraint remains the nutrient gate itself. OC is
abundant and unaffected by every arm; the reproduction gate fails on carbon
**throughput**, not supply.

## Caveats

- Five seeds, one machine, one runtime; medians are coarse.
- The bridge conversion factor (0.5 legacy units per mol tissue carbon) is
  declared arbitrary; a different factor could change magnitude but the sign of
  the population response is the registered claim.
- Chemistry-off is a reference, not a target.
