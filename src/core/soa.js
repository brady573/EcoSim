/**
 * Structure-of-arrays organism store.
 *
 * This is the single most important performance decision in the POC. At 50k
 * organisms updated every tick, an array of 50k class instances with ~40
 * fields each means pointer chasing through the JS heap and megabytes of
 * garbage per tick. Splitting each field into its own contiguous typed array
 * turns the per-tick sweep into a handful of linear scans over packed Float32
 * data, which is where the throughput in the performance report comes from.
 *
 * Identity and determinism:
 *  - `slot` is a dense array position, reused via a deterministic LIFO free
 *    list. Dense means the update loop never walks holes.
 *  - `id` is a stable monotonically-increasing identity that survives slot
 *    reuse. All lineage/parentage references use `id`, never `slot`, so
 *    recycling a slot cannot corrupt an ancestry chain.
 *
 * Cost of this choice (disclosed): every field access needs a base offset, so
 * the code is more verbose than an object model. That is a deliberate trade.
 */
/**
 * Layout constants are defined ONCE, in the genome, and re-exported here.
 *
 * These were previously duplicated as literals in two files, which is exactly
 * the kind of thing that silently corrupts a flattened per-organism array when
 * a trait is added: the block stride and the trait count must move together or
 * every genome in the world is misread.
 */
import { TRAIT_COUNT as TC, BODY_GENE_COUNT as BGC } from '../bio/genome.js';
/** Re-exported so every module has exactly one definition of the layout. */
export const TRAIT_COUNT = TC;
export const BODY_GENE_COUNT = BGC;
/**
 * Stride of the cached role/stage readout block: trophic, motility, maturation
 * quantised, stage, reach quantised. Kept small and flat so it costs one byte
 * per field per slot and never fragments.
 */
export const ROLE_STRIDE = 5;
/**
 * Number of independently limiting abiotic nutrients.
 *
 * Three, not one, because of competitive exclusion: coexistence of p species
 * competing for a substrate is impossible when the number of limiting nutrients
 * is below p. A single-nutrient substrate makes a stable food web
 * mathematically impossible, not merely hard to tune. See RESEARCH.md.
 */
export const NUTRIENT_COUNT = 3;
export class OrganismStore {
    /** Number of occupied slots. The dense iteration bound. */
    count = 0;
    /** Allocated slots. */
    capacity;
    label;
    // --- Identity -------------------------------------------------------------
    id;
    /** Stable lineage id inherited from the parent. */
    lineage;
    /** Parent's stable id, or -1 for a founder. */
    parentId;
    /** Parent's slot at the moment of birth (diagnostic only; may be stale). */
    parentSlot;
    /** Monotonic birth counter for age/tick bookkeeping. */
    bornTick;
    /** Per-individual procedural seed for phenotype derivation. */
    individualSeed;
    /**
     * Generations from the lineage founder. 0 for an asexual child, incremented
     * for a sexual child. This is what makes "lineage change" measurable rather
     * than rhetorical.
     */
    generationDepth;
    // --- Genome ---------------------------------------------------------------
    /** `capacity * TRAIT_COUNT` normalized genes. */
    genome;
    /** `capacity * BODY_GENE_COUNT` discrete structural genes. */
    bodyGenes;
    // --- Spatial --------------------------------------------------------------
    x;
    y;
    /** Heading in radians. */
    heading;
    // --- Physiology -----------------------------------------------------------
    /** Current usable energy. Never negative by construction. */
    energy;
    /** Accumulated damage; at or above `fatalDamage` the organism dies. */
    damage;
    /**
     * Portion of `damage` attributable to starvation rather than injury.
     *
     * Needed because both were written into one counter, so the death classifier
     * could not tell "eaten" from "starved" and reported starving deaths as
     * `damage`. That misattribution produced a confidently wrong reading of the
     * ecology (see REPORT.md).
     */
    starveDamage;
    age;
    /** Ticks since last successful feeding. Drives starvation. */
    hunger;
    /**
     * Exhaustion accumulated by sustained fleeing, in [0,1].
     *
     * Without this, chase dynamics make predators structurally impossible: prey
     * are small, and small bodies are FAST (maxStep scales as
     * 1/(1 + sqrt(size)*0.42)), so a large predator can never close the gap on a
     * small one while paying roughly 2.7x the upkeep for its bigger body. Every
     * predator therefore starved, measured as 33 -> 1 while grazers rose 48 -> 74.
     *
     * Fatigue is the standard correction and is biologically real: fleeing is
     * energetically expensive, which is precisely why predators can eventually
     * catch prey. Endurance resists it, giving an existing but previously inert
     * trait a function.
     */
    fatigue;
    /** Ticks until this organism may attempt reproduction again. */
    reproCooldown;
    /** Cumulative energy ingested, for causal accounting. */
    energyIngested;
    /** Cumulative energy spent (DISSIPATED), for causal accounting. */
    energySpent;
    /**
     * Cumulative energy moved to another organism. Kept separate from
     * `energySpent` because a transfer is not dissipation, and conflating them
     * makes the per-organism figure unreadable.
     */
    energyTransferred;
    // --- Derived, recomputed on birth -----------------------------------------
    /** Cached phenotype per slot. Null for a vacant slot. */
    phen;
    /** Expressed traits per slot, flattened `capacity * TRAIT_COUNT`. */
    physical;
    hitRadius;
    senseRadius;
    maxStep;
    /** Resolved module bitflags. */
    modules;
    /**
     * Derived per-birth role/stage readout, flattened `capacity * ROLE_STRIDE`.
     * Cached because it is a pure function of the genome, but recomputed as age
     * crosses stage boundaries. Purely a readout: never consulted for outcomes.
     */
    role;
    // --- Bookkeeping ----------------------------------------------------------
    freeList;
    freeTop = 0;
    /** Count of phenotype derivations performed, for overhead profiling. */
    phenotypeDerivations = 0;
    constructor(opts = {}) {
        const cap = opts.capacity ?? 4096;
        this.capacity = cap;
        this.label = opts.label ?? 'organisms';
        this.id = new Int32Array(cap);
        this.lineage = new Int32Array(cap);
        this.parentId = new Int32Array(cap);
        this.parentSlot = new Int32Array(cap);
        this.bornTick = new Int32Array(cap);
        this.individualSeed = new Uint32Array(cap);
        this.generationDepth = new Int32Array(cap);
        this.genome = new Float32Array(cap * TRAIT_COUNT);
        this.bodyGenes = new Uint8Array(cap * BODY_GENE_COUNT);
        this.x = new Float32Array(cap);
        this.y = new Float32Array(cap);
        this.heading = new Float32Array(cap);
        this.energy = new Float32Array(cap);
        this.damage = new Float32Array(cap);
        this.starveDamage = new Float32Array(cap);
        this.age = new Int32Array(cap);
        this.hunger = new Int32Array(cap);
        this.fatigue = new Float32Array(cap);
        this.reproCooldown = new Int32Array(cap);
        this.energyIngested = new Float32Array(cap);
        this.energySpent = new Float32Array(cap);
        this.energyTransferred = new Float32Array(cap);
        this.phen = new Array(cap).fill(null);
        this.physical = new Float32Array(cap * TRAIT_COUNT);
        this.hitRadius = new Float32Array(cap);
        this.senseRadius = new Float32Array(cap);
        this.maxStep = new Float32Array(cap);
        this.modules = new Int32Array(cap);
        this.role = new Uint8Array(cap * ROLE_STRIDE);
        this.freeList = new Int32Array(cap);
    }
    /**
     * Living population, i.e. occupied slots.
     *
     * Distinct from `count`, which is the dense iteration BOUND. `count` never
     * shrinks when slots are released: released slots are kept on a free list so
     * the update loop never walks holes, which means `count` overstates the
     * living population by exactly the number of free-list entries. Reporting
     * `count` as population is a real bug, so callers that mean "how many
     * organisms are alive" must use this.
     */
    get population() {
        return this.count - this.freeTop;
    }
    /** Vacant slots currently on the free list. */
    get freeSlots() {
        return this.freeTop;
    }
    /**
     * Reserve a slot. Reuses a freed slot deterministically, otherwise grows.
     * Returns -1 only if capacity growth itself fails.
     */
    allocate() {
        if (this.freeTop > 0) {
            const slot = this.freeList[--this.freeTop];
            this.phen[slot] = null;
            return slot;
        }
        if (this.count >= this.capacity) {
            if (!this.grow(this.capacity * 2))
                return -1;
        }
        return this.count++;
    }
    /** Return a slot to the free list. Idempotent per slot within a tick. */
    release(slot) {
        this.phen[slot] = null;
        this.freeList[this.freeTop++] = slot;
    }
    /** Grow every per-slot array by doubling. */
    grow(next) {
        const cap = Math.max(1, next);
        // Written out field by field rather than reflected over a name list: a
        // generic reallocator cannot preserve the distinct element types, and the
        // explicit version makes it obvious that every per-slot array grows
        // together. Getting this wrong would silently truncate a genome block.
        this.id = growInt32(this.id, cap);
        this.lineage = growInt32(this.lineage, cap);
        this.parentId = growInt32(this.parentId, cap);
        this.parentSlot = growInt32(this.parentSlot, cap);
        this.bornTick = growInt32(this.bornTick, cap);
        this.generationDepth = growInt32(this.generationDepth, cap);
        this.individualSeed = growUint32(this.individualSeed, cap);
        this.genome = growFloat32(this.genome, cap * TRAIT_COUNT);
        this.physical = growFloat32(this.physical, cap * TRAIT_COUNT);
        this.bodyGenes = growUint8(this.bodyGenes, cap * BODY_GENE_COUNT);
        this.x = growFloat32(this.x, cap);
        this.y = growFloat32(this.y, cap);
        this.heading = growFloat32(this.heading, cap);
        this.energy = growFloat32(this.energy, cap);
        this.damage = growFloat32(this.damage, cap);
        this.starveDamage = growFloat32(this.starveDamage, cap);
        this.age = growInt32(this.age, cap);
        this.hunger = growInt32(this.hunger, cap);
        this.fatigue = growFloat32(this.fatigue, cap);
        this.reproCooldown = growInt32(this.reproCooldown, cap);
        this.energyIngested = growFloat32(this.energyIngested, cap);
        this.energySpent = growFloat32(this.energySpent, cap);
        this.energyTransferred = growFloat32(this.energyTransferred, cap);
        this.hitRadius = growFloat32(this.hitRadius, cap);
        this.senseRadius = growFloat32(this.senseRadius, cap);
        this.maxStep = growFloat32(this.maxStep, cap);
        this.modules = growInt32(this.modules, cap);
        this.role = growUint8(this.role, cap * ROLE_STRIDE);
        this.freeList = growInt32(this.freeList, cap);
        const phen = new Array(cap).fill(null);
        for (let i = 0; i < this.capacity; i++)
            phen[i] = this.phen[i];
        this.phen = phen;
        this.capacity = cap;
        return true;
    }
    /** Copy a genome block into a slot. */
    copyGenomeToSlot(dstSlot, srcGenome, srcOffset = 0) {
        this.genome.set(srcGenome.subarray(srcOffset, srcOffset + TRAIT_COUNT), dstSlot * TRAIT_COUNT);
    }
    copyBodyToSlot(dstSlot, srcBody, srcOffset = 0) {
        this.bodyGenes.set(srcBody.subarray(srcOffset, srcOffset + BODY_GENE_COUNT), dstSlot * BODY_GENE_COUNT);
    }
    /** Expressed-trait accessor: `store.trait(slot, TRAIT.SPEED)`. */
    trait(slot, traitIndex) {
        return this.physical[slot * TRAIT_COUNT + traitIndex];
    }
    /** Approximate resident bytes, for memory-growth profiling. */
    byteEstimate() {
        const typed = this.id.byteLength +
            this.lineage.byteLength +
            this.parentId.byteLength +
            this.parentSlot.byteLength +
            this.bornTick.byteLength +
            this.individualSeed.byteLength +
            this.generationDepth.byteLength +
            this.genome.byteLength +
            this.bodyGenes.byteLength +
            this.x.byteLength +
            this.y.byteLength +
            this.heading.byteLength +
            this.energy.byteLength +
            this.damage.byteLength +
            this.starveDamage.byteLength +
            this.age.byteLength +
            this.hunger.byteLength +
            this.fatigue.byteLength +
            this.reproCooldown.byteLength +
            this.energyIngested.byteLength +
            this.energySpent.byteLength +
            this.energyTransferred.byteLength +
            this.physical.byteLength +
            this.hitRadius.byteLength +
            this.senseRadius.byteLength +
            this.maxStep.byteLength +
            this.modules.byteLength +
            this.role.byteLength +
            this.freeList.byteLength;
        // Phenotype objects and their geometry arrays dominate the rest.
        let objects = 0;
        for (let i = 0; i < this.count; i++)
            if (this.phen[i])
                objects++;
        return typed + objects * 520;
    }
}
function growInt32(old, n) {
    const a = new Int32Array(n);
    a.set(old);
    return a;
}
function growUint32(old, n) {
    const a = new Uint32Array(n);
    a.set(old);
    return a;
}
function growFloat32(old, n) {
    const a = new Float32Array(n);
    a.set(old);
    return a;
}
function growUint8(old, n) {
    const a = new Uint8Array(n);
    a.set(old);
    return a;
}
