/**
 * Heritable genome for the experimental evolution engine.
 *
 * Two-part representation:
 *  1. `traits` — a Float32Array of NORMALIZED gene values in [0,1]. Storing
 *     normalized keeps mutation, clamping and recombination uniform across
 *     traits that live on wildly different physical scales (metabolic
 *     efficiency in [0.5,4] vs maturity age in [8,400] ticks).
 *  2. `bodyGenes` — discrete structural genes that select a body plan. These
 *     are what make morphology *inherited and mutable* rather than re-rolled
 *     at birth.
 *
 * Everything here is heritable and mutable. There is no species table, no
 * hand-authored creature list, and no fixed outcome label: a lineage's identity
 * is whatever its genes happen to add up to.
 *
 * Limits are deliberately permissive. They are modelling bounds, not fitness
 * targets — nothing rewards an organism for sitting at a limit.
 */
export const TRAIT = {
    // --- Metabolism -----------------------------------------------------------
    /** Conversion efficiency of assimilated food into usable energy. */
    METABOLIC_EFFICIENCY: 0,
    /** How much energy can be banked before overflow spoilage. */
    STORAGE_CAPACITY: 1,
    /** Rate at which ingested material is assimilated. */
    DIGESTION_RATE: 2,
    /** Baseline energy burn per tick, independent of activity. */
    BASAL_COST: 3,
    /** Energy captured from ambient light (0 = obligate heterotroph). */
    PHOTOSYNTHETIC_RATE: 4,
    /** Width of the viable abiotic-temperature band. */
    THERMAL_TOLERANCE: 5,
    /** Ability to process detritus/scarcasses instead of fresh prey. */
    CARRION_AFFINITY: 6,
    // --- Sensing --------------------------------------------------------------
    VISION_RANGE: 7,
    VISION_FOV: 8,
    /** Chemoreceptive detection of nutrient/resource gradients. */
    NUTRIENT_SENSE: 9,
    /** Chemoreceptive detection of conspecifics and predators. */
    THREAT_SENSE: 10,
    /** How long a learned/resource memory persists (ticks). */
    MEMORY: 11,
    // --- Nutrient partitioning ------------------------------------------------
    /**
     * Relative reliance on each of the three independently limiting nutrients.
     *
     * These three are the mechanism that permits species coexistence. Affinities
     * are the heritable basis of niche partitioning: an A-specialist and a
     * B-specialist draw on different pools, so they stop competing directly and
     * competitive exclusion no longer forces one out. Under competitive exclusion
     * a single limiting resource forbids coexistence outright, so this is load
     * bearing rather than decorative. See RESEARCH.md.
     */
    NUTRIENT_A: 36,
    NUTRIENT_B: 37,
    NUTRIENT_C: 38,
    // --- Dispersal ------------------------------------------------------------
    /**
     * Dispersal ability: how far offspring are placed from the parent.
     *
     * Essential for sessile organisms. A rooted producer that only buds in place
     * permanently exhausts the cell it roots in and has no way to reach fresh
     * substrate, so a sessile population strips its patch and dies. Real plants
     * solve this with seeds and spores; this is the heritable analogue.
     */
    DISPERSAL: 39,
    // --- Foraging strategy ---------------------------------------------------
    /**
     * Benthic / deposit-feeding specialisation.
     *
     * Without a way to express STRATEGY, every non-photosynthetic organism
     * detritivore and predator had the same effective diet, so two consumer
     * species competed directly for the same resource and one was always
     * excluded - a restatement of competitive exclusion inside a single
     * trophic guild. This trait lets deposit feeders, mobile hunters and
     * generalists diverge. See RESEARCH.md.
     */
    DETRITIVORY: 40,
    /**
     * Tolerance for recalcitrant (structural, lignified) detritus. Gates access
     * to the litter pool.
     *
     * Detritus was modelled as ONE entirely labile pool, so scavengers and
     * decomposers drew on identical resource units and competitive exclusion
     * removed decomposers on every seed (scavengers 2-9 %, decomposers 0.0 %).
     *
     * Real dead organic matter is mostly recalcitrant structural material -
     * cellulose, lignin - that animals cannot digest at all, while microbes can.
     * That quality difference IS the niche, and it is a property of the material
     * rather than a label on the organism: access is gated by this digestive
     * capability, never by `trophic`. An organism becomes a decomposer by evolving
     * the enzymes, exactly as `role.ts` reads it out as a consequence.
     */
    RECALCITRANT_DIGESTION: 41,
    // --- Locomotion -----------------------------------------------------------
    SPEED: 12,
    BURST_POWER: 13,
    MANEUVERABILITY: 14,
    ENDURANCE: 15,
    /** Ability to traverse low-nutrient / difficult substrate. */
    TERRAIN_AFFINITY: 16,
    // --- Reproduction ---------------------------------------------------------
    /** Age at which sexual/asexual reproduction becomes possible. */
    MATURITY_AGE: 17,
    /** Baseline probability of asexual budding per tick when energy-rich. */
    ASEXUAL_RATE: 18,
    /** Offspring per successful reproduction event. */
    CLUTCH_SIZE: 19,
    /** Per-gene mutation sigma applied to offspring. */
    MUTATION_RATE: 20,
    /** Probability-weighted drive to seek a mate vs. reproduce alone. */
    MATE_SEEKING: 21,
    /** Energy reserve fraction that must be exceeded to attempt reproduction. */
    REPRO_THRESHOLD: 22,
    // --- Physiology -----------------------------------------------------------
    /** Body size/mass. Drives cost, damage, speed and edible yield. */
    SIZE: 23,
    /** Structural defence against predation. */
    ARMOR: 24,
    /** Active counter-offence (venom/stinger). */
    TOXIN: 25,
    /** Resistance to toxins. */
    IMMUNITY: 26,
    /** Lifespan; senescence begins at a fraction of this. */
    LIFESPAN: 27,
    /** Energy cost per unit body mass per tick. */
    MASS_COST: 28,
    /** Regeneration rate after damage. */
    REGENERATION: 29,
    // --- Behaviour ------------------------------------------------------------
    /** Readiness to initiate contested interactions. */
    AGGRESSION: 30,
    /** Readiness to flee contested interactions. */
    TIMIDITY: 31,
    /** Drive to explore toward resource signal over staying put. */
    FORAGING_DRIVE: 32,
    /** Tendency to remain near conspecifics. */
    HERD_INSTINCT: 33,
    /** Local-random-walk rate. */
    EXPLORATION: 34,
    /** Preference for consuming fresh matter vs. waiting. */
    FEEDING_APPETITE: 35,
};
export const TRAIT_COUNT = 42;
/** Fixed layout of the discrete body-plan gene block. */
export const BODY_GENE_COUNT = 12;
function t(key, name, lo, hi, init, sigma, spread = 0.35) {
    return { key, name, lo, hi, init, sigma, spread };
}
/** Physical bounds and founder values, indexed by normalized gene. */
export const TRAITS = [
    // Metabolism
    t(TRAIT.METABOLIC_EFFICIENCY, 'metabolicEfficiency', 0.25, 0.95, 0.5, 0.055),
    // init is a NORMALISED GENE, not a physical value. This one was declared
    // `70` - the intended physical capacity - which clamped to 1.0 and gave every
    // founder maximum capacity with zero founding variation. 58/208 = 0.2788
    // expresses the same physical 70 that was evidently intended.
    t(TRAIT.STORAGE_CAPACITY, 'storageCapacity', 12, 220, 0.2788, 0.06),
    t(TRAIT.DIGESTION_RATE, 'digestionRate', 0.05, 1.4, 0.45, 0.05),
    t(TRAIT.BASAL_COST, 'basalCost', 0.012, 0.42, 0.07, 0.05),
    // Founder phototrophy is set so a producer at founder traits roughly breaks
    // even against its own upkeep (~+8 % margin). The previous init (0.25) put
    // every founder producer at a ~-67 % deficit, so the founding population bled
    // out before selection could reach a viable phototroph. Founder traits define
    // where evolution STARTS; they are not a biological claim, and seeding an
    // arithmetically non-viable population would have tested the wrong thing.
    t(TRAIT.PHOTOSYNTHETIC_RATE, 'photosyntheticRate', 0, 1.15, 0.62, 0.07, 0.5),
    t(TRAIT.THERMAL_TOLERANCE, 'thermalTolerance', 0.06, 0.95, 0.4, 0.05),
    t(TRAIT.CARRION_AFFINITY, 'carrionAffinity', 0, 1, 0.35, 0.06, 0.5),
    // Sensing
    t(TRAIT.VISION_RANGE, 'visionRange', 6, 230, 0.35, 0.06),
    // init is a NORMALISED GENE. This was 1.6 - a physical value in RADIANS -
    // which clamped to 1.0, so every founder started with a full 360 deg field of
    // view and no directional blind spot. (1.6 - 0.15) / (2pi - 0.15) = 0.2364
    // expresses the same ~92 deg forward field that was evidently intended.
    t(TRAIT.VISION_FOV, 'visionFov', 0.15, Math.PI * 2, 0.2364, 0.05),
    t(TRAIT.NUTRIENT_SENSE, 'nutrientSense', 0, 1, 0.4, 0.06, 0.5),
    t(TRAIT.THREAT_SENSE, 'threatSense', 0, 1, 0.4, 0.06, 0.5),
    t(TRAIT.MEMORY, 'memory', 0, 240, 0.2, 0.05, 0.5),
    // Locomotion
    t(TRAIT.SPEED, 'speed', 0.25, 7.5, 0.35, 0.055),
    t(TRAIT.BURST_POWER, 'burstPower', 0, 4.2, 0.25, 0.055),
    t(TRAIT.MANEUVERABILITY, 'maneuverability', 0.05, 1, 0.45, 0.05),
    t(TRAIT.ENDURANCE, 'endurance', 0.05, 1, 0.45, 0.05),
    t(TRAIT.TERRAIN_AFFINITY, 'terrainAffinity', 0, 1, 0.4, 0.05, 0.5),
    // Reproduction
    // Maturity is inverted: a LOW gene value means an early-maturing organism.
    t(TRAIT.MATURITY_AGE, 'maturityAge', 420, 10, 0.45, 0.05),
    t(TRAIT.ASEXUAL_RATE, 'asexualRate', 0, 0.055, 0.2, 0.055, 0.5),
    t(TRAIT.CLUTCH_SIZE, 'clutchSize', 1, 11, 0.35, 0.05),
    t(TRAIT.MUTATION_RATE, 'mutationRate', 0.0004, 0.055, 0.2, 0.03),
    t(TRAIT.MATE_SEEKING, 'mateSeeking', 0, 1, 0.4, 0.055, 0.5),
    t(TRAIT.REPRO_THRESHOLD, 'reproThreshold', 0.2, 0.98, 0.6, 0.045),
    // Physiology
    t(TRAIT.SIZE, 'size', 0.35, 15.5, 0.42, 0.05),
    t(TRAIT.ARMOR, 'armor', 0, 1, 0.3, 0.05, 0.5),
    t(TRAIT.TOXIN, 'toxin', 0, 1, 0.2, 0.055, 0.5),
    t(TRAIT.IMMUNITY, 'immunity', 0, 0.92, 0.25, 0.05, 0.5),
    t(TRAIT.LIFESPAN, 'lifespan', 1500, 90, 0.4, 0.045),
    t(TRAIT.MASS_COST, 'massCost', 0.004, 0.085, 0.028, 0.045),
    t(TRAIT.REGENERATION, 'regeneration', 0, 0.09, 0.025, 0.05, 0.5),
    // Behaviour
    t(TRAIT.AGGRESSION, 'aggression', 0, 1, 0.35, 0.055, 0.5),
    t(TRAIT.TIMIDITY, 'timidity', 0, 1, 0.35, 0.055, 0.5),
    t(TRAIT.FORAGING_DRIVE, 'foragingDrive', 0, 1, 0.55, 0.055, 0.5),
    t(TRAIT.HERD_INSTINCT, 'herdInstinct', 0, 1, 0.3, 0.055, 0.5),
    t(TRAIT.EXPLORATION, 'exploration', 0, 1, 0.4, 0.055, 0.5),
    t(TRAIT.FEEDING_APPETITE, 'feedingAppetite', 0, 1, 0.5, 0.055, 0.5),
    // Nutrient partitioning. Specialisation is encouraged by giving affinity a
    // narrow useful range: an organism strongly specialised on one nutrient has
    // little capacity to switch if that pool is depleted.
    //
    // These MUST sit at the end of this array. `TRAITS` is indexed positionally
    // and every lookup is `TRAITS[TRAIT.X]`, so array position and enum value
    // have to agree exactly. Placing these earlier in the array silently shifted
    // every trait after the insertion point - which presented as instant total
    // extinction with every organism dying of "old age" at tick < their lifespan,
    // because SIZE and LIFESPAN were reading the wrong genes.
    t(TRAIT.NUTRIENT_A, 'nutrientA', 0, 1, 0.34, 0.075, 0.5),
    t(TRAIT.NUTRIENT_B, 'nutrientB', 0, 1, 0.33, 0.075, 0.5),
    t(TRAIT.NUTRIENT_C, 'nutrientC', 0, 1, 0.33, 0.075, 0.5),
    // Dispersal. Costs energy to move far, so this creates a genuine
    // trade-off between escaping depleted substrate and funding the journey:
    // too little dispersal strands offspring, too much starves them en route.
    t(TRAIT.DISPERSAL, 'dispersal', 0, 1, 0.45, 0.06, 0.5),
    // Foraging strategy. Deliberately a continuum rather than discrete modes:
    // niche partitioning works by degree of specialisation, and a hard
    // "guild" flag would be the fixed-outcome labelling the design forbids.
    t(TRAIT.DETRITIVORY, 'detritivory', 0, 1, 0.55, 0.06, 0.5),
    // Structural-digestion capacity. Must stay LAST: TRAITS is indexed by
    // position and `assertTraitLayout` requires position == enum value.
    //
    // init 0.2 so founders are mostly labile-dependent and recalcitrant digestion
    // is a gain of function that has to be evolved - ligninase production is a
    // derived, relatively rare innovation, not a default. Non-zero so standing
    // variation exists for selection to work on at all.
    t(TRAIT.RECALCITRANT_DIGESTION, 'recalcitrantDigestion', 0, 1, 0.2, 0.06, 0.5),
];
/**
 * Verify that array position equals enum value for every trait.
 *
 * This is the invariant the flattened per-organism block depends on. It is
 * asserted at module load rather than left to a comment, because violating it
 * corrupts every genome in the world without throwing.
 */
(function assertTraitLayout() {
    for (let i = 0; i < TRAITS.length; i++) {
        if (TRAITS[i].key !== i) {
            throw new Error(`genome layout mismatch: TRAITS[${i}] has key ${TRAITS[i].key} ` +
                `(${TRAITS[i].name}). Array position must equal enum value.`);
        }
    }
    if (TRAITS.length !== TRAIT_COUNT) {
        throw new Error(`genome layout mismatch: ${TRAITS.length} specs but TRAIT_COUNT=${TRAIT_COUNT}`);
    }
    // Every founder init must be a valid normalised gene. An out-of-range init is
    // clamped by `seedFounders` to the trait bound, which saturates the trait and
    // removes all founding variation - silently, with no crash and no plausible
    // diagnostic signal. `storageCapacity` shipped with a physical init of 70 for
    // exactly this reason, and it went unnoticed because the simulation ran
    // plausibly. Asserted here so the next mistake is a load-time throw.
    for (const spec of TRAITS) {
        if (!(spec.init >= 0) || !(spec.init <= 1)) {
            throw new Error(`genome founder init out of gene range: ${spec.name} (${spec.key}) has ` +
                `init=${spec.init}. init is a NORMALISED GENE in [0,1], not a physical ` +
                `value. Physical bounds are lo=${spec.lo}, hi=${spec.hi}; express the ` +
                `intended physical value as (value - lo) / (hi - lo).`);
        }
        if (spec.lo === spec.hi) {
            throw new Error(`genome degenerate range: ${spec.name} has lo === hi === ${spec.lo}`);
        }
    }
})();
/**
 * Discrete structural genes. These are integers chosen from bounded ranges
 * and mutated as integers, so a body plan changes by discrete structural
 * steps (lose a limb pair, gain a shell) rather than by lerping.
 */
export const BODY_GENE = {
    SEGMENTS: 0,
    LIMB_PAIRS: 1,
    EYE_COUNT: 2,
    SHELL: 3,
    SPINES: 4,
    FINS: 5,
    ANTENNAE: 6,
    TAIL: 7,
    PIGMENT_HUE: 8,
    PIGMENT_SAT: 9,
    PIGMENT_VAL: 10,
    PATTERN: 11,
    BODY_GENE_COUNT: 12,
};
export const BODY_GENES = [
    { key: BODY_GENE.SEGMENTS, name: 'segments', lo: 1, hi: 7, init: 3 },
    { key: BODY_GENE.LIMB_PAIRS, name: 'limbPairs', lo: 0, hi: 4, init: 2 },
    { key: BODY_GENE.EYE_COUNT, name: 'eyeCount', lo: 0, hi: 6, init: 2 },
    { key: BODY_GENE.SHELL, name: 'shell', lo: 0, hi: 3, init: 1 },
    { key: BODY_GENE.SPINES, name: 'spines', lo: 0, hi: 3, init: 0 },
    { key: BODY_GENE.FINS, name: 'fins', lo: 0, hi: 3, init: 1 },
    { key: BODY_GENE.ANTENNAE, name: 'antennae', lo: 0, hi: 2, init: 1 },
    { key: BODY_GENE.TAIL, name: 'tail', lo: 0, hi: 2, init: 1 },
    { key: BODY_GENE.PIGMENT_HUE, name: 'pigmentHue', lo: 0, hi: 255, init: 120 },
    { key: BODY_GENE.PIGMENT_SAT, name: 'pigmentSat', lo: 30, hi: 100, init: 62 },
    { key: BODY_GENE.PIGMENT_VAL, name: 'pigmentVal', lo: 25, hi: 95, init: 60 },
    { key: BODY_GENE.PATTERN, name: 'pattern', lo: 0, hi: 5, init: 2 },
];
/** Bitflags for structural presence, derived from body genes. */
export const MODULE = {
    SHELL: 1 << 0,
    SPINES: 1 << 1,
    FINS: 1 << 2,
    ANTENNAE: 1 << 3,
    TAIL: 1 << 4,
    /** Derived from pigmentSat + photosyntheticRate, not a direct gene. */
    CHROMATOPHORE: 1 << 5,
};
/** Materialize a normalized gene into its physical trait value. */
export function express(gene, spec) {
    return spec.lo + gene * (spec.hi - spec.lo);
}
/** Inverse of {@link express}; used when writing evidence exports. */
export function normalize(value, spec) {
    return (value - spec.lo) / (spec.hi - spec.lo);
}
