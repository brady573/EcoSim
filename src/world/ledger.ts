/**
 * Causal resource ledger for the experimental evolution engine.
 *
 * The Owner required "causal resource accounting sufficient for the model".
 * That means every joule must have an identifiable origin and destination, so
 * an invariant can be asserted rather than hand-waved.
 *
 * Pools tracked in energy units:
 *   N  nutrient     — inorganic substrate. NOT energy-tracked: it is the raw
 *                     material that photosynthesis converts into energy.
 *   D  detritus     — dead organic energy awaiting recycling.
 *   B  biomass      — energy currently held by living organisms.
 *   L  dissipated   — energy respired, mineralised, or otherwise lost.
 *
 * The only two ways energy ENTERS the biological system:
 *   capture()      — photosynthetic conversion of nutrient + light.
 *   injectOrganic()— external organic input falling into the detritus pool.
 *
 * The invariant, asserted every tick by the validation gates:
 *
 *     capture + injectOrganic === B + D + L
 *
 * Every mutation goes through a named method below, so no code path can move
 * energy without also recording where it went. Float drift is possible but
 * bounded; the gate tolerates it rather than pretending it cannot exist.
 */

import type { ScalarField } from '../core/field.js';

export class Ledger {
  /**
   * Exogenous biomass the founder population starts with. This is an initial
   * condition, not a flux, but the conservation identity still has to account
   * for it or every run fails the gate by exactly this amount.
   */
  foundingBiomass = 0;
  /** Cumulative energy captured by photosynthesis. */
  capture = 0;
  /** Cumulative external organic input. */
  injectOrganic = 0;
  /** Cumulative basal respiration. */
  basalSpent = 0;
  /** Cumulative locomotion cost. */
  movementSpent = 0;
  /** Cumulative sensing cost. */
  sensingSpent = 0;
  /** Cumulative reproductive expenditure. */
  reproductionSpent = 0;
  /** Cumulative cost of contested interactions. */
  contestSpent = 0;
  /**
   * Per-guild expenditure, parallel to the five global buckets above.
   *
   * Indexed `[guild * 5 + bucket]` with buckets basal=0, movement=1,
   * sensing=2, contest=3, reproduction=4. These are ADDITIONAL counters: they
   * do not participate in the conservation identity (`capture + injectOrganic
   * === B + D + L`), which is computed from the global buckets only. They
   * exist because the global ledger cannot answer "can CONSUMERS afford
   * reproduction" - only a per-guild split can.
   *
   * Recorded by `World.spend()`, which knows the spending slot's guild. No
   * code path branches on these values, so they cannot change outcomes.
   */
  spentByGuild = new Float64Array(3 * 5);
  /**
   * Per-guild parental reserve transferred to offspring at birth.
   *
   * A transfer within biomass (B), NOT dissipation, so it is deliberately NOT
   * part of `reproductionSpent` or `totalDissipated()`. But it IS a real charge
   * against the parent's reserve, and it scales with clutch size, so it is the
   * term that determines whether a parent can afford to breed. Recorded at the
   * birth settlement site using the parent's guild.
   */
  transferredOutByGuild = new Float64Array(3);
  /**
   * Per-guild energy INCOME, parallel to the global capture/scavenged/predated
   * counters. Same indexing: [guild], 0/1/2 producer/consumer/decomposer.
   *
   * These answer "who captures what": the global ledger shows total energy
   * entering the system but cannot say whether consumers are starved because
   * they cannot find food, cannot catch it, or cannot digest it. The per-guild
   * split is the first step; the unassimilated split is the digestion step.
   *
   * Like the expenditure counters, these are ADDITIONAL and do not participate
   * in the conservation identity. No code path branches on them.
   */
  capturedByGuild = new Float64Array(3);
  scavengedByGuild = new Float64Array(3);
  predatedByGuild = new Float64Array(3);
  unassimilatedByGuild = new Float64Array(3);
  /**
   * Crowding (density) cost, charged as basal via `World.spend()` but recorded
   * here separately so density dependence can be measured directly.
   *
   * The engine charges `(crowding - 4) * 0.006 * (1 + SIZE)` whenever local
   * crowding exceeds 4. That term EXISTS but was never measured on its own,
   * so whether density dependence binds was unanswerable. The global figure is
   * the sum; the per-guild split shows who pays it.
   */
  crowdingSpent = 0;
  crowdingByGuild = new Float64Array(3);
  /** Cumulative energy lost when detritus mineralised back into nutrient. */
  mineralised = 0;
  /** Cumulative energy lost to spoilage at death. */
  spoiled = 0;
  /** Cumulative energy spilled because a storage buffer was full. */
  spilled = 0;
  /** Cumulative energy respired because it could not be assimilated. */
  unassimilated = 0;
  /** Cumulative energy gained from scavenging detritus. */
  scavenged = 0;
  /** Cumulative energy moved between organisms by predation. */
  predated = 0;
  /**
   * Chemical energy income and expenditure, booked through THIS ledger.
   *
   * These are the same quantities `chemistry.flux.chemEnergyIncome/Spent`
   * record, cast into the causal energy identity the legacy ledger already
   * enforces. They are not a second book: recording them here is what lets
   * the chemistry-enabled run satisfy `capture + organic + founding +
   * chemicalIncome == biomass + detritus + dissipated + chemicalSpent`
   * without pretending the two books were always the same.
   */
  chemicalIncome = 0;
  chemicalSpent = 0;

  reset(): void {
    this.foundingBiomass = 0;
    this.capture = 0;
    this.injectOrganic = 0;
    this.basalSpent = 0;
    this.movementSpent = 0;
    this.sensingSpent = 0;
    this.reproductionSpent = 0;
    this.contestSpent = 0;
    this.spentByGuild.fill(0);
    this.transferredOutByGuild.fill(0);
    this.capturedByGuild.fill(0);
    this.scavengedByGuild.fill(0);
    this.predatedByGuild.fill(0);
    this.unassimilatedByGuild.fill(0);
    this.crowdingSpent = 0;
    this.crowdingByGuild.fill(0);
    this.mineralised = 0;
    this.spoiled = 0;
    this.spilled = 0;
    this.unassimilated = 0;
    this.scavenged = 0;
    this.predated = 0;
    this.chemicalIncome = 0;
    this.chemicalSpent = 0;
  }

  /** Photosynthesis: nutrient is consumed, energy appears. */
  recordCapture(amount: number): void {
    this.capture += amount;
  }

  /** External organic matter entering the detritus pool. */
  recordOrganicInput(amount: number): void {
    this.injectOrganic += amount;
  }

  /**
   * Move energy out of a living organism.
   * `detritusShare` is the fraction that becomes corpse/detritus; the rest is
   * respiration. Splits are always explicit so `dissipated` stays complete.
   */
  recordLivingLoss(
    total: number,
    detritusShare: number,
    detritus: ScalarField,
    fieldW: number,
    fieldH: number,
    x: number,
    y: number,
    digestion: number,
    /** Optional concentrating benthic compartment; receives the corpse share. */
    sediment?: ScalarField,
    /**
     * Share of the usable corpse routed to RECALCITRANT litter instead of
     * labile detritus.
     *
     * Dead bodies are mostly structural material - cellulose, lignin - which
     * animals cannot digest. Routing that share to the litter pool is what
     * gives decomposers an exclusive niche; sending all of a corpse to labile
     * detritus is what previously made scavengers and decomposers competitors
     * for identical units.
     */
    litterShare = 0,
    /** Optional recalcitrant compartment; receives the structural share. */
    litter?: ScalarField,
  ): number {
    if (total <= 0) return 0;
    const toDetritus = total * detritusShare;
    const respired = total - toDetritus;
    // Only the digestible portion becomes substrate detritus; the rest is
    // lost to decomposer inefficiency (tracked as spoil).
    const usableAll = toDetritus * digestion;
    // Split by structural content BEFORE the labile benthic/suspended split.
    const toLitter = usableAll * litterShare;
    const usable = usableAll - toLitter;
    if (litter && toLitter > 0) litter.add(x, y, fieldW, fieldH, toLitter);
    // Most of a corpse sinks into the benthic compartment, where organic matter
    // CONCENTRATES and becomes available to detritivores. Real detritus-based
    // food webs are benthic for exactly this reason: suspended detritus alone is
    // too dilute to support a consumer. See RESEARCH.md.
    const benthic = usable * 0.78;
    const suspended = usable - benthic;
    if (sediment) sediment.add(x, y, fieldW, fieldH, benthic);
    detritus.add(x, y, fieldW, fieldH, suspended);
    this.spoiled += toDetritus - usableAll;
    this.mineralised += respired;
    return usableAll;
  }

  /** Energy spent and gone entirely (basal, movement, sensing, contests). */
  recordExpenditure(amount: number, bucket: 'basal' | 'movement' | 'sensing' | 'contest' | 'reproduction'): void {
    if (bucket === 'basal') this.basalSpent += amount;
    else if (bucket === 'movement') this.movementSpent += amount;
    else if (bucket === 'sensing') this.sensingSpent += amount;
    else if (bucket === 'contest') this.contestSpent += amount;
    else this.reproductionSpent += amount;
  }

  /**
   * Per-guild form of `recordExpenditure`. `guild` is 0/1/2 (producer/consumer/
   * decomposer); out-of-range values are ignored rather than crashing a hot path.
   * `bucket` uses the same order as the global buckets.
   */
  recordExpenditureGuild(amount: number, bucket: number, guild: number): void {
    if (guild < 0 || guild >= 3 || bucket < 0 || bucket >= 5) return;
    this.spentByGuild[guild * 5 + bucket] += amount;
  }

  /** Per-guild capture (photosynthesis). `guild` is the capturing slot's guild. */
  recordCaptureGuild(amount: number, guild: number): void {
    if (guild < 0 || guild >= 3) return;
    this.capturedByGuild[guild] += amount;
  }

  /** Per-guild scavenged/detritus removal. */
  recordScavengedGuild(amount: number, guild: number): void {
    if (guild < 0 || guild >= 3) return;
    this.scavengedByGuild[guild] += amount;
  }

  /** Per-guild predation yield, attributed to the ATTACKER's guild (who gains). */
  recordPredatedGuild(amount: number, guild: number): void {
    if (guild < 0 || guild >= 3) return;
    this.predatedByGuild[guild] += amount;
  }

  /** Per-guild unassimilated (ingested but wasted) — the digestion-efficiency term. */
  recordUnassimilatedGuild(amount: number, guild: number): void {
    if (guild < 0 || guild >= 3) return;
    this.unassimilatedByGuild[guild] += amount;
  }

  /** Per-guild parental transfer at birth (within-biomass, not dissipation). */
  recordTransferOut(amount: number, guild: number): void {
    if (guild < 0 || guild >= 3) return;
    this.transferredOutByGuild[guild] += amount;
  }

  /** Crowding cost, in addition to (not instead of) the basal charge. */
  recordCrowding(amount: number, guild: number): void {
    this.crowdingSpent += amount;
    if (guild >= 0 && guild < 3) this.crowdingByGuild[guild] += amount;
  }

  /** Detritus decaying into nutrient: leaves the biological loop. */
  recordMineralised(amount: number): void {
    this.mineralised += amount;
  }

  /** Overflow past a storage buffer. Goes to substrate, never to nowhere. */
  recordSpill(amount: number): void {
    this.spilled += amount;
  }

  recordScavenged(amount: number): void {
    this.scavenged += amount;
  }

  /**
   * Energy ingested but not assimilated. This is the single place the
   * "ingested vs. usable" gap is accounted for, so it cannot be lost.
   */
  recordUnassimilated(amount: number): void {
    this.unassimilated += amount;
  }

  recordPredated(amount: number): void {
    this.predated += amount;
  }

  /** Chemical metabolism income: energy added to `store.energy` directly. */
  recordChemicalIncome(amount: number): void {
    this.chemicalIncome += amount;
  }

  /** Chemical growth expenditure: energy deducted directly from `store.energy`. */
  recordChemicalExpenditure(amount: number): void {
    this.chemicalSpent += amount;
  }

  /** Total energy dissipated through every pathway. */
  totalDissipated(): number {
    return (
      this.basalSpent +
      this.movementSpent +
      this.sensingSpent +
      this.contestSpent +
      this.reproductionSpent +
      this.mineralised +
      this.spoiled +
      this.unassimilated +
      this.chemicalSpent
    );
  }

  /**
   * Total energy ever present in the biological loop: exogenous founding
   * biomass plus every flux that entered since.
   *
   * Chemical income is an input like photosynthesis capture: it lands in
   * `store.energy`, so excluding it would make a chemistry-enabled run look
   * like it invented energy. With chemistry off the term is exactly zero and
   * the legacy identity is unchanged.
   */
  totalInput(): number {
    return this.foundingBiomass + this.capture + this.injectOrganic + this.chemicalIncome;
  }

  /**
   * Sum energy currently held by LIVING organisms.
   *
   * Liveness is a required predicate rather than assumed, so this cannot
   * silently disagree with any other biomass figure in the codebase.
   */
  biomass(store: { energy: Float32Array; count: number }, isAlive: (slot: number) => boolean): number {
    let s = 0;
    for (let i = 0; i < store.count; i++) if (isAlive(i)) s += store.energy[i];
    return s;
  }
}