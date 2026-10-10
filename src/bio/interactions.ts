/**
 * Contested-interaction resolution for the experimental evolution engine.
 *
 * The design rule this file exists to enforce: outcomes must be *earned*, not
 * labelled. There is no species table, no "predator always wins", no scripted
 * win chance. Every contest is decided by comparing two quantities that are
 * themselves products of evolved traits and current local condition, plus a
 * bounded random margin.
 *
 * Determinism protocol (a credibility-critical guarantee):
 *  1. Every organism emits at most ONE request per tick.
 *  2. Requests are ordered by attacker stable id, ascending. Stable ids never
 *     change, so this order is independent of slot recycling, hash-map
 *     iteration order, and float accumulation order.
 *  3. Mutual requests between the same pair collapse to a single contest
 *     (lowest attacker id wins the collapse), so an interaction is never
 *     resolved twice and energy can never be double-counted.
 *  4. Noise for both sides is drawn in a fixed order (attacker, then
 *     defender), so the RNG stream position is reproducible.
 *  5. A contest whose participant died earlier in the same tick resolves to
 *     ABANDONED explicitly, rather than being silently dropped.
 *
 * LIMITATION (disclosed): contests are pairwise, instantaneous and
 * simultaneous-free. There is no fleeing mid-contest, no wound progression
 * over time, and no group defence beyond a crowding term. A production model
 * would need all three.
 */

import type { Rng } from '../core/rng.js';
import type { OrganismStore } from '../core/soa.js';
import { TRAIT, TRAIT_COUNT } from './genome.js';
import { resolveCapacity } from './phenotype.js';

/** Edible energy per unit prey body mass (arbitrary but self-consistent units). */
/**
 * Edible energy per unit prey body mass.
 *
 * Set so a trophic transfer lands near 15 % of the prey's standing value,
 * which is the order of real trophic transfer efficiency. At the previous
 * value predators extracted 101 % of a large prey's standing value - energy
 * creation, not transfer - so predators ballooned and excluded every other
 * consumer guild.
 */
const MEAT_YIELD_PER_MASS = 1.6;

export const INTERACTION = {
  /** Kill and consume a live organism. */
  PREDATE: 0,
  /** Displace or kill a competitor over contested space. */
  TERRITORIAL: 1,
  /** Reciprocal: both sides consent to a reproduction opportunity. */
  MATE: 2,
  /** Contest access to a carcass with other scavengers. */
  SCAVENGE: 3,
  /**
   * Herbivory: consume part of a living producer's biomass.
   *
   * The missing trophic link. Without it a grazer has NO way to feed on a
   * living producer, so every non-photosynthetic organism was either a
   * detritivore or a predator, and the two consumer guilds competed over the
   * same resource - competitive exclusion inside one trophic level, which
   * guaranteed that at most one of them persisted.
   *
   * Differs from predation in that the defender is not necessarily killed: it
   * loses a fraction of its energy and takes damage that becomes lethal only
   * under sustained overgrazing. That is what makes producer abundance a
   * renewable consumer food source, which is what a food web requires.
   */
  GRAZE: 4,
} as const;

export const OUTCOME = {
  ATTACKER_WINS: 0,
  DEFENDER_WINS: 1,
  ABANDONED: 2,
} as const;

export interface ResolutionRecord {
  attackerId: number;
  defenderId: number;
  kind: number;
  outcome: number;
  /** Signed energy transferred to the attacker. */
  delta: number;
  attackerDamage: number;
  defenderDamage: number;
}

/** Result of {@link InteractionQueue.resolve}, reused across ticks. */
export interface ResolveStats {
  submitted: number;
  resolved: number;
  collapsed: number;
  abandoned: number;
}

export class InteractionQueue {
  private cap: number;
  /** Monotonic identity, stamped at submit time from the store. */
  private atkId: Int32Array;
  private atkSlot: Int32Array;
  private defId: Int32Array;
  private defSlot: Int32Array;
  private ikind: Uint8Array;
  private istake: Float32Array;
  private size = 0;

  private order: Int32Array;
  /** Collapsed, id-sorted working set. */
  private wAtkSlot: Int32Array;
  private wAtkId: Int32Array;
  private wDefSlot: Int32Array;
  private wKind: Uint8Array;

  private records: ResolutionRecord[] = [];
  private recordCount = 0;

  readonly stats: ResolveStats = { submitted: 0, resolved: 0, collapsed: 0, abandoned: 0 };

  /**
   * Cumulative totals across the whole run. `stats` is per-tick and is reset
   * every tick, so it cannot answer "did this world ever contest anything?" —
   * these can. On a quiet tick `stats.resolved` is legitimately 0 while
   * `totalResolved` is large, which is easy to misread as a broken ecology.
   */
  totalSubmitted = 0;
  totalResolved = 0;
  totalCollapsed = 0;
  totalAbandoned = 0;

  constructor(capacity = 4096) {
    this.cap = Math.max(16, capacity);
    this.atkId = new Int32Array(this.cap);
    this.atkSlot = new Int32Array(this.cap);
    this.defId = new Int32Array(this.cap);
    this.defSlot = new Int32Array(this.cap);
    this.ikind = new Uint8Array(this.cap);
    this.istake = new Float32Array(this.cap);
    this.order = new Int32Array(this.cap);
    this.wAtkSlot = new Int32Array(this.cap);
    this.wAtkId = new Int32Array(this.cap);
    this.wDefSlot = new Int32Array(this.cap);
    this.wKind = new Uint8Array(this.cap);
  }

  get pending(): number {
    return this.size;
  }

  private ensure(next: number): void {
    if (next <= this.cap) return;
    const cap = Math.max(next, this.cap * 2);
    const i32 = (old: Int32Array) => {
      const a = new Int32Array(cap);
      a.set(old);
      return a;
    };
    this.atkId = i32(this.atkId);
    this.atkSlot = i32(this.atkSlot);
    this.defId = i32(this.defId);
    this.defSlot = i32(this.defSlot);
    this.order = i32(this.order);
    this.wAtkSlot = i32(this.wAtkSlot);
    this.wAtkId = i32(this.wAtkId);
    this.wDefSlot = i32(this.wDefSlot);
    const k = new Uint8Array(cap);
    k.set(this.ikind);
    this.ikind = k;
    const st = new Float32Array(cap);
    st.set(this.istake);
    this.istake = st;
    this.cap = cap;
  }

  /**
   * Record an intent to interact. `stake` records the attacker's committed
   * energy ceiling at submit time for diagnostics; the resolver sizes takes
   * from its own rules (defender holdings for legacy graze, body mass where
   * converted), not from the stake, so the stake currently bounds nothing.
   * Callers must submit at most one request per organism per tick.
   */
  submit(store: OrganismStore, atkSlot: number, defSlot: number, kind: number, stake: number): void {
    if (atkSlot === defSlot) return;
    if (atkSlot < 0 || atkSlot >= store.count) return;
    if (defSlot < 0 || defSlot >= store.count) return;
    if (this.size + 1 > this.cap) this.ensure(this.size + 1);
    const i = this.size++;
    this.atkId[i] = store.id[atkSlot];
    this.atkSlot[i] = atkSlot;
    this.defId[i] = store.id[defSlot];
    this.defSlot[i] = defSlot;
    this.ikind[i] = kind;
    this.istake[i] = stake;
    this.stats.submitted++;
    this.totalSubmitted++;
  }

  reset(): void {
    this.size = 0;
    this.recordCount = 0;
    this.stats.submitted = 0;
    this.stats.resolved = 0;
    this.stats.collapsed = 0;
    this.stats.abandoned = 0;
  }

  /**
   * Borrow the resolution records without copying.
   *
   * Valid only until the next `reset()`. Callers in the measured hot path use
   * this so that contest resolution does not allocate per tick; the world's
   * own accessor is responsible for honouring the matching count.
   */
  peekRecords(): readonly ResolutionRecord[] {
    return this.records;
  }

  /** Number of entries returned by {@link peekRecords} that are valid. */
  resolutionCount(): number {
    return this.recordCount;
  }

  /**
   * Resolve every queued contest exactly once, in attacker-id order, then
   * clear the queue.
   *
   * `alive(slot)` must report whether the slot still holds a live organism
   * *as of this moment*, including slots reclaimed earlier in the same tick.
   */
  resolve(
    store: OrganismStore,
    alive: (slot: number) => boolean,
    rng: Rng,
    fatalDamage: number,
    onPredation: (attackerSlot: number, defenderSlot: number) => void,
    onTerritorial: (winnerSlot: number, loserSlot: number) => void,
    onMate: (a: number, b: number) => void,
    onScavenge: (attackerSlot: number, defenderSlot: number) => void,
    onGraze?: (attackerSlot: number, defenderSlot: number) => void,
    // Trophic transfer efficiency, threaded from world config so experiments can
    // bracket predator viability by overshoot without editing source per value.
    // Defaults to the module constant so existing callers are unaffected.
    meatYield: number = MEAT_YIELD_PER_MASS,
    // Plant-tissue yield basis for GRAZE (0 = legacy reserve-fraction
    // formula). Threaded like meatYield so experiments can bracket herbivore
    // viability without editing source per value.
    plantYield: number = 0,
  ): void {
    const n = this.size;
    if (n === 0) return;

    // --- Step 1: order by attacker stable id, ascending. ------------------
    // Insertion sort on an index vector. n is bounded by the number of
    // organisms contesting on this tick, which is far below the population,
    // and a pure function of ids it cannot be made non-deterministic.
    const order = this.order;
    for (let i = 0; i < n; i++) order[i] = i;
    for (let i = 1; i < n; i++) {
      const v = order[i];
      const vid = this.atkId[v];
      let j = i - 1;
      while (j >= 0 && this.atkId[order[j]] > vid) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = v;
    }

    // --- Step 2: collapse mutual duplicates into one contest. -------------
    // Pair identity is order-independent (lo,hi sorted), so a mutual pair is
    // caught regardless of which side submitted first.
    let m = 0;
    const seen = new Set<string>();
    for (let k = 0; k < n; k++) {
      const i = order[k];
      const a = this.atkId[i];
      const d = this.defId[i];
      // String key: a numeric key `lo*PRIME+hi` aliases distinct pairs once
      // ids exceed PRIME, which long runs eventually reach.
      const pairKey = a < d ? `${a}:${d}` : `${d}:${a}`;
      if (seen.has(pairKey)) {
        this.stats.collapsed++;
        continue;
      }
      seen.add(pairKey);
      this.wAtkSlot[m] = this.atkSlot[i];
      this.wAtkId[m] = a;
      this.wDefSlot[m] = this.defSlot[i];
      this.wKind[m] = this.ikind[i];
      m++;
    }

    // --- Step 3: resolve each surviving contest once, in id order. --------
    for (let k = 0; k < m; k++) {
      const as = this.wAtkSlot[k];
      const ds = this.wDefSlot[k];
      const kind = this.wKind[k];
      const aid = this.wAtkId[k];

      if (!alive(as) || !alive(ds)) {
        this.stats.abandoned++;
        this.record(aid, -1, kind, OUTCOME.ABANDONED, 0, 0, 0);
        continue;
      }

      const did = store.id[ds];
      const ao = as * TRAIT_COUNT;
      const dop = ds * TRAIT_COUNT;
      const p = store.physical;

      // --- Reciprocal interaction: mating. ---------------------------------
      if (kind === INTERACTION.MATE) {
        // Both sides consented by mutually detecting; this is reciprocal by
        // construction, and both sides pay a cost in onMate().
        onMate(as, ds);
        this.record(aid, did, kind, OUTCOME.ATTACKER_WINS, 0, 0, 0);
        continue;
      }

      const aPower = offensivePower(p, store, ao, as, fatalDamage, rng, p[dop + TRAIT.SIZE]);
      const dPower = defensivePower(p, store, dop, ds, fatalDamage, rng);
      const attackerWins = aPower > dPower;

      let attackerDamage = 0;
      let defenderDamage = 0;
      let delta = 0;

      if (kind === INTERACTION.PREDATE) {
        // Damage scales with the attacker/defender size ratio, so neither a
        // tiny scavenger nor a giant can ignore body-mass consequences.
        const ratio = p[ao + TRAIT.SIZE] / Math.max(0.05, p[dop + TRAIT.SIZE]);
        const toxin = p[ao + TRAIT.TOXIN];
        const bite = (16 + toxin * 30) * ratio * (0.65 + dPower * 0.22);
        if (attackerWins) {
          defenderDamage = bite;
          const digest = p[ao + TRAIT.DIGESTION_RATE];
          const eff = p[ao + TRAIT.METABOLIC_EFFICIENCY];
          const take = Math.min(0.9, 0.35 + digest * 0.6);
          // --- Yield is keyed to prey BODY MASS, not prey stored energy ----
          //
          // The previous formula took a fraction of the defender's energy
          // RESERVE, giving an identical 16.3 energy per kill whether the prey
          // was size 2 or size 10 (all prey sat near half their capacity). That
          // left the predator strategy with NO payoff gradient, so nothing
          // selected for a large body and no apex niche existed. Measured:
          // predators 30 -> 0.
          //
          // Real predators convert prey TISSUE, and tissue tracks body mass.
          // This restores the incentive to be large: only a big predator can
          // exploit big prey, which is what produces size structure in a food
          // web instead of a flat guild of similar-sized consumers.
          const preyMass = Math.pow(p[dop + TRAIT.SIZE], 1.4);
          // Carnivores assimilate prey tissue efficiently, a genuine advantage
          // over herbivory on fibrous material. Modelled as a higher base than
          // the detritus pathway uses.
          const carnivoreDigestion = 0.55 + eff * 0.35;
          const gross = preyMass * meatYield * take * carnivoreDigestion;
          // Unassimilated tissue is left behind rather than destroyed: a
          // predator's leftovers subsidise scavengers, which is how carcasses
          // feed the level below it.
          const unassimilatedShare = Math.max(0, gross * (1 - carnivoreDigestion));
          // Mass-corrected, so intake headroom matches the capacity that gates
          // breeding and combat. A predator filling more than its real capacity
          // here would desynchronise the overflow invariant.
          const room = Math.max(0, resolveCapacity(store.phen[as], p[ao + TRAIT.STORAGE_CAPACITY]) - store.energy[as]);
          delta = Math.min(gross - unassimilatedShare, room);
        } else {
          // Repelled: the attacker still pays contact cost.
          attackerDamage = bite * 0.5;
        }
        onPredation(as, ds);
      } else if (kind === INTERACTION.TERRITORIAL) {
        // Cheap, low-yield: the real cost of spacing out.
        const sizeGap = Math.abs(p[ao + TRAIT.SIZE] - p[dop + TRAIT.SIZE]);
        const base = 5 + sizeGap * 2.2;
        if (attackerWins) {
          defenderDamage = base;
          onTerritorial(as, ds);
        } else {
          // The attacker-as-loser must pay the same displacement cost, or
          // winning a territorial contest is free and the contest is a pure
          // upside with no downside.
          attackerDamage = base;
          onTerritorial(ds, as);
        }
      } else if (kind === INTERACTION.GRAZE) {
        // Herbivory: the attacker removes a FRACTION of the defender's stored
        // energy. Resistance is the defender's armour; an armoured producer
        // resists browsing, which is the coevolutionary counter to herbivory.
        const armour = p[dop + TRAIT.ARMOR];
        const resist = 1 - armour * 0.55;
        const bite = Math.max(0, resist);
        if (attackerWins && bite > 0.02) {
          const appetite = p[ao + TRAIT.FEEDING_APPETITE];
          const digestRate = p[ao + TRAIT.DIGESTION_RATE];
          // Take a bounded fraction of standing biomass, so grazing is a
          // renewable yield rather than a one-off kill.
          const frac = 0.16 * bite * (0.5 + appetite) * (0.4 + digestRate);
          const take = Math.min(0.45, frac);
          if (plantYield > 0) {
            // Tissue basis (diagnostic): bites scale with victim BODY MASS,
            // not its momentary wallet — the same conversion predation
            // received above, where reserve-fraction takes left predators with
            // no payoff gradient. Effective density stays below meat because
            // the take fraction (≤~0.2) and herbivore digestion run well under
            // carnivore values. The world-side holdings backstop still caps
            // every take, so conservation stays exact.
            const eff = p[ao + TRAIT.METABOLIC_EFFICIENCY];
            const plantMass = Math.pow(p[dop + TRAIT.SIZE], 1.4);
            const herbivoreDigestion = 0.35 + eff * 0.25;
            const gross = plantMass * plantYield * take;
            const unassimilatedShare = Math.max(0, gross * (1 - herbivoreDigestion));
            const room = Math.max(0, resolveCapacity(store.phen[as], p[ao + TRAIT.STORAGE_CAPACITY]) - store.energy[as]);
            delta = Math.min(gross - unassimilatedShare, room);
          } else {
            delta = store.energy[ds] * take;
          }
          // Overgrazing damages the producer; repeated browsing is lethal.
          defenderDamage = delta * 0.09 * (2 - bite);
        } else {
          // A FAILED browse costs the herbivore its contest fee (already paid
          // at submission) and nothing more - it takes NO damage.
          //
          // This was `(4 + armour*8)*0.5` = ~3.2 damage per failed attempt,
          // identical in kind to predation. That is wrong biology: a producer is
          // SESSILE and cannot wound a mobile herbivore. Producer defence is
          // expressed entirely through `bite` above - armour reduces how much
          // can be taken - which is the real coevolutionary arms race.
          //
          // Measured consequence of the old rule: grazers won 58 % of browses
          // (162-119) but accumulated 384 damage across the 119 losses, leaving
          // live consumers at mean damage 30.6 against a 45 breeding
          // disqualification bar. Damage never heals, so herbivores slowly
          // poisoned themselves out of breeding and every grazer guild went
          // extinct while producers were 99.7 % of ecosystem energy. The
          // extinction mechanism was accumulated graze damage, not energy.
          attackerDamage = 0;
        }
        (onGraze ?? (() => {}))(as, ds);
      } else if (kind === INTERACTION.SCAVENGE) {
        // Contested access to a carcass; winner gets access, nobody bleeds.
        if (attackerWins) onScavenge(as, ds);
      }

      this.record(
        aid,
        did,
        kind,
        attackerWins ? OUTCOME.ATTACKER_WINS : OUTCOME.DEFENDER_WINS,
        delta,
        attackerDamage,
        defenderDamage,
      );
    }

    this.stats.resolved += m;
    this.totalResolved += m;
    this.totalCollapsed += this.stats.collapsed;
    this.totalAbandoned += this.stats.abandoned;
    this.size = 0;
  }

  private record(
    attackerId: number,
    defenderId: number,
    kind: number,
    outcome: number,
    delta: number,
    attackerDamage: number,
    defenderDamage: number,
  ): void {
    if (this.recordCount < this.records.length) {
      this.records[this.recordCount] = {
        attackerId,
        defenderId,
        kind,
        outcome,
        delta,
        attackerDamage,
        defenderDamage,
      };
    } else {
      this.records.push({
        attackerId,
        defenderId,
        kind,
        outcome,
        delta,
        attackerDamage,
        defenderDamage,
      });
    }
    this.recordCount++;
  }
}

/**
 * Offensive capability from evolved traits and current condition.
 * Larger, more toxic, more aggressive, faster, healthier organisms out-push.
 * Read from the flattened expressed-trait block; no object indirection.
 */
function offensivePower(
  p: Float32Array,
  store: OrganismStore,
  o: number,
  slot: number,
  fatal: number,
  rng: Rng,
  _preySize: number,
): number {
  const size = p[o + TRAIT.SIZE];
  const toxin = p[o + TRAIT.TOXIN];
  const aggression = p[o + TRAIT.AGGRESSION];
  const speed = p[o + TRAIT.SPEED];
  const burst = p[o + TRAIT.BURST_POWER];
  // Mass-corrected, so combat fuel is the same fraction of the same ceiling that
  // breeding uses. Otherwise a large animal fought with a fuel ratio computed
  // against a reserve larger than the one it actually has.
  const capacity = resolveCapacity(store.phen[slot], p[o + TRAIT.STORAGE_CAPACITY]);
  // Condition: an organism near death fights poorly.
  const health = 1 - store.damage[slot] / fatal;
  const fuel = Math.min(1, store.energy[slot] / Math.max(1, capacity));
  const power =
    Math.pow(size, 0.85) *
    (0.62 + 0.55 * aggression) *
    (0.7 + 0.5 * toxin) *
    (0.55 + 0.6 * speed + 0.3 * burst) *
    (health > 0.08 ? health : 0.08) *
    (0.6 + 0.55 * fuel);
  // Bounded random margin: competition stays genuinely contested rather than
  // collapsing into a deterministic trait comparison.
  // MEASURED AND REVERTED. An explicit size-asymmetry term
  // (ratio^0.85) was added here on the theory that large predators should
  // decisively beat small prey. It made predator survival WORSE (32 -> 6
  // instead of 32 -> 15), because `bite` scales with the same size ratio, so a
  // bigger predator that loses takes proportionally more damage. Offence and
  // damage are coupled through that term and cannot be reweighted in
  // isolation. Left as a recorded negative result rather than a silent change.
  return power * (0.78 + 0.44 * rng.nextFloat());
}

/** Defensive capability: mass, armour, endurance, willingness to stand ground. */
function defensivePower(
  p: Float32Array,
  store: OrganismStore,
  o: number,
  slot: number,
  fatal: number,
  rng: Rng,
): number {
  const size = p[o + TRAIT.SIZE];
  const armor = p[o + TRAIT.ARMOR];
  const timidity = p[o + TRAIT.TIMIDITY];
  const endurance = p[o + TRAIT.ENDURANCE];
  const regen = p[o + TRAIT.REGENERATION];
  const health = 1 - store.damage[slot] / fatal;
  // Timidity reduces fight, which is what lets "run instead of fight" be a
  // strategy that can actually evolve.
  const power =
    Math.pow(size, 0.78) *
    (1 + 1.45 * armor) *
    (0.75 + 0.45 * endurance) *
    (0.35 + 0.7 * (1 - timidity)) *
    (health > 0.08 ? health : 0.08) *
    (1 + regen * 3.2);
  return power * (0.78 + 0.44 * rng.nextFloat());
}