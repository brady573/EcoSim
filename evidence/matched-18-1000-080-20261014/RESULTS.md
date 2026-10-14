# Matched 18-seed panel, 1000 ticks

Completed 2026-10-14. All 36 unique arm/seed runs reached tick 1000.
Seeds 41001–41018; 400 founders. `runs.jsonl` records each measurement;
`*-config.json` records every resolved configuration. `protocol.json`,
`runner.mjs` and `progress.txt` preserve the execution method and trace.

| Measurement | Legacy | Advanced |
|---|---:|---:|
| identity | ts-evo-poc/0.8.0 | ts-evo-poc/0.8.0+chem/0.7.7 |
| chemistry / Genome V2 | unset / unset | true / true |
| final population mean | 810.56 | 12.67 |
| final population median | 764 | 11.5 |
| final population range | 207–2257 | 3–37 |
| seeds below 400 founders | 2/18 | 18/18 |
| births total | 27985 | 317 |
| seeds with producer births | 18/18 | 17/18 |
| seeds with consumer births | 18/18 | 8/18 |
| seeds with decomposer births | 7/18 | 0/18 |
| sexual births total | 795 | 18 |
| max live generation depth | 3 | 1 |

Terminal guild population means (P/C/D): legacy 733.83/75.17/1.56;
advanced 11.72/0.89/0.06. Advanced chemical carbon built averages 272.12 mol.

Largest terminal absolute energy residual: legacy 0.04430%, advanced 0.00746%.
Advanced largest absolute element residuals: C 0.000234%, H 0.013272%,
O 0.046416%; N/P/S/Fe are at floating-point scale. Largest cumulative chemical
settlement clamp: 0.062035 mol. These are terminal measurements, not a claim
that every intermediate tick was independently audited by this runner.

## Interpretation limits

The advanced configuration collapses on all eighteen seeds, with no decomposer
reproduction. This is a descriptive result, not a new preregistered verdict.
Chemistry and Genome V2 change together, so the panel does not isolate a causal
chemistry-only effect. One runtime/device, one 1000-tick horizon; no browser
or sustained integrated-food-web claim is made. Runtime/performance samples
are recorded but are not controlled benchmark evidence.

Raw results were copied only after execution completed and the 36-row,
18-seed-per-arm, unique-pair and 1000-tick completeness checks passed.
