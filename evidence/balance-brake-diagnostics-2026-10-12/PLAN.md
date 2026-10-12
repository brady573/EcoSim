# Balance-brake diagnostics — registered before execution

Date: 2026-10-12
Direction: Owner-approved balance-first diagnostic step in `NEXT-PUSH.md`.
Status at registration: planned, before local execution began. The local paired
comparison is incomplete; see `LOCAL-EXECUTION-NOTE.md`.

## Question

How do the previously observed exclusion, fade, and runaway trajectories change
when the accepted dormant-share senescence brake is enabled? This is a bounded,
descriptive diagnostic on known seeds, not a prospective cohort or a general
test of ecosystem balance.

## Arms and controlled inputs

For each seed `517`, `99991`, and `42`, run a paired comparison:

- control: senescence `off`
- brake: senescence `share:1`

Both arms use the same current engine source, the `scenesprobe` combined-winner
configuration, and 6,000 ticks. The only changed input within each pair is
dormant senescence mode. The ladder arm `argvRest` declarations are authoritative:
senescence setting, consumer photo scale 4, basal override null, graze override
null, tissue override null, radiation null, disease null, pioneer null, dormant
threat blind null, mixotrophy off, nutrient cycling off, saturation 0.4,
producer capture null, nutrient floor 0, reproduction surplus null. The probe
provides 400 founders, 2400×2400 world, decomposer founders 0.25, dormancy 0.05,
and spores 1.
Record and inspect the emitted header before interpreting any output.

The seeds are the three already named in `NEXT-PUSH.md` as unresolved against
the brake: 517 (competitive exclusion), 99991 (fade), and 42 (runaway). They
are known seeds and their prior outcomes are not new evidence.

## Measurements

Preserve complete stdout for all six runs. Compare the 1,000-tick checkpoints
and final state: total population, producer/consumer/decomposer counts, dormant
count, cumulative senescence deaths, and per-guild births/deaths. Check that
each run reached tick 6000 and that paired headers differ only in senescence
setting.

## Interpretation limits

No pass/fail threshold is registered: this run characterizes trajectories and
does not certify that the brake achieves balance. Do not infer seed-distribution
rates or generalize beyond these three known cases. Do not change biological
parameters or engine behavior during this diagnostic.
