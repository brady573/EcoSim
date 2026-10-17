# H9/H10/H11 results under `ts-evo-poc/0.7.0+chem/0.7.5`

**Run:** 2026-10-13, after the Owner-authorized canopy correction.
**Model identity:** `ts-evo-poc/0.7.0+chem/0.7.5`
**Seeds:** 517, 1013, 24601, 7, 99 (same panel as original).
**Horizon:** 1000 ticks, 400 founders.
**Command:** `node scripts/chem-matrix-91011.mjs 1000`
**Raw output:** `evidence/chem-matrix-91011-075-20261013.txt`
**Pre-declaration:** `PREDECLARATION-H9H10-070.md` (committed before execution).

## Verdicts (median population across 5 seeds)

| arm | pop median | range | births med | OC med | DIC med | legacy detritus med |
|---|---|---|---|---|---|---|
| base | 6 | 3–39 | 6 | 1935 | 22694 | 266 |
| H9 scale 3 | 7 | 3–46 | 6 | 1917 | 66700 | 270 |
| H9 scale 10 | 8 | 3–45 | 6 | 1924 | 220696 | 268 |
| H9 scale 30 | 8 | 3–51 | 6 | 1919 | 660695 | 268 |
| H10 bridge | 6 | 3–10 | 6 | 1960 | 22689 | **546** |
| H11 both | 7 | 4–77 | 6 | 1903 | 660696 | 540 |
| ref freeNutrients | 5 | 4–15 | 16 | 1916 | 22708 | 253 |
| chemOff | 788 | 409–1011 | 0 | 0 | 0 | 0 |

## H9 — UNTESTED again (lever wrong), not falsified

Exactly the pre-declared failure mode: the intervention moved DIC 29× (22,694 →
660,695 mol) and left OC flat (1,935 → 1,919, within ±1%). Population stayed at
6–7. Photosynthesis declares `limits: [DIC, PO4, NH4]` and is additionally
light-gated, so CO2 weathering does not touch the organic pool. **H9 remains
open**; the right lever is phosphate/ammonium supply or the photosynthetic rate
itself.

## H10 — FALSIFIED again

The bridge works: legacy detritus rises 266 → 546 (+105%). Population does not
recover (6 → 6) and births do not rise. Chemistry matter becoming visible to the
legacy food web does not relieve the binding constraint — the same conclusion
the 0.6.0 run reached, now reproduced on the corrected engine.

## H11 — FALSIFIED again

The combination (7) is no better than either single arm (8 and 6).

## What survives all three

With `freeNutrients` now an explicit booked subsidy rather than a gate bypass, it no longer produces the earlier population surge: median 5 against base 6, births median 16. No intervention in the matrix materially rescues the system. OC is abundant and unaffected by every arm; the reproduction constraint is not relieved by exogenous mineral nutrients alone.

## Caveats

- Five seeds, one machine, one runtime; medians are coarse.
- The bridge conversion factor (0.5 legacy units per mol tissue carbon) is
  declared arbitrary; a different factor could change magnitude but the sign of
  the population response is the registered claim.
- Chemistry-off is a reference, not a target.
