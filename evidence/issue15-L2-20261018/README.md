# L2 corrected replay

Measurement-only engine 0.6.8, source `37d01a4`; full source SHA, resolved
A configs and command in `l2-panel.json`. Original 0.6.7 archive remains in
Git at `c90a15b`. Frozen prereg `f368029` is unchanged.

Same candidate, seeds 517/41001, 750 ticks and windows; no new search.
R1 and R2 remain MET; reliance remains INCONCLUSIVE. Correct limited-only
coverage is 170–314 organisms and **33–129 cells** per late window, distinct
from eligible activity reach. See `docs/issue15-L2-result.md` for corrected
binding attribution, uptake directions, memory costs and acceptance matrix.

Replay after compiling `tsconfig.build.json`:
`node evidence/issue15-L2-20261018/l2-screen.mjs`

STOP-B negative fixture:
`node evidence/issue15-L2-20261018/l2-protocol.test.mjs`

The runner executes A -> R1 -> B -> R2 -> C; C twins check determinism.
Exact distinct-ID/cell sets grow with unique participants per window; only
diagnostic samples are fixed-size. No fixed total-memory claim.
