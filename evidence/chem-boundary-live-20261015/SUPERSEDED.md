# Superseded trace instrument

Do not use chemical holdings on death events in this panel: they were captured
after release/clear and are vacuous zeros. Cause, cohort and age fields are not
implicated, and ON/OFF state parity passed, but that does not validate holdings.
Independent review found the measurement bug before submission. The corrected
instrument captures holdings before release and names them `storesAtDeath` and
`biomassAtDeath`. The replacement witness is in
`evidence/chem-boundary-live-20261015-v2/`. This original panel is retained as
provenance, not silently repaired or certified by the replacement run.
