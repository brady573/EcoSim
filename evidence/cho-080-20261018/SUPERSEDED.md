# Superseded panel — nitrification semantics only

This panel is the recorded `chem/0.8.0` contract re-measurement. It was live
when recorded, and its figures are retained exactly as measured — nothing here
is relabelled, repaired, or retroactively certified.

**Do not quote its nitrification contrast as evidence about an
oxygen-consuming nitrification pathway.** At `chem/0.8.0` the pathway stayed
live with its oxygen reduced to a presence gate while it still earned energy —
a material mechanism departure found by the Owner review of PR #14
(2026-10-18). Under the accepted fallback the pathway is isolated as
unsupported/disabled in `chem/0.8.1`: absent from the live network, preserved
in `ISOLATED_REACTIONS`, with its omission selector a declared no-op whose
control/omission contrast is **VACUOUS**.

The corrected replay is in `evidence/cho-081-20261019/` and
`CHO-081-RESULTS.md`: there the null and omission arms are byte-identical at
every tick, and the corrected null arm reproduces THIS panel's recorded
omission arm hash-for-hash (seed 41001 `f940e23d`, seed 41002 `79a758ce`),
diverging from this panel's recorded control arm from tick 17. Everything else
in this panel remains the `chem/0.8.0` record and is verified against its own
raw files by `scripts/check-doc-figures.mjs`.
