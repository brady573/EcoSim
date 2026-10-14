# Main reconciliation — current results

Identity: `ts-evo-poc/0.8.0+chem/0.7.7`. Measured 2026-10-14 after merging
main 8956699 into checkpoint 6a08e4d. Chemistry-off identity is
`ts-evo-poc/0.8.0`. Same registered seeds, 400 founders and 1000-tick horizon;
the original hypotheses and thresholds were not changed.

Commands and raw evidence:
- `node scripts/chem-cohort.mjs 1000`:
  `evidence/chem-cohort-1000-080-20261014.txt` (10 seeds).
- `node scripts/chem-matrix-91011.mjs 1000`:
  `evidence/chem-matrix-91011-080-20261014.txt` (5 seeds).
- `node scripts/chem-predation-knob.mjs 1000`:
  `evidence/chem-predation-knob-10seed-080-20261014.txt` (10 seeds, post-hoc).

## Registered outcomes

| Hypothesis | Verdict | Measurement |
|---|---|---|
| H1 | SUPPORTED | nutrient/energy limitation ratio median 1705.0; >10 on 10/10 seeds |
| H2 | SUPPORTED | reproduction nonzero 10/10 with nutrients; zero 10/10 without |
| H3 | FALSIFIED | three anaerobic reaction extents and hypoxic fraction all zero |
| H4 | PARTIAL | iron oxidation nonzero 10/10 (median 49.11); sulfur oxidation zero |
| H5 | NOT SUPPORTED / INCONCLUSIVE | segregation 5/10; offspring correlation not measured |
| H6 | NOT MEASURED | old performance comparison remains historical |
| H7 | SUPPORTED | all ten seeds below 400 founders, terminal population median 9 |
| H9 | UNTESTED | DIC 23152→661131, OC 1587→1592; organic-carbon supply did not vary |
| H10 | FALSIFIED | legacy detritus 297→585; population median unchanged at 7 |
| H11 | FALSIFIED | combined population 6, versus single arms 6 and 7 |

The ten-seed chemistry-off population median is 598 (326–1337); chemistry-on
is 9 (3–35). Raw summaries round some even-panel medians to zero decimal
places: the base birth median is exactly 9.5, printed as 10 in the arm summary.
These are losses, not improvement claims or cross-version comparisons.

## Guilds and generations

| Arm | producer births | consumer births | decomposer births | asexual total | sexual total | max live depth | mean live depth |
|---|---:|---:|---:|---:|---:|---:|---:|
| chemistry on | 9/10 | 4/10 | 0/10 | 147 | 6 | 1 | 0.029 |
| chemistry off | 10/10 | 10/10 | 1/10 | 2997 | 70 | 1 | 0.047 |

Sexual births occur and some descendants survive. No sustained
multi-generation fully integrated food web is demonstrated by these measurements.

## Diagnostic arms

The five-seed booked nutrient subsidy arm has population median 25 (17–178)
and births median 56, versus base population 7. It remains an explicitly
exogenous subsidy, not default ecology or a growth/reproduction gate bypass.

Predation matter: population median 9→8, raw rounded births median 10→10,
median carbon transferred 8.2015 mol. Carbon residual median 0.0002% in both
arms. Sexual births total 6→6; max live depth 1 in both. Increased transferred
matter or sexual birth counts do not establish ecosystem improvement.

## Scope and provenance

Final validation: typecheck and both builds clean; 55/55 gates, 11/11
contracts, 157/157 workflow fixtures. Contract checks include exact parity,
compiled CLI versus bundled viewer agreement, and repeat-run determinism.
Logs: `evidence/reconciliation-080-contracts-20261014.txt` and
`evidence/reconciliation-080-workflow-20261014.txt`.

Current G33 chemical-income share is 9.646%; G36 chemical income 2478.74 and
spend 147.60 match flux, with base energy residual 0.00011%.
`evidence/reconciliation-080-gates-20261014.txt` records the 55-check suite.

0.7.0/0.6.3 parent evidence and pins remain historical, with original headers
unchanged. Default 500-tick pins for 0.8.0 are 517→503/126/69 and
24601→337/119/95. Both gate families are retained (main G26–G32 renamed
G41–G47). PR #14 remains draft/unmerged. Primary-viewer chemistry integration
is still separate pending work, not a result of this reconciliation.
