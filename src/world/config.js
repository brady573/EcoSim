/**
 * World configuration for the experimental evolution engine.
 *
 * Every field here participates in the reproducibility contract
 * (engineVersion + resolved config + seed). Defaults are the experiment's
 * baseline; `WorldConfig` is fully resolved at construction and is safe to
 * serialize, so a benchmark run can record exactly what it ran.
 */
export const DEFAULT_CONFIG = {
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
export function resolveConfig(over = {}) {
    return { ...DEFAULT_CONFIG, ...over };
}
/** Order-dependent stable fingerprint of a resolved config, for evidence. */
export function configFingerprint(c) {
    const keys = Object.keys(c).filter((k) => k !== 'label');
    keys.sort();
    let h = 0x811c9dc5;
    for (const k of keys) {
        const v = c[k];
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
