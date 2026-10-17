# Retained-archive descendant readout

Post-hoc follow-up to review 5551158310. No simulations or biological changes.
Source: `77a82f4`, `evidence/rxomit-rapid-20261016/`. Derived records and
provenance: `evidence/rxomit-descendants-20261016/`.

Counts use actual placed births and producing/primary-parent edges, not genome
generationDepth. Secondary genetic-parent ancestry is not reconstructed.
“Offspring-parent children” includes grandchildren and later descendants.
All eight primary lineages reconcile to recorded births without data gaps.

| Seed | Omission | Founder children | Offspring-parent children | Exact grandchildren | Later descendants | Reproducing nonfounders | First grandchild tick |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 41001 | control | 27 | 4 | 4 | 0 | 1 | 855 |
| 41001 | nitrification | 17 | 27 | 21 | 6 | 4 | 577 |
| 41001 | iron oxidation | 27 | 0 | 0 | 0 | 0 | not observed |
| 41001 | iron uptake | 25 | 20 | 14 | 6 | 4 | 523 |
| 41002 | control | 17 | 0 | 0 | 0 | 0 | not observed |
| 41002 | nitrification | 36 | 24 | 18 | 6 | 5 | 535 |
| 41002 | iron oxidation | 53 | 6 | 6 | 0 | 1 | 710 |
| 41002 | iron uptake | 63 | 8 | 8 | 0 | 1 | 535 |

## Actual reached proposal gates

These are subject-tick decision counts, not unique organisms, independent
trials, or exclusive physiological causes. Only the first failed gate and
actually reached prefixes are recorded. Pair/queue/admission events are not
proposal failures. Reaching maturity is not passing it; unvisited gates are
not passes. Energy-fraction rejection leads in every cohort, but this ordered
gate readout cannot establish the outcome of bypassing any gate.
The offspring cohort includes all nonfounders, including later descendants.

| Seed | Omission | Cohort | Leading first failures (decision counts) | Reached maturity |
| --- | --- | --- | --- | ---: |
| 41001 | control | founders | energyFraction (145051); matter:nutrient (41252); surplus (399) | 749 |
| 41001 | control | offspring | energyFraction (9788); matter:nutrient (2510); matter:carbon (744) | 105 |
| 41001 | nitrification | founders | energyFraction (146645); matter:nutrient (39150); lottery (417) | 1505 |
| 41001 | nitrification | offspring | energyFraction (12533); matter:nutrient (3314); matter:carbon (1376) | 371 |
| 41001 | iron oxidation | founders | energyFraction (146391); matter:nutrient (37956); drive (1424) | 2421 |
| 41001 | iron oxidation | offspring | energyFraction (11513); matter:nutrient (2308); matter:carbon (616) | 62 |
| 41001 | iron uptake | founders | energyFraction (145931); matter:nutrient (38731); drive (989) | 2454 |
| 41001 | iron uptake | offspring | energyFraction (13891); matter:nutrient (3896); matter:carbon (997) | 41 |
| 41002 | control | founders | energyFraction (148532); matter:nutrient (53278); maturity (253) | 412 |
| 41002 | control | offspring | energyFraction (4026) | 0 |
| 41002 | nitrification | founders | energyFraction (148824); matter:nutrient (50807); maturity (524) | 1380 |
| 41002 | nitrification | offspring | energyFraction (14161); matter:nutrient (4508); matter:carbon (1010) | 35 |
| 41002 | iron oxidation | founders | energyFraction (149690); matter:nutrient (50582); maturity (331) | 652 |
| 41002 | iron oxidation | offspring | energyFraction (20982); matter:nutrient (7660); matter:carbon (89) | 76 |
| 41002 | iron uptake | founders | energyFraction (149486); matter:nutrient (47887); maturity (558) | 1628 |
| 41002 | iron uptake | offspring | energyFraction (28723); matter:nutrient (1004); matter:carbon (525) | 1 |

The demographic integrity check now accepts extinction and growth when counts
are valid and founders + births − deaths = population. Historical result-table
pins remain figure-consistency checks, not acceptable-outcome thresholds.
Provenance digests record the derivation snapshot; fresh raw replay in W10
validates the published measurements. No ecological rescue, nutrient-only
causality, permanent physiology, combined treatment or merge follows.
