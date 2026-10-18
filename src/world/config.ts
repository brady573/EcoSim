/**
 * World configuration for the experimental evolution engine.
 *
 * Every field here participates in the reproducibility contract
 * (engineVersion + resolved config + seed). Defaults are the experiment's
 * baseline; `WorldConfig` is fully resolved at construction and is safe to
 * serialize, so a benchmark run can record exactly what it ran.
 */

export interface DormantSenescence {
  mode: 'fixed' | 'share' | 'lifespan';
  scale: number;
}

/** Scheduled-radiation shape; see WorldConfig.radiation. */
export interface RadiationSchedule {
  onset: number;
  doubling: number;
  cap: number;
  /**
   * Optional floor on the dormant-share coupling (0..1). When set, the
   * realized multiplier is scaled by dormantShare/floor, clamped to 1, so
   * radiation dies as overgrowth dies. undefined/null = uncoupled (original
   * behaviour: pure tick schedule). See WorldConfig.radiation.
   */
  overgrowthCoupling?: number | null;
}

/** Pioneer-bonus shape; see WorldConfig.pioneerBonus. */
export interface PioneerBonus {
  /** Grace duration in ticks granted to a qualifying flip newborn. */
  grace: number;
  /** Max upkeep discount fraction (0..1) at full void; scales with void. */
  discount: number;
}

export interface WorldConfig {
  /** World extent in world units. */
  worldW: number;
  worldH: number;
  /** Coarse abiotic-field cell size. */
  fieldCell: number;
  /** Spatial-hash cell size for neighbour queries. */
  spatialCell: number;

  /** Initial founder population. */
  founders: number;
  /** Tick period at which the abiotic axis re-randomizes its drift. */
  abioticPeriod: number;

  // --- Abiotic dynamics ----------------------------------------------------
  /** Baseline light availability, 0..1. */
  baseLight: number;
  /** Amplitude of the light/temperature oscillation. */
  lightAmplitude: number;
  /** Ticks per full abiotic cycle. */
  abioticCycle: number;
  /** Base temperature, degrees. */
  baseTemp: number;
  /** Temperature swing amplitude. */
  tempAmplitude: number;

  // --- Substrate fields ----------------------------------------------------
  nutrientDiffusivity: number;
  nutrientDecay: number;
  nutrientPerCell: number;
  /**
   * Beer-Lambert extinction coefficient for self-shading, per unit of local
   * phototrophic mass.
   *
   * Self-shading is real biology and it was genuinely missing: producer income
   * was `photo * 0.42 * light * STATIC shade`, with no term that saw
   * neighbouring organisms, so gross producer income was density-independent
   * (measured flat at 0.17-0.19/tick across a 13x density change).
   *
   * MEASURED LIMITATION, and this value is set by it: at this world's spatial
   * scale self-shading CANNOT be the carrying-capacity mechanism. There are
   * 10,800 substrate cells and producers occupy 0.2-0.5 per cell, so a lone
   * producer already contributes canopy mass ~4.8 (photo 0.71 x size 6.7).
   * Honouring "an isolated producer is barely shaded" caps this coefficient at
   * ~0.034, and at 0.034 meaningful attenuation needs canopy mass ~40, i.e.
   * ~8 producers per cell - which would put K near 86,000, above maxPopulation.
   * Higher values that DO bind (0.18 was tried) shade an isolated producer by
   * 58 %, which is a distortion of the mechanism rather than a calibration of it.
   *
   * So this stays as a weak, honest, secondary density dependence, and the
   * OPERATIVE carrying-capacity mechanism is per-cell nutrient supply - see
   * `nutrientPerCell`. That one binds globally at the sparse densities this
   * world actually occupies. Reported as a negative result in REPORT.md.
   */
  shadeExtinction: number;
  /**
   * Canopy cells per substrate cell, per axis.
   *
   * Self-shading only works if the canopy is COARSER than the substrate grid.
   * At 1:1 the arithmetic fails: producers occupy 0.2-0.5 per substrate cell, so
   * an isolated producer already casts canopy mass ~4.8, and honouring "a lone
   * producer is barely shaded" caps attenuation until ~8 producers share a cell -
   * a density this world never reaches. The canopy therefore has to aggregate a
   * patch of substrate into one shading unit.
   *
   * At 1:4 each canopy cell spans 4x4 substrate cells, so ~3-8 producers is
   * enough to shade meaningfully while a genuinely isolated producer still sits
   * near full light. This is also defensible biology: canopy patches are larger
   * than the fine substrate cells nutrient is tracked on.
   */
  shadeGrain: number;

  /**
   * Per-pool capacity multipliers, one per limiting nutrient. Only weakly
   * correlated with one another and with habitat fertility, so the pools can be
   * genuinely co-limiting rather than proportional copies.
   */
  nutrientCapacity: number[];

  /** Initial sediment detritus per cell, so a detritus web can bootstrap. */
  sedimentPerCell: number;

  /** Per-tick fractional decay of sediment detritus. Much slower than water. */
  sedimentDecay: number;
  detritusDiffusivity: number;
  detritusDecay: number;
  /** Detritus converted to nutrient per tick as a fraction. */
  recyclingRate: number;

  // --- Energy economy ------------------------------------------------------
  /**
   * Energy per unit of ingested organic material, before the eater's
   * metabolic efficiency is applied. This is the ONLY external source of
   * organic energy in the world; keeping it constant is what makes the
   * causal accounting checkable.
   */
  energyPerFood: number;
  /** Baseline natural-feed availability per cell per tick (the "rain"). */
  basalFoodPerCell: number;
  /**
   * Bootstrap stock of RECALCITRANT benthic litter, per cell, scaled by habitat
   * fertility. Litter is fed by corpse flux and by leaf-litter rain, so it need
   * not start large, but some stock is needed or decomposers hatch onto
   * litter-poor cells and starve before the pool can build.
   */
  litterPerCell: number;
  /** Abiotic mineralisation of litter. The slowest of the three organic pools. */
  litterDecay: number;
  /** Share of a corpse's usable fraction routed to recalcitrant litter. */
  litterFraction: number;
  /** Share of basal organic rain routed to litter (leaf litter fall). */
  litterRainShare: number;
  /**
   * Scale on locomotion cost. 1.0 = current model.
   *
   * DIAGNOSTIC KNOB, added to test one specific claim: that consumers cannot
   * out-earn their own locomotion, so a mobility cost premium - not food supply
   * - is what removes them. Producers are sessile and cost ~0.13/tick; consumers
   * must move and cost ~0.20/tick while earning encounter-limited income.
   *
   * If reducing this lets consumers persist WITHOUT any change to food supply,
   * the theory is supported. If they still fail, the asymmetry is not in
   * locomotion and the theory is falsified.
   */
  locomotionCostScale: number;
  /**
   * Stress-induced mutagenesis gain: how much physiological stress amplifies
   * the realized mutation rate of an offspring.
   *
   * Real biology (bacterial SOS response and analogues across taxa): organisms
   * under stress explore genotype space faster, while comfortable, well-adapted
   * organisms hold their genotype stable. The multiplier is
   * `1 + stressMutagenesis * stress` where stress in [0,1] blends hunger,
   * damage, and energy deficit — so at 3.0 a maximally stressed parent explores
   * at ~4x background rate and an unstressed parent at exactly background.
   *
   * Uniform: gated by per-organism CONDITION, never by guild label. A starving
   * producer gets the same boost as a starving consumer. Targets exploration at
   * bottlenecked lineages (which must find a new adaptive peak before going
   * extinct) without loading adapted populations with deleterious mutations.
   */
  stressMutagenesis: number;
  /**
   * Diagnostic: diseased food fraction (null = off).
   *
   * When set to p in (0,1], that fraction of heterotroph biomass meals
   * (grazed, predated, sediment/suspended-detritus, litter) is diseased and
   * deals fixed viability damage instead of clean energy. Photosynthesis and
   * mineral uptake are not food and never roll. Uses the main RNG stream
   * (knob-on runs diverge from knob-off by stream position; per-config
   * determinism exact). Rollback: null restores declared behaviour exactly.
   *
   * Density dependence lives in diseasePressure(): the knob rate scales with
   * local patch occupancy — empty patches are immune, saturated patches feel
   * the full rate. Thin populations escape; crowds sicken.
   */
  foodDisease: number | null;
  /**
   * Diagnostic: scheduled radiation (null = off).
   *
   * When set, the realized mutation rate multiplies by m(t) = min(cap,
   * 2^((tick-onset)/doubling)) for ticks at/after onset (exactly 1 before).
   * Set `onset` past the point where overgrowth has begun to ask whether
   * extra evolvability helps a world already in the trap, rather than
   * during establishment.
   * Tests whether evolvability — not opportunity — binds during overgrowth:
   * if a locking world innovates its way out under radiation, reachable
   * answers existed; if it locks on schedule anyway, the trap is ecological.
   * Same RNG draws, scaled sigma, so streams stay comparable across settings.
   * Uniform like stress mutagenesis (no guild label reads anywhere on this
   * path). Rollback is deletion: null restores declared behaviour exactly.
   */
  radiation: RadiationSchedule | null;
  /**
   * Diagnostic: pioneer establishment bonus (null = off).
   *
   * When set, a newborn whose guild differs from its parent's (a birth flip)
   * receives a grace period of `grace` ticks over which its upkeep costs
   * (basal metabolism, starvation threshold, breeding-surplus bar) are
   * discounted by up to `discount` (0..1), scaled by the destination guild's
   * void: full discount into an extinct guild, ~zero into a dominant one.
   * Void is the global guild share from the per-tick patch census (fresh at
   * every birth: the census rebuilds before births are placed and excludes
   * same-tick newborns). Grid disabled (no census) grants nothing.
   * No RNG is drawn, so knob-on runs are exactly deterministic per
   * seed+config; knob-off restores declared behaviour exactly. Rollback:
   * null restores declared behaviour exactly.
   *
   * Symmetry note: food disease punishes crowds (pressure rises with
   * occupancy); this rewards pioneers (bonus rises with emptiness). Starting
   * calibration grace 200 / discount 0.5 — the probe's establishment counts
   * are the signal (flips tenure into voids = working; stampede flips
   * subsidised = overshoot).
   */
  pioneerBonus: PioneerBonus | null;
  /**
   * Edible energy per unit prey body mass (trophic transfer efficiency knob).
   *
   * DIAGNOSTIC KNOB for bracketing consumer viability by overshoot: raise until
   * predators dominate, then bisect back to coexistence. Default 1.6 lands near
   * ~15% trophic transfer (literature order); the previous 5.0 let a predator
   * extract 101% of a large prey's standing value (energy creation, not
   * transfer). Higher values enrich predators specifically — grazers,
   * scavengers and decomposers use separate intake paths — so this brackets
   * PREDATOR viability, not all consumers at once.
   */
  meatYieldPerMass: number;
  /**
   * Diagnostic: plant-tissue yield basis for GRAZE (0 = legacy formula).
   *
   * 0 (default) = declared behaviour (reserve-fraction takes). When positive,
   * graze takes scale with victim body mass (tissue) instead of momentary
   * holdings — the conversion predation already received. Starting
   * calibration 14 keeps effective density below meat (smaller take fraction
   * and weaker digestion carry the difference); the holdings backstop in the
   * transfer path still caps every take, so conservation stays exact.
   */
  plantYieldPerMass: number;
  /**
   * Patches per axis for the metapopulation grid. 0 disables immigration
   * entirely; 4 gives a 4x4 partition of the world.
   *
   * The grid exists because consumer success is spatially CLUSTERED, not
   * uniform (measured, 4x4 grid, both seeds: CV across patches 0.85-1.86, with
   * one patch holding 69 consumers while four held 0-3). That is source-sink
   * structure, which means the failure mode is patch-LOCAL extinction rather
   * than global collapse — and immigration converts local extinction into a
   * recoverable fluctuation, which is the "increase when rare" mechanism the
   * model was otherwise missing.
   *
   * Not an external subsidy: an immigrant is an ordinary newborn that
   * happened to disperse far, and its energy comes from the parent reserve
   * through the existing `birthCostFactor` transfer. Strict closure preserved.
   */
  metapopulationPatches: number;
  /**
   * Strength of the empty-patch bias when choosing an immigration target.
   *
   * Target weight for a patch is `1 / (1 + immigrationWeight * localCount)` for
   * the newborn's own guild, so an empty patch is maximally attractive and a
   * crowded one is avoided. 0 gives uniform (unbiased) patch choice, which
   * reproduces pre-metapopulation behaviour except for the patch-long
   * distance.
   */
  immigrationWeight: number;
  /** Detritus converted to edible energy per unit (scavenging). */
  energyPerCarrion: number;
  /**
   * Diagnostic override for the founder `reproThreshold` gene init.
   *
   * null (default) = use the declared spec init. A number overrides the
   * FOUNDER value only; the trait stays fully heritable, so selection may still
   * evolve it. That is deliberate: this exists to test whether the STARTING
   * breeding threshold determines consumer persistence, with evolution free to
   * respond.
   *
   * It does NOT clamp the gate itself - an organism whose evolved threshold
   * rises above this value is still gated at its own expressed value. This
   * changes the initial condition, not the mechanic.
   */
  reproThresholdInit: number | null;
  /**
   * Diagnostic override for the founder `asexualRate` gene init.
   *
   * null (default) = declared spec init (0.2). A number overrides the FOUNDER
   * value only; the trait stays heritable and mutable, so selection may still
   * drive it down.
   *
   * This exists to test a specific measured finding: `asexualRate` evolves to
   * ~0.005 in consumers (founder 0.2) and ~0.012 in producers, with 45% of
   * consumer roll-entry ticks at exactly zero. Because `asexualRate` is read in
   * exactly one place - the breeding drive calculation - and nowhere else, a
   * decline in it is only explicable as selection acting AGAINST reproduction.
   * Seeding founders at a high value tests whether the decline is an adaptive
   * response to this world's competition regime (and therefore correct) or an
   * artefact that suppresses the guild when held fixed.
   */
  asexualRateInit: number | null;
  /**
   * Diagnostic override for the founder `clutchSize` gene init.
   *
   * null (default) = declared spec init (0.35).
   *
   * This exists because of a measured mechanical ceiling. Births are queued as
   * `max(1, round(clutchSize * (0.5 + rand)))`, and the founder init of 0.35
   * yields round(0.175..0.525) = 0 or 1, clamped to exactly 1. The trait is
   * declared with range 1..11 but CANNOT produce more than a single offspring
   * at any value below ~1.33. Combined with a measured ~2% success rate per
   * eligible tick, consumers cannot physically outpace adult mortality
   * (measured B/D 0.634; real herbivores manage ~1 surviving offspring per
   * adult lifetime).
   *
   * Overrides the FOUNDER value only; the trait stays heritable, so this
   * measures whether selection can exploit a larger clutch or whether it erodes
   * the advantage as it does with asexualRate.
   */
  clutchSizeInit: number | null;
  /**
   * Diagnostic scale on the energy COST OF REPRODUCTION.
   *
   * null/1 = declared behaviour. 0 removes the `spend(slot, 1.1 + size*0.35,
   * 'reproduction')` charged for the act itself. The parental reserve transferred
   * to each child (`birthCostFactor * 0.5` of the parent's energy) is NOT
   * affected by this knob - it is the resource the child is made of, not a tax.
   *
   * This tests the central inference of the current investigation: that
   * reproduction is a NET COST in this world and selection therefore erodes it.
   * Two independent experiments already show selection dismantling reproduction
   * when it is expensive - seeding `asexualRate` 4x high is eroded back to
   * ~0.04 (2.5% of founder) and seeding `clutchSize` 6.5x high raises births but
   * raises mortality proportionally, so replacement still fails.
   *
   * If reproduction is expensive *because it costs energy*, making it free
   * should let the trait persist and consumers should persist. If it is eroded
   * even when free, the gradient runs deeper than the energy cost and this
   * inference is wrong.
   */
  reproActCostScale: number | null;
  /**
   * Diagnostic scale on the PARENTAL RESERVE TRANSFER to each child.
   *
   * null/1 = declared behaviour (birthCostFactor 0.42, transferred as
   * `energy[parent] * birthCostFactor * 0.5` per child). A number multiplies
   * that fraction; 0 makes children appear without charging the parent.
   *
   * This is the strongest remaining candidate for the selection gradient that
   * erodes `asexualRate`. It was deliberately EXCLUDED from the `reproActCostScale`
   * sweep on the reasoning that a child is made of its parent's material rather
   * than taxed for it. That reasoning is questionable: the transfer is a real
   * charge against the parent's reserve, it is the largest single energy term in
   * reproduction, and uniquely among the three reproduction charges it SCALES
   * WITH CLUTCH SIZE - a 6.5x clutch is a 6.5x energy bill.
   *
   * That scaling predicts exactly the observed result: raising clutch size 6.5x
   * raised births 63.0 -> 90.3 with deaths rising in step, because each event
   * costs proportionally more.
   *
   * NOTE: with scale 0 the offspring appear from nothing, which violates the
   * closed energy budget this simulation is built on. Results at scale 0 are a
   * DIAGNOSTIC of the gradient's direction, not a candidate ecology.
   */
  birthTransferScale: number | null;
  /**
   * Four intervention knobs for the consumer-viability investigation. Each is
   * null by default (= declared behaviour, byte-identical). Each isolates one
   * hypothesized binding constraint on consumer persistence. All stay heritable
   * where traits are involved; these scale MECHANICS, not founder genes.
   *
   * 1. predationYieldScale: multiplies the energy moved per successful
   *    predation/graze event (r.delta). Conservation preserved: scales the
   *    request, defender provides. Tests whether predation pays too little.
   * 2. consumerPhotoScale: multiplies photosynthesis demand for CONSUMER-guild
   *    organisms only. Consumers already get 27.5% of income this way; tests
   *    whether leaning into mixotrophy restores them.
   * 3. consumerBasalScale: multiplies basal upkeep for CONSUMER-guild organisms
   *    only. Consumers spend 75.9% of their budget on upkeep; tests whether
   *    lowering overhead frees breeding surplus.
   * 4. producerCaptureScale: multiplies photosynthesis demand for PRODUCER-guild
   *    organisms only. Producers take 97.2% of income with no density limit;
   *    tests whether capping the top creates room below.
   */
  predationYieldScale: number | null;
  /**
   * Diagnostic: graze (herbivory) yield multiplier (default null = unchanged).
   *
   * When set, GRAZE-kind transfers scale by this instead of
   * predationYieldScale, so plants can be made more nutritious without making
   * meat more nutritious. Conservation preserved exactly like the predation
   * path (transfer capped by defender holdings; overflow spilled, never
   * minted). Null (default) = declared behaviour (shared predation scale).
   */
  grazeYieldScale: number | null;
  consumerPhotoScale: number | null;
  /**
   * Diagnostic: multiplies photosynthesis demand for the DECOMPOSER guild.
   *
   * null (default) = declared behaviour, unchanged.
   *
   * This knob exists because the guild gate in the photosynthesis path had a
   * branch for consumers (g===1) and producers (g===0) and NOTHING for
   * decomposers (g===2), so a decomposer captured at full unzeroed demand no
   * matter what consumerPhotoScale and producerCaptureScale were set to. Under
   * the `--zero` flatline preset that left the decomposer guild as the only
   * guild with a live energy input, which is a flatline that is not flat.
   *
   * The same shape as consumerPhotoScale: a dial for magnitude, null for
   * declared behaviour.
   */
  decomposerPhotoScale: number | null;
  consumerBasalScale: number | null;
  producerCaptureScale: number | null;
  /**
   * Diagnostic: fraction of founders to seed with decomposer-qualifying genes.
   *
   * null/0 = declared behaviour (no decomposer seeding).
   *
   * NO founder can be a decomposer under declared inits: the gate requires
   * photo<0.34 (founders ~0.71), recalc>0.55 (founders 0.2) or carrion>0.62
   * (founders 0.35), and speed<2.4 (founders ~2.79). Decomposers must evolve a
   * coordinated 3-4 trait shift, which is a high evolutionary barrier. The few
   * that appear early (D0-12) are mutants and go extinct by tick 1400-1900.
   *
   * This seeds the given fraction with genes expressing to photo~0.12,
   * recalc~0.70, speed~1.7 (all qualifying, plus normal jitter). The trait
   * stays heritable, so this tests ECOLOGICAL persistence (can the niche
   * support them?) separately from EVOLUTIONARY ACCESS (can they reach it?).
   * If seeded decomposers persist, the barrier is access. If they still go
   * extinct, the niche itself cannot support them.
   */
  decomposerFounders: number | null;
  /**
   * Diagnostic: decomposer dormancy upkeep multiplier.
   *
   * null (default) = off, byte-identical behaviour.
   *
   * When set (e.g. 0.05), a DECOMPOSER-guild organism enters dormancy when its
   * energy is below its breeding threshold AND no usable substrate is present
   * in its cell. While dormant: basal upkeep is multiplied by this value, no
   * breeding proposals are made, no sensing costs are charged, and starvation
   * damage does not accrue. It exits when substrate arrives or energy rises
   * above threshold.
   *
   * This maps to real microbial dormancy: a starving bacterium burns
   * essentially nothing while waiting. The simulation currently charges
   * sessile decomposers full animal upkeep (75%+ of budget) for a body that
   * does nothing, which is why they starve surrounded by food they cannot
   * reach. Active decomposers (food present) pay full upkeep; producers and
   * consumers never go dormant.
   */
  decomposerDormancy: number | null;
  /**
   * Diagnostic: make dormancy genuinely risky (null = off, declared
   * behaviour).
   *
   * When true, a dormant organism gathers NO information: it does not detect
   * threats, so it cannot flee. A hunter can walk up to a sleeper and the
   * sleeper has no warning.
   *
   * Why this exists: with the flag off, dormancy was strictly dominant — an
   * organism kept full threat detection and FLEE while paying 5% upkeep,
   * starving never, and breeding never. That is an unbeatable strategy, and
   * the measured consequence was the hoarding attractor: the dormant share
   * ran past 90% with no counter-pressure, because nothing could eat a
   * waiting room whose residents could still run.
   *
   * Off, the sensing COST waiver and threat detection stay coupled exactly as
   * before (pay-nothing/see-nothing never disagreed, because the cost waiver
   * only ever skipped the spend). On, pay-nothing also means see-nothing. No
   * RNG is drawn. Rollback: null restores declared behaviour exactly.
   */
  dormantThreatBlind: boolean | null;
  /**
   * Diagnostic: breeding-surplus buffer in ticks (null = declared 90).
   *
   * An organism may breed only while holding this many ticks of its own
   * upkeep in reserve — a drought/famine buffer, so reproduction is gated on
   * condition rather than on a bare threshold. It is the gate that decides
   * whether ANY guild can reproduce.
   *
   * Previously a hardcoded constant (REPRO_SURPLUS_TICKS = 90) at both
   * breeding sites, so no configuration could move it and no experiment could
   * test it. It is the identified blocker on consumer viability: 90 ticks of
   * full-rate surplus exceeds what graze or predation income delivers, which
   * is why consumers went extinct at every food-transfer rung of the ladder
   * and why consumerBasalScale could not help — that discounts COST, not
   * the reserve demanded here.
   *
   * Resolved once at construction and read by both gates. null = declared
   * behaviour exactly. Rollback: null restores 90.
   */
  reproSurplusTicks: number | null;
  /**
   * Diagnostic: mixotrophic carbon requirement (null = off, declared).
   *
   * Owner directive: no guild should survive without the others, and energy
   * should not be free. With this set, a PRODUCER-guild organism's
   * photosynthetic demand is scaled by the local availability of
   * heterotrophic substrate (detritus + sediment + recalcitrant litter),
   * saturating at `mixotrophySaturation`. Bare light is no longer enough:
   * capturing energy requires organic matter to work on, which only exists
   * because heterotrophs (or corpses) made it.
   *
   * Honest limit: producer corpses and photosynthesis overflow also feed the
   * detritus pool, so a pure-producer world is DEPRESSED, not zero. This
   * knob narrows the free lunch; it does not close it. Pair with
   * nutrientCyclic for the nutrient side of the same coupling.
   *
   * No RNG is drawn. Rollback: null restores declared behaviour exactly.
   */
  mixotrophyCarbon: boolean | null;
  /** Substrate level at which mixotrophic carbon availability saturates to 1. */
  mixotrophySaturation: number;
  /**
   * Diagnostic: cyclic nutrient regeneration (null = off, declared).
   *
   * Owner directive: energy should not be free. Declared behaviour lets
   * inorganic nutrient regenerate abiotically at `nutrientRegen` regardless
   * of whether anything is decomposing, which is a free lunch producers can
   * exploit indefinitely. With this set, regeneration is scaled by the local
   * decomposition substrate (detritus + sediment + litter), so nutrient
   * returns to the system only where organic matter is actually being
   * worked on — i.e. where decomposers are active. A producer guild alone,
   * with nothing to decompose, slowly starves.
   *
   * Same saturation field as mixotrophyCarbon. No RNG is drawn. Rollback:
   * null restores declared behaviour exactly.
   */
  nutrientCyclic: boolean | null;
  /**
   * Diagnostic: modular genome v2 (default null = OFF, declared behaviour).
   *
   * Turns the fixed 42-trait + 12-body-gene genome into a short ordered
   * sequence of MODULES — inherited construction instructions, each with a
   * magnitude, a developmental onset and an optional condition gate. Modules
   * express into the EXISTING traits, so no new biological mechanism is
   * introduced; what changes is the heritable structure producing those traits.
   *
   * This exists because measured against the engine, EIGHT of the twelve
   * v1 structural genes are inherited, mutated, and read by nothing:
   * `limbPairs`, `fins`, `antennae`, `tail`, `segments` and all four pigment
   * genes have no survival consequence. A genome whose heritable variation
   * mostly drives appearance is a decorative system wearing a data structure.
   *
   * NULL IS THE POINT. With this unset, no organism carries modules and the
   * expression path is never entered, so declared behaviour is unchanged
   * bit-for-bit and the parity pins remain valid. Rollback is exact.
   */
  genomeV2: boolean | null;
  /**
   * Diagnostic: abiotic nutrient floor as a FRACTION of capacity (0..1,
   * default 0 = off).
   *
   * Owner directive: guilds must truly need each other, and energy should
   * not be free — but the A+C pair as measured produces an irreversible
   * mutual-bootstrap deadlock: nutrient regenerates only where
   * decomposition happens, producers cannot photosynthesise without
   * nutrient, so once the population drops below a few hundred the system
   * can never restart. Measured: 2/18 seeds extinct, 6/18 under 50
   * organisms, and no producerCaptureScale value (1x-10x, sweep recorded in
   * REPORT.md) prevented it — extra light only rotated WHICH guild
   * collapsed.
   *
   * This knob is the recovery path, not an energy subsidy. It guarantees a
   * minimum nutrient level everywhere, at a fraction of per-cell capacity,
   * so a remnant population can always regrow. It is deliberately NOT enough
   * to support a standing population: measured floors are meant to sit well
   * below what producers need to hold a reserve, so it opens a door without
   * feeding anyone. Starting calibration 0.05 (5% of capacity).
   *
   * Independent of nutrientCyclic: the floor is unconditional, the cyclic
   * rate is what substrate scales. Both may be on together.
   */
  nutrientFloor: number;
  /**
   * Diagnostic: decomposer spore dispersal (0 = off, 1 = on).
   *
   * null/0 (default) = declared behaviour (adjacent + normal dispersal).
   *
   * When set, DECOMPOSER-guild newborns are placed as spores: uniform random
   * position within 30-80 field cells of the parent (long-range, wind-like),
   * with 20% directed to the highest-litter cell among 8 candidates. Travel
   * cost is waived (no body travels; this is not movement).
   *
   * Maps to real spore dispersal: sessile decomposers escape their depleted
   * cell because offspring land far away, not adjacent. The normal dispersal
   * places sessile offspring nearby (~100 units), so they compete with the
   * parent for the same litter. Immigration covers cross-map patch targeting;
   * spores cover mid-to-long range litter seeking.
   */
  sporeDispersal: number | null;
  /**
   * Diagnostic: dormant-decomposer senescence (null = off).
   *
   * null (default) = declared behaviour (sleepers wait free of damage).
   *
   * A plain number is fixed-grace mode: a dormant decomposer sleeping longer
   * than that many CONSECUTIVE ticks accrues 0.35 viability damage per extra
   * dormant tick. An object selects a scale-free mode instead:
   * - {mode:'share', scale:R}: no grace; damage per dormant tick equals
   *   0.35 * R * (dormant fraction of the live population). A lone sleeper
   *   waits nearly free; a waiting room that IS the world dies fast. True
   *   negative feedback: hoarding creates its own pressure.
   * - {mode:'lifespan', scale:K}: grace equals K times the organism's own
   *   heritable LIFESPAN trait, then 0.35/tick as in fixed mode. Evolvable
   *   timing, but longevity can outrun it.
   *
   * Waking resets the sleep clock (accrued damage heals only via
   * regeneration). Deaths classify exactly via the senescence share
   * (parallel to starveDamage), folded into the damage bucket of the
   * demographic shape, with the world-level senescenceDeaths counter.
   */
  dormantSenescence: number | DormantSenescence | null;

  // --- Reproduction --------------------------------------------------------
  /** Energy split from parent into each offspring at birth. */
  birthCostFactor: number;

  // --- Disturbances --------------------------------------------------------
  /** Mean ticks between random disturbance attempts. */
  disturbanceInterval: number;
  /** Probability a given disturbance attempt actually fires. */
  disturbanceChance: number;

  /** Cap on organisms to bound memory in a long run. */
  maxPopulation: number;

  /**
   * Seed for the static habitat map. Defaults to `seed`, so habitat varies
   * between scenarios unless a shared substrate is explicitly wanted — which
   * is what matched-control comparisons need.
   */
  habitatSeed?: number | string;

  /**
   * Nutrient replenishment rate toward each cell's carrying capacity. This is
   * a REGENERATION flux, not a fixed addition, so a cell can be genuinely
   * depleted by a sessile producer population and later recover.
   */
  nutrientRegen: number;

  /**
   * Fraction of ingested detritus that a biotic mineraliser returns to the
   * substrate as nutrient. This is what makes decomposers an active
   * ecosystem role rather than scenery.
   */
  bioticMineralisation: number;

  /**
   * Diagnostic: per-phenotype-class mineralization RETURN fraction
   * (O1, Owner Stage 2, issue #15). `null` = declared behaviour, exactly:
   * every class returns in full and the knob restores declared behaviour on
   * rollback with no residue.
   *
   * When set, each named donor class (`carrionOnly`, `recalcOnly`, `dual`;
   * see `classifyMineralPheno` in `src/bio/role.ts`) offers that fraction of
   * its computed return into the per-pool ceiling. `1` = full declared
   * return, `0` = the class offers nothing. Feeding takes, energy flows,
   * organism presence and all unrelated behavior are untouched: only the
   * OFFERED amount shrinks, so the four books stay truthful (attempted
   * reflects actual offers; the deficit reads as null-arm accepted minus
   * suppressed-arm accepted per class, via the O3 books).
   *
   * `neither` events (stale-flag anomalies) always pass through unsuppressed
   * and are reported, never silently zeroed. The coupled cyclic-regeneration
   * and broadcast feedback (`mineralisedCell`, `bioticMineralised`) follows
   * the scaled offer naturally and is measured distinctly through the
   * existing abiotic books — not routed around. Each fraction must be a
   * finite number in [0, 1]; anything else throws at construction. There is
   * deliberately no predicted effect size: suppression moves offers, and the
   * ecosystem answers.
   */
  phenoMineralReturn: { carrionOnly: number; recalcOnly: number; dual: number } | null;

  /**
   * Diagnostic: per-phenotype-class exogenous rescue of suppressed returns
   * (O2, Owner Stage 3, issue #15). `null` = no rescue, exactly: no field
   * write, no book entry, declared behaviour bit-identical.
   *
   * When set, each suppressed event's forgone accepted return — shadow minus
   * actual per pool, measured event-locally against live headroom — is
   * injected back into the SAME cell from an explicitly exogenous donor and
   * booked ONLY into the `exogenousReplacement` family (never into biotic or
   * abiotic books). Per-book-cell identity ("book cell" = one (class, guild,
   * pool, source) ledger address, not a spatial field cell): actual.accepted
   * + exogenous.accepted == shadow.accepted within float summation (G35
   * asserts the bound).
   * Injection with zero remainder is skipped (no clamp side effects); natural
   * paths are untouched. Each flag must be a real boolean; closed key set;
   * anything else throws at construction. Rescue without suppression is an
   * automatic no-op (remainder zero). This is a measurement instrument for
   * the nutrient-mediation question, not restored biological interdependence
   * and not a permanent subsidy: ordinary runs keep it null.
   */
  phenoMineralRescue: { carrionOnly: boolean; recalcOnly: boolean; dual: boolean } | null;

  /** Fraction of basal metabolism excreted back into the local substrate. */
  excretionRate: number;

  /** Scenario label used in benchmark output. */
  label: string;
  /** Seed. */
  seed: number | string;
}

export const DEFAULT_CONFIG: WorldConfig = {
  worldW: 4000,
  worldH: 4000,
  fieldCell: 40,
  spatialCell: 42,

  founders: 1200,
  abioticPeriod: 1,

  baseLight: 1.05,
  lightAmplitude: 0.22,
  abioticCycle: 900,
  baseTemp: 18,
  tempAmplitude: 9,

  nutrientDiffusivity: 0.11,
  // Slow background leaching (was 0.0016): must stay well below the combined
  // weathering + biotic return, or pools ratchet to zero regardless of biology.
  nutrientDecay: 0.0001,
  nutrientPerCell: 26,
  // Capped by the lone-producer constraint: a single producer contributes
  // photo*size ~4.8 of canopy mass, and exp(-0.034*4.8)=0.85, so an isolated
  // organism loses ~15 % of its light. See the note above for why this cannot
  // carry the carrying capacity at this spatial scale.
  shadeExtinction: 0.034,
  // 4x4 substrate cells per canopy cell: aggregates a patch, so shading binds at
  // the sparse densities this world actually occupies. See the note above.
  shadeGrain: 4,
  nutrientCapacity: [1.0, 0.78, 0.62],
  sedimentPerCell: 5.5,
  /**
   * Abiotic mineralisation of sediment. Deliberately SLOW.
   *
   * At the previous rate, 95 % of all detritus was mineralised abiotically
   * rather than processed by organisms, so the detritus pathway that should
   * feed decomposers and scavengers was effectively closed and both guilds sat
   * at 0 % of the population. In real ecosystems "decomposers get what the
   * herbivores and carnivores do not" - organisms take first claim, and abiotic
   * decay is the slow residual. Literature: detritus is ~56 % of primary
   * production on average, up to 90 % in forests. See RESEARCH.md.
   */
  // Biological closure: abiotic organic decay is a slow geological background
  // (~50x below its previous rate), NOT the nutrient return path. Dead matter
  // now persists like real soil organic stock; the cycle turns only when
  // mineralising consumers (bioticMineraliser) eat it and return nutrient.
  // Without this, abiotic decay did the recycling for free and decomposers were
  // optional — which is why they read 0.0% on every seed despite having an
  // exclusive food pool. See REPORT.md (biological closure).
  sedimentDecay: 0.0000016,
  detritusDiffusivity: 0.09,
  detritusDecay: 0.000007,
  recyclingRate: 0.02,

  energyPerFood: 5.2,
  /**
   * External organic input (falling matter) per cell per tick.
   *
   * ZERO by default, and that is the point: this makes the world a CLOSED
   * microcosm in the sense of the Winogradsky column / jar experiment. Light is
   * the only external energy input; every joule of dead organic matter now comes
   * from an organism dying inside the system, and nutrient returns only by being
   * recycled through scavengers and decomposers.
   *
   * At the previous 0.002 this was ~21.6 energy/tick injected forever into
   * every cell, which held every cell ~14x above the detritivore feeding
   * threshold. Detritus was therefore never resource-limited, so detritivores
   * had no gradient to climb and the guilds had nothing to be selected for.
   * That external subsidy - not a missing parameter - was why the detrital
   * pathway could not support itself.
   *
   * A closed system is also the honest simplification: nature's nutrient and
   * carbon cycles are not topped up from outside on the timescale being
   * modelled, and succession rather than equilibrium is the expected behaviour.
   */
  basalFoodPerCell: 0,

  locomotionCostScale: 1.0,

  // Stress-induced mutagenesis gain (see field comment). 1.0 caps the boost at
  // ~2x background for a maximally stressed parent; eligibility gates (which
  // require breeders to hold energy and limit damage) cap the REALIZED boost
  // lower still, around ~1.3-1.5x. This is deliberately conservative: 3.0 was
  // tried and measured, and on seed 11 it accelerated producer life-history
  // evolution (maturity 224 -> 131 ticks) enough that the income-breeding drive
  // multiplier converted it into unbounded growth (1469 -> 7167 @1500 ticks).
  // Gain 0 and 1.0 both stay bounded; 1.0 preserves gentle acceleration while
  // 3.0 is unsafe in combination with the drive multiplier. See REPORT.md.
  stressMutagenesis: 1.0,
  radiation: null,
  // Pioneer establishment bonus (see field comment). Null = off.
  pioneerBonus: null,
  /**
   * Diagnostic: diseased food fraction (null = off).
   *
   * When set to p in (0,1], that fraction of heterotroph biomass meals
   * (grazed, predated, sediment/suspended-detritus, litter) is diseased and
   * deals fixed viability damage instead of clean energy. Photosynthesis and
   * mineral uptake are not food and never roll. Uses the main RNG stream
   * (knob-on runs diverge from knob-off by stream position; per-config
   * determinism exact). Rollback: null restores declared behaviour exactly.
   */
  foodDisease: null,

  // Trophic transfer efficiency (see field comment). 1.6 = status quo ante.
  meatYieldPerMass: 1.6,
  plantYieldPerMass: 0,

  // Metapopulation grid: 4x4 patches, and a moderate empty-patch bias. The bias
  // is what turns ordinary far dispersal into directed recolonisation.
  metapopulationPatches: 4,
  immigrationWeight: 1.0,
  // Recalcitrant pool. Starts small because it is fed by deaths and litter rain,
  // and decays slowest so that a thin flux integrates into a usable reservoir
  // instead of vanishing. This pool is the decomposers' exclusive niche; if
  // decomposers read 0 %, raise litterFraction before changing code.
  litterPerCell: 2.0,
  // Near-zero geological background (was 0.00012): litter persists until
  // something with recalcitrant digestion eats it, as in real soil.
  litterDecay: 0.0000024,
  // 0.18, not 0.45. A corpse IS mostly structural in reality, but routing 45 %
  // of every corpse into a pool that only rare decomposers can reach LOCKED that
  // energy: measured, the whole ecosystem starved (all guilds -> 0 by t1200 while
  // the pool grew). Real systems lose no energy this way because decomposer
  // biomass is enormous; here it is a handful of organisms. This is the dial to
  // turn before changing any code - see REPORT.md.
  litterFraction: 0.10,
  // 0.06, not 0.3. Basal organic input is the main labile subsidy; routing 30 %
  // of it into a pool that only rare decomposers can digest starved the whole
  // ecosystem from tick zero (measured: every guild -> 0 by t1200). The pool has
  // to be an exclusive MARGIN, not a large share of the flux.
  litterRainShare: 0.06,
  energyPerCarrion: 3.1,

  reproThresholdInit: null,
  asexualRateInit: null,
  clutchSizeInit: null,
  reproActCostScale: null,
  birthTransferScale: null,
  predationYieldScale: null,
  grazeYieldScale: null,
  consumerPhotoScale: null,
  decomposerPhotoScale: null,
  consumerBasalScale: null,
  producerCaptureScale: null,
  decomposerFounders: null,
  decomposerDormancy: null,
  dormantThreatBlind: null,
  reproSurplusTicks: null,
  // Guild-interdependence pair (see field comments). null = declared.
  mixotrophyCarbon: null,
  mixotrophySaturation: 0.4,
  nutrientCyclic: null,
  // Modular genome v2 (see field comment). null = declared behaviour, exactly.
  genomeV2: null,
  // O1 phenotype-class return fractions (see field comment). null = declared.
  phenoMineralReturn: null,
  // O2 exogenous rescue flags (see field comment). null = no rescue.
  phenoMineralRescue: null,
  nutrientFloor: 0,
  sporeDispersal: null,
  dormantSenescence: null,

  birthCostFactor: 0.42,

  disturbanceInterval: 260,
  disturbanceChance: 0.55,

  maxPopulation: 60000,

  // Weathering floor (was 0.014): abiotic nutrient supply is a slow trickle,
  // NOT the return path. The toward-capacity shape is retained because it is
  // inherently deadlock-safe (refills fastest where most depleted), but at this
  // rate it cannot carry producer growth alone — the cycle turns only when
  // biotic mineralisation returns nutrient from dead matter. That dependence is
  // the point: producers need decomposers the way real primary production needs
  // microbial recycling, instead of weathering doing it for free.
  nutrientRegen: 0.0002,
  bioticMineralisation: 0.45,
  excretionRate: 0.06,

  label: 'default',
  seed: 1,
};

/** Deep-merge a partial override onto the baseline. */
export function resolveConfig(over: Partial<WorldConfig> = {}): WorldConfig {
  return { ...DEFAULT_CONFIG, ...over };
}

/** Order-dependent stable fingerprint of a resolved config, for evidence. */
export function configFingerprint(c: WorldConfig): string {
  const keys = Object.keys(c).filter((k) => k !== 'label') as Array<keyof WorldConfig>;
  keys.sort();
  let h = 0x811c9dc5;
  for (const k of keys) {
    const v = c[k] as unknown;
    // Objects (e.g. the senescence setting) stringify opaquely as
    // "[object Object]", colliding across distinct configs in evidence
    // transcripts — serialize structurally instead. Key order is insertion
    // order, stable for our constructed settings objects.
    const s = `${k}=${typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)};`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}