# Mechanism audit — investigation, not a biology repair

Review: PR #14 / 5530741428, source baseline `3fd245e`.
The investigation below describes `ts-evo-poc/0.8.0+chem/0.7.7` and remains
historical after D1/D2. Current correction work is `chem/0.7.8`, documented in
`CHEM-078-CORRECTIONS.md`. The Owner authorized D1/D2 on 2026-10-15 in
https://github.com/brady573/EcoSim/pull/14#issuecomment-6193809477 ; accepted
D3–D5 directions retain the specific implementation/parameter gates there.

## Phase 1: reproducible helper counterexamples

Compile with `npm run view:build`, then run
`node scripts/mechanism-counterexamples.mjs`.
These fixtures construct isolated chemistry/stores through exported helper
APIs, not live Worlds. Reaction controls omit explicit helper calls; they do
not modify the reaction table, a world, or inherited capabilities. No claim
is made that a selective live-world intervention exists yet.

Measured on this engine:
- NH4 stock 0.004, strength 1: nitrification extent 0.004; subsequent N
  assimilation 0, versus 0.00248 with the reaction omitted and N_ASSIM retained.
- Fe2 stock 0.00035, strength 1: oxidation alone sends 0.00035 to Fe3;
  named uptake alone sends 0.00035 to environmental OFE. Each leaves organism
  Fe assimilation 0, versus 0.00012 when both reactions are omitted and
  organism FE_UPTAKE retained. In the combined arm oxidation takes priority.
- Request 0.012 carbon with half-required P: reported carbon 0.012 versus
  stoichiometrically valid 0.006. Every element is conserved, but tissue
  proportions are wrong. Missing Fe is a discriminating negative control:
  no growth occurs; the defect is not a universal missing-nutrient bypass.
- Reproduction demand 0.5/1/2: macro thresholds are squared, whereas trace
  reserve and carbon demand scale linearly. At demand 2 a linear macro
  complement fails and the squared complement passes. Default 1 is unchanged.

## Remaining required investigation

These helper results do **not** establish the cause or size of population
loss. Passive live-world boundary instrumentation and a matched witness now
exist; see `CHEM-BOUNDARY-INSTRUMENT.md` for timing, parity and retention limits.
A selected-family parent/offspring/first-birth witness is now recorded in
`CHEM-FIRSTBIRTH-RESULTS.md`, with explicit one-seed and outcome-selection limits.
The later accepted experiment-only selective trials are recorded in
`RXOMIT-RAPID-RESULTS.md`. They do not establish nutrient-only demographic
causation; broader attribution and permanent physiology remain open.
The iron environmental reaction and organism Fe uptake share a capability;
clearing that capability is NOT an isolated environmental-reaction control.

The matched four-arm panel is now complete: see `MECHANISM-FOUR-ARM-RESULTS.md`
and its raw directory. It reuses the existing protocol's seeds, founders and
horizon and preserves exact resolved configs and hashes. No new
success threshold or extinction attribution is introduced here. Preregister
the causal intervention panel before running it; descriptive four-arm
differences alone cannot identify which nutrient pathway causes loss.

Owner decision packet: `MECHANISM-OWNER-DECISIONS.md` covers nitrate/iron physiology, universal
founder repertoire and reproduction tissue/store inheritance. A fixed growth
limiter changes chemistry semantics: repair requires a new identity and fresh
targeted evidence, not relabeling existing panels or tuning survival.

Generation depth currently advances on recombinant offspring, not every
asexual succession; it must not be interpreted as complete lineage depth.
PR remains draft/open/unmerged. These investigation phases do not complete
the review or authorize changed biological semantics.
