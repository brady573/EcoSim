# Issue #15 Track A — Mechanism inventory (0.6.3, source-linked)

> Worktree: `/root/EcoSim-issue15`, branch `issue15/mechanism-audit-spec`, from `origin/main` `8956699`.
> Engine: `ts-evo-poc/0.6.3`. Declared-default pins verified this worktree:
> seed 517 → `P882/C170/D65`, seed 24601 → `P563/C279/D90` at 500 ticks;
> `npm run typecheck` clean, `npm run gates` 40/40, `npm run contract` 11/11,
> `npm run workflow` 154/154 (2026-10-15).
> This inventory reuses accepted predecessor work and does not re-debug it.
> REPORT.md's mechanism/equivalence matrix is PARTIAL/INCOMPLETE; obligate-guild
> verdicts are SUPERSEDED (withdrawn, historical counts only). Nothing below
> reopens those without invalidation.

## Accepted baseline (reuse, do not rerun unless invalidated)

- G26 radiationMultiplier couples only excess over 1x (`src/gates.ts:1561`).
- G27 successfulMating flag gates asexual fallback, 4 cases (`src/gates.ts:1754`).
- G28 successfulMating array grows with capacity (`src/gates.ts:1781`).
- G29 high-slot mating integration (`src/gates.ts:1939`).
- G30 per-pool cap holds on every return path (`src/gates.ts:1945,2055`).
- G31 writer-isolated conservation: pool totals move by
  `accepted − photoUptake − eviction`, residual ~1e-8 (`src/gates.ts:2136,2179`).
- G32 partition at every (guild,pool,source):
  `attempted == accepted + capLoss`, eviction path exercised (`src/gates.ts:2191,2261`).
- W9 observer on/off evidence checker + opportunity nonperturbation seeds 517/41001,
  13/13 state-hash matches (probe header `src/trace/opportunityprobe.ts:24-28`;
  `scripts/opportunity-check.mjs`).
- Four-book flux snapshot `World.getFluxSnapshot()`:
  `photoUptake`, `excretionReturns`, `bioticMineralization`, `abioticRegen`,
  `abioticMineralization` (`src/world/world.ts:627`; writers
  `returnThroughCeiling` `:1570`, `mineraliseThroughCeiling` `:1606`).
- Actual mating events: queued/placed births + per-gate blocker counts via ReproProbe
  (`src/trace/matingdiag.ts`, `src/trace/reproprobe.ts`).
- Parity + determinism + rejected inputs + workflow fixtures (contract C1–C7, W1–W9).

## Viability (diagnostic) config vs declared defaults — different strata

All `src/trace/{nutrientflux,relianceprobe,opportunityprobe,matingdiag}.ts`
`buildWorld()` use the same **excretion-effective diagnostic config**, NOT
declared defaults: `founders:400, consumerPhotoScale:0, consumerBasalScale:0.25,
decomposerPhotoScale:0, decomposerFounders:0.25, decomposerDormancy:0.05,
grazeYieldScale:1.0, nutrientCyclic:true, producerCaptureScale:0.35,
nutrientFloor:0.05, reproSurplusTicks:30, basalFoodPerCell:0.01,
nutrientRegen:0.0002, excretionRate:0.06, bioticMineralisation:0.45`
(e.g. `src/trace/nutrientflux.ts:22-38`). Do not pool these with
declared-default parity figures. The experiment spec keeps the two strata separate.

## Priority mechanism rows

Columns: intent/declared + config path (default, null/off, units) | source
read/write + order + prerequisites/overrides | expected intermediate,
OFF/low/nominal/high, measured intermediate + downstream (this worktree or cited
evidence path) | nonresponse category | analogue-or-abstraction + calibration
honesty + Owner-decision status | evidence path / SHA / command.

1. **Photosynthesis/light + three-pool nutrient limitation.**
   Config: `producerCaptureScale:0.35`, `consumerPhotoScale:0|null`,
   `decomposerPhotoScale:0|null`, `nutrientPerCell`, `nutrientCapacity:[1.0,0.78,0.62]`
   (`src/world/config.ts`). Null = declared behaviour exactly.
   Read: actPhase `photoOpportunity` per-organism (world.ts Phase 4);
   writes `photoUptake[g][p]` books + depletes `nutrients[p]` cells.
   Prereq: light + local pool availability; overridden by `producerCaptureScale=0`
   (zero capture) and guild photo scales.
   Intermediate: pool-specific uptake; high capture → higher uptake until cap/saturation.
   Measured: seed 517 viability t2000 producers sole uptake 8901/9392/7338
   (REPORT nutrientflux section); mini-run 500t control photo 9220.4 (this worktree,
   archived `evidence/issue15-pilot-scratch-20261015/`, viability config).
   Category: RESPONSIVE (uptake moves with capture; downstream outcome may still be
   neutral under saturation — see row 9).
   Analogue: explicit research-only abstraction for coefficients. No empirical
   calibration claimed. OWNER DECISION NEEDED for any real-physiology reading.
   Evidence: REPORT nutrientflux tables (0.6.2 engine, same writer paths as 0.6.3);
   G31 isolates uptake in conservation identity.

2. **Excretion returns (`excretionRate:0.06`).**
   Null/0 = no metabolic returns; block skipped (`world.ts:2465`).
   Write: `excretionReturns{accepted,attempted,capLoss,eviction}[g][p]` via
   `returnThroughCeiling` (`world.ts:1570-1592,839-848`). Order: Phase 4 actPhase
   per-organism, after sensing cost, before feeding (`world.ts:2462-2481`).
   Intermediate: accepted excretion per (guild,pool).
   Measured: 500t control exAcc 9209.1 → `excretionRate=0` exAcc 0.0 exactly, arms
   differ (hash e4211a02→921099e7 seed 517; b93a97b3→686685df seed 41001;
   archived `evidence/issue15-pilot-scratch-20261015/mini-flux.*`).
   Knockout reaches site. Downstream at 500t viability: producer photo NOT reduced
   (9220→9599 seed 517; 8174→8813 seed 41001) — silent/saturated downstream.
   Category: RESPONSIVE-BUT-OUTCOME-NEUTRAL here (intermediate moves, endpoint does not).
   Analogue: explicit research-only abstraction (metabolic waste recycling).
   Status: measurement accepted (G31/G32); biological reliance NOT established.
   Evidence: mini-flux runs above; G30/G31/G32.

3. **Biotic mineralisation (`bioticMineralisation:0.45`) + expressed `bioticMineraliser`.**
   Derived gate `src/bio/role.ts:208-211`: `photo<0.34 && ((carrion>0.55 && speed<2.4) || recalc>0.5)`.
   Cached per slot `world.ts:1644` at birth + stage refresh; read in three feeding
   paths predation/graze/detritus/litter (`world.ts:2633,2687,2756`).
   Writes `bioticMineralization{accepted,attempted,capLoss,eviction}[g][p][src]`,
   src 0=sediment/1=detritus/2=litter (`world.ts:840-851,1606-1630`); also
   `bioticMineralised` global + private `mineralisedCell` (drives cyclic regen).
   Intermediate: accepted mineralisation per (guild,pool,source).
   Measured 500t seed 517 (archived
   `evidence/issue15-pilot-scratch-20261015/mini-flux.mjs` +
   `mini-attrib.mjs` + raw outputs; engine 0.6.3, SHA 8956699, viability config,
   compiled): control bioAcc 1556.6 = 662.0 CONSUMER-displayed +
   894.6 DECOMPOSER-displayed, 0 PRODUCER; live mineralisers 134 = 0/46/88 P/C/D.
   Label≠function: 34% of mineralisers display CONSUMER (mobile recalc path).
   `bioticMineralisation=0` → bioAcc 0.0 exactly (both seeds), arms differ.
   Off-target: `abioticRegen` cumulative also → 0.0 (7.1→0.0 seed 517; 11.3→0.0
   seed 41001) because cyclic rate `raw/(raw+sat)` (`world.ts:1751-1754`) sees
   `mineralisedCell=0`. Global knockout entangles biotic + cyclic-abiotic paths.
   Downstream 500t: producer photo NOT reduced (9220→9238; 8174→8422).
   Category: RESPONSIVE-BUT-OUTCOME-NEUTRAL under this stratum; OVERRIDDEN/
   SATURATED downstream (standing stock + excretion + floor compensate; pools
   59089/46307/37083 totals, capUtil ~0.5 per REPORT).
   Analogue: earthworm-casting / sessile-mat vs passerby distinction is a
   code-comment analogy (`role.ts:192-207`), NOT a calibrated claim.
   Explicit research-only abstraction for rates. OWNER DECISION NEEDED for
   phenotype-specific reading.
   Evidence: mini-flux + mini-attrib runs; REPORT t2000 tables (decomposers dominate
   detritus 4258 vs consumers 332 seed 517; collapse seed 41001 consumers dominate
   3283 vs 1068 — regime-dependent, not a fixed guild service).

4. **Cyclic regeneration (`nutrientCyclic:true` in diagnostics; null=off declared).**
   Read `world.ts:1738`; Phase 2 per-pool regen loop `1740-1772`;
   `rate *= raw/(raw+sat)`, `raw=mineralisedCell`, `sat=mixotrophySaturation`.
   Cannot be set per-guild/per-pool with current code.
   Measured: flux-measured but confounded with bioticMineralised (REPORT PARTIAL);
   `nutrientCyclic=false` + `bioticMineralisation=0` combined arm exists in
   relianceprobe (`NO_DECOMPOSER_MINERALIZATION_NO_CYCLIC`) but effects entangled.
   Category: NOT YET MEASURABLE in isolation (no independent cyclic-only meter).
   Analogue: explicit abstraction. OWNER DECISION NEEDED for per-guild cyclic design.

5. **Abiotic regen (`nutrientRegen:0.0002`) / floor (`nutrientFloor:0.05` diagnostics,
   0 declared) / capacities (`nutrientCapacity`) / broadcast (`recyclingRate:0.02`) /
   organic rain (`basalFoodPerCell:0.01` diagnostics, 0 declared).**
   Regen read `world.ts:1745`, floor applied after regen clamp before diffusion
   `1766-1768`, caps via `nutrientCapAt` `1517` + seeding `1176` + regen `1742` +
   `returnThroughCeiling`; broadcast `1838` (`share=(totalMineralised*rate*0.5)/(pools*cells)`);
   rain `1712-1718` at tick start.
   Measured: abiotic regen ~30-40 cumulative over 2000t vs ~17k excretion
   (REPORT) — negligible in viability stratum; floor 0.05 voids obligate reliance
   (REPORT correction: reliance NOT obligate as configured).
   All global-only; no per-guild/per-pool variants exist.
   Category: RESPONSIVE (rates move books) but SATURATED downstream here.
   Analogue: explicit abstractions (weathering, floors, rain). No calibration claimed.

6. **Feeding/grazing (`grazeYieldScale:1.0` diagnostics), energy transfer
   (`plantYieldPerMass:0` = declared default; `meatYieldPerMass:0` diagnostics,
   default 1.6), `consumerBasalScale:0.25` diagnostics (null declared), digestion/substrate tradeoffs.**
   Graze score `world.ts:2216-2217`; yields in contests Phase 5; upkeep factor
   `world.ts:513-517` is routed through one shared helper to the charge AND the
   viability gates: starvation upkeep (`world.ts:2828-2831`), sexual breeding
   surplus (`world.ts:3061-3065`), asexual breeding surplus (`world.ts:3268-3274`)
   via `this.reproSurplus` (installed `world.ts:1116`, resolved
   `world.ts:119-126`, null → 90). The half-wired state (charge-only scaling,
   gates demanding full-rate reserve, knob unable to rescue by construction) is
   HISTORICAL/FIXED — see helper docstring `world.ts:500-511` ("was half-wired")
   and REPORT.md. No "cannot rescue" consequence is claimed from the mechanism
   alone; any rescue claim needs fresh measurement in the current engine.
   Measured: `grazeYieldScale=0 → C=9` persists on sediment scavenging (REPORT);
   grazing needed for abundance, not survival. Consumers persist without producers
   at C=10 vs control C=7 in one arm — bounded sensitivity only.
   Category: RESPONSIVE-BUT-OUTCOME-NEUTRAL / GATE-INACTIVE depending on arm.
   Analogue: explicit abstraction. OWNER DECISION NEEDED for any trophic-efficiency
   calibration.

7. **Mating vs asexual (`mateSeeking`, `asexualRate`, `reproSurplusTicks:30`
   diagnostics / 90 declared, maturity/energy/surplus/cooldown/fraction/damage gates).**
   No single knob; outcome from mutual intent + gates (G27–G29).
   Measured: actual queued/placed births + blocker counts (matingdiag accepted);
   sexual fraction <10% predicted (H3); decomposer mating dominates in diagnostics.
   Category: RESPONSIVE (gates move births) — reliance on mating for persistence
   NOT established.
   Analogue: REPORT cites S1 DEB / S2 Otto / S3 Monod as conceptual comparisons
   only, explicitly NOT coefficient validation. Reuse those citations as-is; add no
   new biology citations here.

8. **Radiation / overgrowthCoupling / stressMutagenesis:1.0 / pioneerBonus:null /
   dormancy (`decomposerDormancy:0.05` diagnostics) / lifespan/senescence/damage-gate economics.**
   Radiation schedule `config:209,761`; abiotic Phase 1 `world.ts:1694-1700`;
   pioneer grant at birth + upkeep read `world.ts:519-549`; dormancy eval end of
   hot loop `2767-2784`, effect next tick (basal/sensing/starvation).
   Measured: G26 coupling; dormancy/grazemeter/deeptime probes exist but
   niche-fitness advantage NOT established (REPORT decision packet: stress
   mutagenesis + pioneerBonus fail to reliably produce consumer/decomposer
   emergence; no new niche steering approved — at most two separately sourced
   niche options may be proposed later, none approved here).
   Category: RESPONSIVE (knobs move mutation/upkeep) / NOT YET MEASURABLE for
   niche advantage.
   Exclusion honored: no `opportunityWeight`/`dispersalWeight`/biased mutation/
   frequency reward/synthetic steering/subvention — existing opportunity instrument
   stays read-only.

## Exclusions (with rationale)

- 0.8.0 chemistry branch (`integrated-biogeochemistry`): different engine identity
  (`ts-evo-poc/0.8.0+chem/0.7.7`), not the 0.6.3 baseline this issue tracks. Not
  inventoried here; no figures compared across identities.
- Retired parity pairs (0.6.1/0.6.0/0.5.0/0.4.1): provenance only, listed in
  `scripts/contract-checks.mjs`; not remeasured.
- Browser↔Node last-bit divergence: patterns reproduce, exact states do not; not a
  behavioural difference.
- Per-pool per-guild uptake attribution gap is CLOSED by getFluxSnapshot (was open
  in early audit); per-phenotype (trait-bin) attribution is OPEN — Tier 0 sampling
  only, Tier 1 books need Owner decision (see prereg).

## What is proven vs missing (one-line verdicts)

- Proven: defaults reproduce (parity); instruments measure (four books, mating
  events, observer nonperturbation); global knobs reach their sites (0 zeroes
  accepted flow); mobile mineralisers exist (label≠function); saturated-viability
  pools compensate (knockout ≠ producer starvation at 500t).
- Missing: mechanism-by-mechanism OFF/low/nominal/high with intermediate AND
  downstream (only global arms, only 2 seeds at 500t so far); phenotype-level
  attribution; isolated B (capability knockout), measured C (exogenous rescue),
  and D (provider specificity); nutrient-limited stratum where returns actually
  limit producers; preregistered cohort with matched contrasts, uncertainty, and
  honest SUPPORTED/FALSIFIED/INCONCLUSIVE verdicts.
