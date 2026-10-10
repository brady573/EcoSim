/**
 * Per-lifetime consumer breeding-gate attribution.
 *
 * For every post-maturity consumer tick, records which gate stopped it from
 * breeding, in the engine's own evaluation order:
 *
 *   1. maturityAge        (organism too young)
 *   2. reproCooldown      (in refractory period)
 *   3. damage ceiling     (damage > FATAL_DAMAGE * 0.45)
 *   4. REPRO_SURPLUS      (energy <= upkeep * 90)
 *   5. fraction gate      (energy/capacity < reproThreshold)
 *   -> ELIGIBLE           (cleared all gates; subject only to the stochastic roll)
 *
 * Every gate is attributed EXCLUSIVELY and in order, so the counts sum to the
 * total post-maturity consumer ticks. `upkeepOf` is module-private, so the Kleiber
 * formula is replicated here from world.ts:2912; a mismatch would show up as the
 * surplus gate never binding, which the output flags.
 */
import { World } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/world/world.js';
import { FATAL_DAMAGE } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/world/world.js';
import { TRAIT } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/bio/genome.js';
import { resolveCapacity } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/bio/phenotype.js';
import { TROPHIC } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/bio/role.js';

const REFERENCE_SIZE = 6.7;
const REPRO_SURPLUS_TICKS = 90;
const upkeepOf = (basalCost: number, size: number, massCost: number): number =>
  basalCost * (1 + massCost * 42 * REFERENCE_SIZE * Math.pow(size / REFERENCE_SIZE, 0.75));

const GATE = {
  IMMATURE: 'immature',
  COOLDOWN: 'cooldown',
  DAMAGE: 'damageCeiling',
  SURPLUS: 'reproSurplus',
  FRACTION: 'fractionGate',
  ELIGIBLE: 'ELIGIBLE (cleared all gates)',
} as const;

const seeds = [24601, 777, 1234];
console.log('PER-LIFETIME CONSUMER GATE ATTRIBUTION');
console.log('Each post-maturity consumer tick attributed to the FIRST gate that blocks it.\n');
console.log('seed      postMatTicks   immature  cooldown  damageCeil  surplus  fraction  ELIGIBLE   elig%');

for (const seed of seeds) {
  const w = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed } });
  const s = w.store;
  const tallies: Record<string, number> = {
    [GATE.IMMATURE]: 0, [GATE.COOLDOWN]: 0, [GATE.DAMAGE]: 0,
    [GATE.SURPLUS]: 0, [GATE.FRACTION]: 0, [GATE.ELIGIBLE]: 0,
  };
  let postMatTicks = 0;

  for (let t = 1; t <= 2400; t++) {
    // Attribute BEFORE stepping, so the state is what the engine saw this tick.
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      if (w.roleOf(sl).trophic !== TROPHIC.CONSUMER) continue;
      const age = s.age[sl];
      if (age < s.trait(sl, TRAIT.MATURITY_AGE)) continue;
      postMatTicks++;
      if (s.reproCooldown[sl] > 0) { tallies[GATE.COOLDOWN]++; continue; }
      if (s.damage[sl] > FATAL_DAMAGE * 0.45) { tallies[GATE.DAMAGE]++; continue; }
      const upkeep = upkeepOf(
        s.trait(sl, TRAIT.BASAL_COST),
        s.trait(sl, TRAIT.SIZE),
        s.trait(sl, TRAIT.MASS_COST),
      );
      if (s.energy[sl] <= upkeep * REPRO_SURPLUS_TICKS) { tallies[GATE.SURPLUS]++; continue; }
      const cap = resolveCapacity(s.phen[sl], s.trait(sl, TRAIT.STORAGE_CAPACITY));
      if (s.energy[sl] / Math.max(1, cap) < s.trait(sl, TRAIT.REPRO_THRESHOLD)) {
        tallies[GATE.FRACTION]++; continue;
      }
      tallies[GATE.ELIGIBLE]++;
    }
    w.step();
  }

  const pct = (n: number) => ((n / Math.max(1, postMatTicks)) * 100).toFixed(1).padStart(6);
  console.log(
    `${String(seed).padStart(6)} ${String(postMatTicks).padStart(15)} ${pct(tallies[GATE.IMMATURE])} ` +
    `${pct(tallies[GATE.COOLDOWN])} ${pct(tallies[GATE.DAMAGE])} ${pct(tallies[GATE.SURPLUS])} ` +
    `${pct(tallies[GATE.FRACTION])} ${pct(tallies[GATE.ELIGIBLE])}`,
  );
  if (tallies[GATE.SURPLUS] === 0 && postMatTicks > 0) {
    console.log('         (surplus gate never bound - upkeep replication may be wrong)');
  }
}