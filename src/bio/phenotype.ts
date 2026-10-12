/**
 * Genotype -> phenotype mapping for the experimental evolution engine.
 *
 * This is where a genome becomes a body. It is deliberately a real, timed
 * cost in this experiment: the performance protocol measures phenotype
 * derivation overhead separately from per-tick update cost, because in a
 * birth-heavy world it may dominate.
 *
 * Derivation is cached per organism and recomputed only on birth. Nothing in
 * here is allowed to depend on world state — a phenotype must be a pure
 * function of (genome, individualSeed) so the same genome always yields the
 * same body, which is what makes morphology heredity observable at all.
 */

import { BODY_GENE, BODY_GENE_COUNT, BODY_GENES, MODULE, TRAIT, TRAITS, TRAIT_COUNT, express, type TraitSpec } from './genome.js';
import { expressModules } from './modgenome.js';
import { Rng } from '../core/rng.js';

/** Resolved structural body plan. */
export interface BodyPlan {
  segments: number;
  limbPairs: number;
  eyeCount: number;
  shell: number;
  spines: number;
  fins: number;
  antennae: number;
  tail: number;
  modules: number;
}

/** One procedurally generated body segment in local morphology space. */
export interface MorphSegment {
  /** Offset along the spine, body lengths from the head. */
  u: number;
  /** Lateral offset. */
  v: number;
  /** Radius of this segment in world units. */
  radius: number;
  /** Accumulated spine angle, radians. */
  angle: number;
}

/** A procedurally placed appendage (limb, spine, fin, antenna). */
export interface MorphPart {
  kind: number;
  /** Which segment it attaches to. */
  segment: number;
  /** Angle relative to the parent segment's spine angle. */
  angle: number;
  length: number;
  thickness: number;
}

export const PART = { LIMB: 0, SPINE: 1, FIN: 2, ANTENNA: 3 } as const;

export class Phenotype {
  /** Expressed physical trait values, indexed like TRAITS. Hot-path read. */
  readonly physical = new Float32Array(TRAIT_COUNT);
  readonly body: BodyPlan;
  /**
   * Structural genes AS EXPRESSED: inherited genotype plus whatever modules
   * built on it. Local to this phenotype, never written back to the genome.
   */
  readonly structGenes = new Uint8Array(BODY_GENE_COUNT);
  readonly spine: MorphSegment[];
  readonly parts: MorphPart[];

  /**
   * Size-corrected storage capacity.
   *
   * The raw STORAGE_CAPACITY trait ignores body mass, which made a large animal
   * hold the same energy reserve as a small one while yielding far more tissue
   * to a predator. Capacity is therefore scaled by mass at derivation time.
   */
  readonly capacityForTrait: number;

  /** Modular genome v2: total expressed structure and its upkeep price. */
  moduleTotal = 0;
  moduleUpkeep = 0;

  /** Collision radius, world units. Derived from body mass and proportions. */
  readonly hitRadius: number;
  /** Sensing radius, world units. */
  readonly senseRadius: number;
  /** Max movement this tick, world units. */
  readonly maxStep: number;

  /** Appearance, derived from pigment genes + modules. */
  hue: number;
  sat: number;
  val: number;
  pattern: number;
  /** Secondary accent colour used for eyes/parts. */
  accentHue: number;

  constructor(
    genome: Float32Array, bodyGenes: Uint8Array, individualSeed: number,
    geneModules?: Float32Array | null, moduleCount = 0,
    ageFraction = 1, energyFraction = 1,
  ) {
    // --- Express every trait once. The hot loop reads `physical` only. ---
    for (let i = 0; i < TRAIT_COUNT; i++) {
      const spec: TraitSpec = TRAITS[i];
      this.physical[i] = express(genome[i], spec);
    }
    const P = this.physical;

    // --- Modular genome v2 (diagnostic, genomeV2). -------------------------
    //
    // Modules are INHERITED INSTRUCTIONS; this is where they become biology.
    // The delta they produce is added to the expressed trait GENE before
    // materialisation, so the existing 42 traits, their consumers and all the
    // trophic machinery are untouched. With genomeV2 off, `geneModules` is
    // null and this block is never entered — declared behaviour is unchanged.
    if (geneModules && moduleCount > 0) {
      const deltas = new Float32Array(TRAIT_COUNT);
      const structGenes = new Uint8Array(BODY_GENE_COUNT);
      const tally = expressModules(
        geneModules, moduleCount, ageFraction, energyFraction, deltas, structGenes,
      );
      this.moduleTotal = tally.total;
      this.moduleUpkeep = tally.upkeep;
      for (let i = 0; i < TRAIT_COUNT; i++) {
        if (deltas[i] === 0) continue;
        const spec = TRAITS[i];
        // Gene-space addition, clamped: a module pushes the trait it builds,
        // and the existing bounds still apply. Clamping here rather than
        // letting a module invert a trait is deliberate — a module that could
        // drive a cost trait negative would create free energy.
        const g = Math.max(0, Math.min(1, genome[i] + deltas[i]));
        P[i] = express(g, spec);
      }
      // Structure also shows. Appearance follows biology, never the reverse.
      //
      // Written into `this.structGenes`, NOT into the caller's `bodyGenes`.
      // That array is the INHERITED genotype: writing expressed structure back
      // into it makes a readout heritable, and a re-derivation at a later age
      // would then ADD to it again, accumulating structure into the DNA with
      // every refresh. A phenotype is a pure function of its genome, so it must
      // not be able to edit the genome it was derived from.
      for (let b = 0; b < BODY_GENE_COUNT; b++) {
        if (!structGenes[b]) continue;
        const spec = BODY_GENES[b];
        this.structGenes[b] = Math.max(spec.lo, Math.min(spec.hi, bodyGenes[b] + structGenes[b]));
      }
    }

    // --- Resolve the body plan from discrete genes. ---
    // Structural view used for appearance AND for every derived quantity.
    // Starts as the inherited genotype and may be extended by modules below.
    // The caller's array is never written to.
    this.structGenes.set(bodyGenes);
    this.body = {
      segments: this.structGenes[BODY_GENE.SEGMENTS],
      limbPairs: this.structGenes[BODY_GENE.LIMB_PAIRS],
      eyeCount: this.structGenes[BODY_GENE.EYE_COUNT],
      shell: this.structGenes[BODY_GENE.SHELL],
      spines: this.structGenes[BODY_GENE.SPINES],
      fins: this.structGenes[BODY_GENE.FINS],
      antennae: this.structGenes[BODY_GENE.ANTENNAE],
      tail: this.structGenes[BODY_GENE.TAIL],
      modules: 0,
    };

    this.hue = bodyGenes[BODY_GENE.PIGMENT_HUE];
    this.sat = bodyGenes[BODY_GENE.PIGMENT_SAT];
    this.val = bodyGenes[BODY_GENE.PIGMENT_VAL];
    this.pattern = bodyGenes[BODY_GENE.PATTERN];
    // Accent is a deterministic function of hue so an organism's parts read as
    // the same creature rather than random confetti.
    this.accentHue = (this.hue + 137.508 + this.pattern * 29) % 360;

    // Chromatophore presence is inferred, not directly coded: vivid pigment
    // plus photosynthetic capacity implies light-advertising tissue.
    const photoGen = P[TRAIT.PHOTOSYNTHETIC_RATE];
    if (this.sat > 62 && photoGen > 0.18) this.body.modules |= MODULE.CHROMATOPHORE;

    if (this.body.shell > 0) this.body.modules |= MODULE.SHELL;
    if (this.body.spines > 0) this.body.modules |= MODULE.SPINES;
    if (this.body.fins > 0) this.body.modules |= MODULE.FINS;
    if (this.body.antennae > 0) this.body.modules |= MODULE.ANTENNAE;
    if (this.body.tail > 0) this.body.modules |= MODULE.TAIL;

    // --- Scale relations. Bigger bodies are slower per body length but cost
    //     more absolutely and are worth more to a predator. ---
    const size = P[TRAIT.SIZE];
    const armor = P[TRAIT.ARMOR];

    // Shell inflates mass and therefore collision radius.
    const bulk = 1 + this.body.shell * 0.14 + this.body.spines * 0.05;
    this.hitRadius = Math.sqrt(size) * 0.42 * bulk;

    // Aerobic-ish speed law: larger animals get lower relative speed, plus
    // maneuverability. Real quadrupedal scaling, deliberately simple.
    const scaleDrag = 1 / (1 + Math.sqrt(size) * 0.42);
    this.maxStep =
      P[TRAIT.SPEED] * 1.55 * scaleDrag * (1 + P[TRAIT.BURST_POWER] * 0.28) * (1 - armor * 0.18);

    // Sensing radius merges vision and chemical detection. Threat sense is
    // what actually extends it for a scared organism.
    const vision = P[TRAIT.VISION_RANGE] * (0.6 + this.body.eyeCount * 0.12);
    const chem = P[TRAIT.NUTRIENT_SENSE] * 40 + P[TRAIT.THREAT_SENSE] * 55;
    // Storage capacity scales with body mass.
    //
    // This was an INCONSISTENCY, not a tuning choice: predation yield is keyed
    // to prey body mass (size^1.4) while standing value was independent of
    // size, so a predator eating a size-10 prey extracted 101 % of the prey's
    // entire standing value - energy was being created, not transferred. That
    // is why predators ballooned to 25 % of the population and squeezed out
    // every other consumer guild. With capacity scaling with mass, yield as a
    // FRACTION of standing value becomes roughly constant, which is what makes
    // trophic efficiency a real quantity.
    const capacityGene = P[TRAIT.STORAGE_CAPACITY];
    this.capacityForTrait = capacityGene * (0.42 + 0.58 * (P[TRAIT.SIZE] / 15.5) * 1.85);

    // Larger animals have larger perceptual fields. Without this, sensory reach
    // was independent of body size, so a big predator detected prey no better
    // than a small grazer did.
    //
    // This was the measured bottleneck: predation contacts ran at ~0.03 per
    // predator per tick, and contact win rate was already 100 % when it
    // happened. Predators were not losing fights, they were not finding prey.
    const sizeScale = 0.62 + 0.72 * (P[TRAIT.SIZE] / 15.5);
    this.senseRadius = Math.max(4, Math.max(vision, chem) * sizeScale);

    // --- Procedural geometry, from a per-individual seed. ---
    const rng = new Rng(individualSeed >>> 0);

    // Spine: taper along the body, with a curvature that follows herd/exploration
    // traits so an individual's silhouette reads as behavioural too.
    const n = this.body.segments;
    this.spine = [];
    const bend = (rng.nextFloat() - 0.5) * 0.7 + (P[TRAIT.HERD_INSTINCT] - 0.5) * 0.35;
    let angle = (rng.nextFloat() - 0.5) * 0.25;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1);
      angle += bend / n + (rng.nextFloat() - 0.5) * 0.16;
      // Fat middle, tapered ends — a generic bilaterian taper.
      const taper = 0.45 + 0.55 * Math.sin(Math.PI * (0.18 + 0.82 * u));
      const radius = this.hitRadius * taper * (1 - u * 0.18);
      this.spine.push({
        u,
        v: 0,
        radius: Math.max(0.35, radius),
        angle,
      });
    }

    // Appendages. Limbs on the trunk, spines dorsally, fins posteriorly.
    this.parts = [];
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1;
      for (let l = 0; l < this.body.limbPairs; l++) {
        // Distribute limb pairs along the inner 70% of the spine.
        const seg = Math.min(n - 1, Math.floor((0.2 + (0.6 * (l + 0.5)) / Math.max(1, this.body.limbPairs)) * n));
        this.parts.push({
          kind: PART.LIMB,
          segment: seg,
          angle: sgn * (Math.PI / 2) + (rng.nextFloat() - 0.5) * 0.3,
          length: this.hitRadius * (0.7 + rng.nextFloat() * 0.8),
          thickness: this.hitRadius * 0.13,
        });
      }
    }
    for (let s = 0; s < this.body.spines * 2; s++) {
      const seg = Math.min(n - 1, Math.floor(rng.nextFloat() * n));
      this.parts.push({
        kind: PART.SPINE,
        segment: seg,
        angle: -Math.PI / 2 + (rng.nextFloat() - 0.5) * 0.5,
        length: this.hitRadius * (0.45 + rng.nextFloat() * 0.7),
        thickness: this.hitRadius * 0.08,
      });
    }
    if (this.body.fins > 0) {
      for (let f = 0; f < this.body.fins; f++) {
        const seg = Math.max(0, Math.min(n - 1, n - 1 - f));
        this.parts.push({
          kind: PART.FIN,
          segment: seg,
          angle: (rng.nextFloat() - 0.5) * 0.6,
          length: this.hitRadius * (0.6 + rng.nextFloat() * 0.9),
          thickness: this.hitRadius * 0.06,
        });
      }
    }
    for (let a = 0; a < this.body.antennae * 2; a++) {
      this.parts.push({
        kind: PART.ANTENNA,
        segment: 0,
        angle: (a === 0 ? 1 : -1) * (Math.PI * 0.78) + (rng.nextFloat() - 0.5) * 0.3,
        length: this.hitRadius * (0.8 + rng.nextFloat() * 0.9),
        thickness: this.hitRadius * 0.05,
      });
    }
  }

  /** Photosynthetic fraction, 0..1. Used to classify trophic mode. */
  get photoCapable(): boolean {
    return this.physical[TRAIT.PHOTOSYNTHETIC_RATE] > 0.05;
  }
}

/** Convenience: derive a phenotype and report only the cheap parts. */
/**
 * Mass-corrected storage capacity for one slot.
 *
 * THE single authority for storage capacity. Every ceiling that gates energy -
 * intake headroom, breeding fraction, combat fuel, transfer headroom, founding
 * reserve, and the viewer readout - must go through here rather than reading the
 * raw `STORAGE_CAPACITY` trait.
 *
 * This exists because the raw trait ignores body mass. Predation yield is keyed
 * to prey body mass (`size^1.4`), so a capacity that ignored mass made large
 * prey super-linearly better to eat and let a predator extract 101 % of a large
 * prey's standing value. Scaling capacity by mass makes trophic efficiency a
 * real, roughly size-independent quantity.
 *
 * It also existed in a worse form: only ONE call site was converted while five
 * others still read the raw trait, so intake, breeding and combat disagreed
 * about what an organism's capacity was. Any new capacity ceiling added without
 * this helper reintroduces that split.
 *
 * `fallback` is the raw trait, used when no phenotype is cached (e.g. a slot
 * whose phenotype has not been derived yet).
 */
export function resolveCapacity(phen: unknown | null, fallback: number): number {
  const v = (phen as { capacityForTrait?: unknown } | null)?.capacityForTrait;
  return typeof v === 'number' && v > 0 ? v : fallback;
}

export function derivePhenotype(
  genome: Float32Array,
  bodyGenes: Uint8Array,
  individualSeed: number,
  geneModules?: Float32Array | null,
  moduleCount = 0,
  ageFraction = 1,
  energyFraction = 1,
): Phenotype {
  return new Phenotype(
    genome, bodyGenes, individualSeed, geneModules, moduleCount, ageFraction, energyFraction,
  );
}