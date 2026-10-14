# Local execution note

Execution was attempted with the compiled `senesprobe` on Node v24.21.0/aarch64,
using the plan in `PLAN.md`. These are informal probe outputs, not ladder legs;
the ladder uses `scenesprobe` with its ledger checks. Treat remote ladder evidence
as a distinct instrumented run, and compare only after checking both config
headers and the changed probe identity.

- Seeds 517 and 99991 completed both the `off` and `share:1` arms at 6,000
  ticks. Their complete stdout files are preserved beside this note.
- Seed 42 `off` was started for 6,000 ticks but hit the shell's 300-second
  timeout after writing the tick-5,000 checkpoint (`pop=60000`, the configured
  artificial population ceiling). It did not produce a tick-6,000 checkpoint
  or final birth/death summary; this is an incomplete execution, not a valid
  6,000-tick result. Its partial stdout is preserved as
  `seed-42-off-incomplete-to-5000.txt`.
- Seed 42 `share:1` was not attempted locally.

The paired six-run comparison is therefore incomplete locally. The configured
horizon and seed panel are unchanged. The complete comparison must run on a
more capable runner; the incomplete local output must not be substituted for a
6,000-tick measurement.
