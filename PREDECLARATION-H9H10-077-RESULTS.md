# H9/H10/H11 results under `ts-evo-poc/0.7.0+chem/0.7.7`

> HISTORICAL after main reconciliation. See `RECONCILIATION-080-RESULTS.md`
> for current 0.8.0 measurements; this panel is retained unchanged.

**Run:** 2026-10-13, after the Owner-authorized canopy correction.
**Model identity:** `ts-evo-poc/0.7.0+chem/0.7.7`
**Seeds:** 517, 1013, 24601, 7, 99 (same panel as original).
**Horizon:** 1000 ticks, 400 founders.
**Command:** `node scripts/chem-matrix-91011.mjs 1000`
**Raw output:** `evidence/chem-matrix-91011-077-20261013.txt`
**Pre-declaration:** `PREDECLARATION-H9H10-070.md` (committed before execution).

## Verdicts (median population across 5 seeds)

| arm | pop median | range | births med | OC med | DIC med | legacy detritus med |
|---|---|---|---|---|---|---|
| base | 5 | 3–36 | 8 | 1597 | 23133 | 286 |
| H9 scale 3 | 5 | 3–56 | 7 | 1597 | 67125 | 270 |
| H9 scale 10 | 5 | 3–51 | 7 | 1598 | 221130 | 281 |
| H9 scale 30 | 5 | 3–56 | 8 | 1598 | 661130 | 281 |
| H10 bridge | 5 | 4–42 | 8 | 1600 | 23142 | **572** |
| H11 both | 5 | 3–48 | 9 | 1602 | 661139 | 559 |
| ref freeNutrients | 26 | 9–182 | 62 | 1544 | 23150 | 236 |
| chemOff | 788 | 409–1011 | 0 | 0 | 0 | 0 |

## H9 — UNTESTED again (lever wrong), not falsified

Exactly the pre-declared failure mode: the intervention moved DIC 29× (23,133 →
661,130 mol) and left OC flat (1,597 → 1,598, within ±1%). Population stayed at
5 on every scale arm. Photosynthesis declares `limits: [DIC, PO4, NH4]` and is additionally
light-gated, so CO2 weathering does not touch the organic pool. **H9 remains
open**; the right lever is phosphate/ammonium supply or the photosynthetic rate
itself.

## H10 — FALSIFIED again

The bridge works: legacy detritus rises 286 → 572 (+100%). Population does not
recover (5 → 5); the population spread widens (4–42) rather than shifting and births do not rise. Chemistry matter becoming visible to the
legacy food web does not relieve the binding constraint — the same conclusion
the 0.6.0 run reached, now reproduced on the corrected engine.

## H11 — FALSIFIED again

The combination (5) is no better than either single arm (5 and 5).

## What survives the matrix

With `freeNutrients` now an explicit booked subsidy rather than a gate bypass, it now produces the largest population response in the matrix: median 26 (9–182) against base 5, births median 62. It remains an EXPLICIT BOOKED SUBSIDY, not a gate bypass — the chemical book records every subsidised mole as an exogenous input — so the response measures what an unconstrained mineral supply does, not what the default ecology does. OC is abundant and unaffected by every arm; the reproduction constraint is NOT relieved by exogenous minerals ALONE — carbon uptake is still physical, and the default ecology still collapses.

## Caveats

- Five seeds, one machine, one runtime; medians are coarse.
- The bridge conversion factor (0.5 legacy units per mol tissue carbon) is
  declared arbitrary; a different factor could change magnitude but the sign of
  the population response is the registered claim.
- Chemistry-off is a reference, not a target.
