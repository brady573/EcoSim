"use strict";
/**
 * Derived ecological role, motility, and life stage.
 *
 * CRITICAL DISTINCTION — these are READOUTS, not authority:
 * nothing here assigns an outcome, a behaviour, or a fate. Every value is
 * computed from an organism's expressed phenotype, which itself comes from its
 * genome, so changing the genes changes the role. There is no species table and
 * no "this is a predator" flag that was set at spawn.
 *
 * Note on scope, stated precisely because it is easy to overstate: `motility`
 * and `bioticMineraliser` ARE consulted by the simulation (to gate locomotion
 * and to gate mineralisation respectively). That is a *derived* gate, not an
 * assigned label - the values come from the genome, not from a species
 * definition - but the readout does influence mechanics, and this file does not
 * pretend otherwise.
 *
 * That is what keeps the model honest: "predator" is what a large, toxic,
 * aggressive organism *is*, not a label a designer attached to it.
 *
 * MOTILITY is the important forward-compatibility decision here. Producers
 * (high photosynthetic capacity) are sessile: they are rooted in the substrate
 * and pay for autotrophy with the ability to move. This is a real biological
 * trade-off, not a convenience, and it falls out of existing genes rather than
 * requiring a dedicated "am I a plant" flag. A photosynthetic organism with
 * high locomotor genes is semi-motile, which is the algae/plankton case.
 *
 * LIFE STAGE gives developmental growth without new genes: juvenile body size,
 * damage output, and reproductive competence all scale with progress through
 * the maturity window. The seam exists so later work can add metamorphosis,
 * castes, or growth stages without changing the representation.
 *
 * LIMITATION (disclosed): life stage is a single scalar progression. Real
 * ontogenies are discontinuous (metamorphosis, instars). That is a known gap,
 * not an oversight.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_EXTENSIONS = exports.ROLE_TRAIT_COUNT = exports.LIFE_STAGE_NAME = exports.LIFE_STAGE = exports.MOTILITY_NAME = exports.MOTILITY = exports.TROPHIC_COUNT = exports.TROPHIC_NAME = exports.TROPHIC = void 0;
exports.deriveRole = deriveRole;
exports.developmentalScale = developmentalScale;
exports.stageDamageFactor = stageDamageFactor;
const genome_js_1 = require("./genome.js");
exports.TROPHIC = {
    /** Autotroph: converts abiotic nutrient + light into biomass. */
    PRODUCER: 0,
    /**
     * Mobile heterotroph: hunts, grazes, scavenges, or mixes all three.
     *
     * Collapsed from predator/scavenger/grazer (v0.3.3). Those were readout-only
     * distinctions — behaviour keys on raw traits through utility arbitration,
     * and the only behavioural branch is producer-vs-non-producer. Diet
     * specialisation lives in genes (toxin, aggression, carrionAffinity,
     * detritivory), not in this label. The functional divide that matters is
     * mobility + mineralisation: consumers move and eat anything; decomposers
     * sit and return nutrient.
     */
    CONSUMER: 1,
    /** Sessile heterotroph that mineralises detritus in place. */
    DECOMPOSER: 2,
};
exports.TROPHIC_NAME = {
    0: 'producer',
    1: 'consumer',
    2: 'decomposer',
};
/** Number of trophic guilds. Exported so array strides derive from it. */
exports.TROPHIC_COUNT = 3;
/**
 * Motility class.
 *
 * `reach` is the interaction reach in world units, separate from locomotion:
 * a sessile organism can still have a long reach (a polyp's tentacle, a
 * fungus's hyphal front), which is why the two are not the same number.
 */
exports.MOTILITY = {
    /** Rooted. Cannot translate; can still sense and interact. */
    SESSILE: 0,
    /** Slow crawl / creep. */
    CREEP: 1,
    /** Full locomotion. */
    MOBILE: 2,
};
exports.MOTILITY_NAME = {
    0: 'sessile',
    1: 'creep',
    2: 'mobile',
};
exports.LIFE_STAGE = {
    JUVENILE: 0,
    ADULT: 1,
    SENESCENT: 2,
};
exports.LIFE_STAGE_NAME = {
    0: 'juvenile',
    1: 'adult',
    2: 'senescent',
};
/**
 * Derive role/motility/stage from expressed traits.
 *
 * Takes the flattened expressed-trait block directly so it can be called
 * without materialising a Phenotype object.
 */
function deriveRole(p, base, age) {
    const size = p[base + genome_js_1.TRAIT.SIZE];
    const photo = p[base + genome_js_1.TRAIT.PHOTOSYNTHETIC_RATE];
    const speed = p[base + genome_js_1.TRAIT.SPEED];
    const burst = p[base + genome_js_1.TRAIT.BURST_POWER];
    const toxin = p[base + genome_js_1.TRAIT.TOXIN];
    const carrion = p[base + genome_js_1.TRAIT.CARRION_AFFINITY];
    const recalc = p[base + genome_js_1.TRAIT.RECALCITRANT_DIGESTION];
    const maturityAge = p[base + genome_js_1.TRAIT.MATURITY_AGE];
    const lifespan = p[base + genome_js_1.TRAIT.LIFESPAN];
    const vision = p[base + genome_js_1.TRAIT.VISION_RANGE];
    const limbs = p[base + genome_js_1.TRAIT.MANEUVERABILITY];
    // --- Trophic role -------------------------------------------------------
    // Continuous inputs, thresholded only to name the dominant strategy. The
    // thresholds are for READABILITY, not for behaviour: behaviour comes from
    // the utility arbitration in the world, which uses the raw traits.
    let trophic;
    if (photo > 0.34) {
        trophic = exports.TROPHIC.PRODUCER;
    }
    else if ((recalc > 0.55 || carrion > 0.62) && photo < 0.34 && speed < 2.4) {
        // Sessile structural/carrion specialist: mineralises in place rather than
        // roaming. The niche is defined by what it can DIGEST (recalcitrance) or
        // by carrion specialisation — tested before the consumer fallback so a
        // slow specialist reads as a decomposer whatever else it resembles.
        trophic = exports.TROPHIC.DECOMPOSER;
    }
    else {
        // Every other heterotroph — hunter, grazer, scavenger, opportunist, or any
        // mix — is a CONSUMER. Formerly split three ways; collapsed because the
        // split was readout-only and behaviour never branched on it.
        trophic = exports.TROPHIC.CONSUMER;
    }
    // --- Motility -----------------------------------------------------------
    // The autotrophy/immobility trade-off. Producers are rooted; how rooted
    // depends on how much phototrophic capacity they actually invested in.
    const locomotor = speed * (1 - photo * 0.75) + burst * 0.3 + limbs * 0.8;
    let motility;
    if (locomotor < 1.1 || photo > 0.55)
        motility = exports.MOTILITY.SESSILE;
    else if (locomotor < 2.6)
        motility = exports.MOTILITY.CREEP;
    else
        motility = exports.MOTILITY.MOBILE;
    // --- Developmental growth ----------------------------------------------
    // Normalised progress through the juvenile window, then a senescence tail.
    let maturation;
    if (maturityAge <= 1)
        maturation = 1;
    else
        maturation = age <= maturityAge ? age / maturityAge : 1;
    let stage;
    if (age <= maturityAge)
        stage = exports.LIFE_STAGE.JUVENILE;
    else if (age > lifespan * 0.78)
        stage = exports.LIFE_STAGE.SENESCENT;
    else
        stage = exports.LIFE_STAGE.ADULT;
    // --- Reach --------------------------------------------------------------
    // Reach is not locomotion. A sessile organism may still affect something a
    // body-length away; a fast one is not necessarily able to grapple.
    const reach = Math.sqrt(size) * 1.5 + vision * 0.06 + (trophic === exports.TROPHIC.PRODUCER ? 0 : toxin * 2.2);
    return {
        trophic,
        motility,
        maturation,
        stage,
        reach,
        // A decomposer is defined by doing the mineralising, not by a label: slow,
        // carrion-adapted, and not autotrophic.
        // A mineraliser is defined by what it converts, so a structural-digestion
        // specialist qualifies on recalcitrant tolerance alone, not only on high
        // carrion affinity.
        //
        // The recalc path does NOT require sessility; the carrion path does. A
        // mobile detritivore with structural-digestion enzymes mineralises —
        // earthworm castings are the canonical example — while carcass processing
        // benefits from residence time (sessile mats work a carcass thoroughly;
        // a passerby does not). Digestive specialization, not motility, is what
        // matters for the recalcitrant pathway.
        //
        // Known consequence: mobile high-recalc organisms now close the loop while
        // reading as scavengers/grazers (the DECOMPOSER readout above still
        // requires speed < 2.4). Label and function may diverge — mineralisation
        // happens, decomposer count stays low. If that occurs it is informative,
        // not a bug: it means the loop closes through mobile generalists, and the
        // follow-up question is whether sessile specialists then establish on the
        // resulting abundance, or whether the readout itself should drop sessility
        // for the recalc path. Deliberately NOT changed here: one conceptual change
        // at a time, and the readout redefinition needs its own evidence.
        bioticMineraliser: photo < 0.34 &&
            ((carrion > 0.55 && speed < 2.4) || recalc > 0.5),
    };
}
/** Count of traits, exposed so reports can state model complexity. */
exports.ROLE_TRAIT_COUNT = genome_js_1.TRAIT_COUNT;
exports.ROLE_EXTENSIONS = [];
/** Effective body size for collisions and rendering: grows during development. */
function developmentalScale(readout, baseHitRadius) {
    // Juveniles are ~55% of adult size, reaching full size at maturity. Senescent
    // organisms shrink slightly, which is cheap but visible.
    const grow = 0.55 + 0.45 * readout.maturation;
    const shrink = readout.stage === exports.LIFE_STAGE.SENESCENT ? 0.92 : 1;
    return baseHitRadius * grow * shrink;
}
/** Damage multiplier from developmental stage: juveniles cannot fight. */
function stageDamageFactor(readout) {
    if (readout.stage === exports.LIFE_STAGE.JUVENILE)
        return 0.25 + 0.75 * readout.maturation;
    if (readout.stage === exports.LIFE_STAGE.SENESCENT)
        return 0.72;
    return 1;
}
