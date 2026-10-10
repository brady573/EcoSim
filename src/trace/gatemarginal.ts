/**
 * MARGINAL (counterfactual) consumer gate analysis.
 *
 * Why this supersedes first-blocking-gate attribution
 * ---------------------------------------------------
 * The engine evaluates gates in a fixed order: cooldown -> damage ceiling ->
 * surplus -> fraction. Attributing each tick to the FIRST blocker therefore
 * inflates whichever gate is evaluated earliest, because it absorbs ticks that
 * would have been blocked by a later gate anyway. The 27-41% "damage ceiling"
 * figure measured by gateattrib.ts is NOT the effect of removing that gate.
 *
 * This probe measures two things the ordered view cannot:
 *
 *   1. INDEPENDENT prevalence - how often each gate blocks a tick, ignoring
 *      evaluation order (one tick may count under several gates).
 *   2. COUNTERFACTUAL eligibility - the fraction of post-maturity consumer ticks
 *      that would be eligible if a given gate were removed, with all remaining
 *      gates still enforced in their original order. This marginal effect is
 *      what predicts whether changing a gate would actually restore reproduction.
 *
 * Read-only: no engine gate is modified. Single pass per seed.
 */
import { World } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/world/world.js';
import { FATAL_DAMAGE } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/world/world.js';
import { TRAIT } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/bio/genome.js';
import { resolveCapacity } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/bio/phenotype.js';
import { TROPHIC } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/bio/role.js';

const REFERENCE_SIZE = 6.7;
const REPRO_SURPLUS_TICKS = 90;
const upkeepOf = (b: number, z: number, m: number): number =>
  b * (1 + m * 42 * REFERENCE_SIZE * Math.pow(z / REFERENCE_SIZE, 0.75));

const REMOVABLE = ['damageCeiling', 'reproSurplus', 'fractionGate'] as const;
type Removable = (typeof REMOVABLE)[number];

const seeds = [24601, 777, 1234];

console.log('MARGINAL (COUNTERFACTUAL) CONSUMER GATE ANALYSIS');
console.log('Read-only recomputation; no engine gate is modified.\n');

for (const seed of seeds) {
  const w = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed } });
  const s = w.store;

  const independent = { cooldown: 0, damageCeiling: 0, reproSurplus: 0, fractionGate: 0 };
  const cf: Record<Removable, number> & { asIs: number } = {
    asIs: 0, damageCeiling: 0, reproSurplus: 0, fractionGate: 0,
  };
  let postMat = 0;

  for (let t = 1; t <= 2400; t++) {
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      if (w.roleOf(sl).trophic !== TROPHIC.CONSUMER) continue;
      if (s.age[sl] < s.trait(sl, TRAIT.MATURITY_AGE)) continue;
      postMat++;

      const cd = s.reproCooldown[sl] > 0;
      const dmg = s.damage[sl] > FATAL_DAMAGE * 0.45;
      const upkeep = upkeepOf(
        s.trait(sl, TRAIT.BASAL_COST),
        s.trait(sl, TRAIT.SIZE),
        s.trait(sl, TRAIT.MASS_COST),
      );
      const surplus = s.energy[sl] <= upkeep * REPRO_SURPLUS_TICKS;
      const cap = resolveCapacity(s.phen[sl], s.trait(sl, TRAIT.STORAGE_CAPACITY));
      const frac = s.energy[sl] / Math.max(1, cap) < s.trait(sl, TRAIT.REPRO_THRESHOLD);

      // 1. Independent prevalence - order-independent, ticks may overlap.
      if (cd) independent.cooldown++;
      if (dmg) independent.damageCeiling++;
      if (surplus) independent.reproSurplus++;
      if (frac) independent.fractionGate++;

      // 2. Counterfactual: remaining gates enforced in their original order.
      const eligibleWithout = (skip: Removable | 'asIs'): boolean => {
        if (cd) return false;
        if (dmg && skip !== 'damageCeiling') return false;
        if (surplus && skip !== 'reproSurplus') return false;
        if (frac && skip !== 'fractionGate') return false;
        return true;
      };
      if (eligibleWithout('asIs')) cf.asIs++;
      if (eligibleWithout('damageCeiling')) cf.damageCeiling++;
      if (eligibleWithout('reproSurplus')) cf.reproSurplus++;
      if (eligibleWithout('fractionGate')) cf.fractionGate++;
    }
    w.step();
  }

  const pc = (n: number) => (postMat > 0 ? (n / postMat) * 100 : 0);
  console.log(`--- seed ${seed} (post-maturity consumer ticks: ${postMat}) ---`);
  console.log('  INDEPENDENT prevalence (a tick may appear under several gates):');
  for (const [k, v] of Object.entries(independent)) {
    console.log(`    ${k.padEnd(14)} ${pc(v).toFixed(1).padStart(6)}%`);
  }
  console.log('  COUNTERFACTUAL eligibility (remaining gates still enforced):');
  const base = pc(cf.asIs);
  console.log(`    as-is                          ${base.toFixed(1).padStart(6)}%`);
  for (const g of REMOVABLE) {
    const v = pc(cf[g]);
    console.log(`    remove ${g.padEnd(24)} -> ${v.toFixed(1).padStart(6)}%   marginal +${(v - base).toFixed(1)} pts`);
  }
  console.log('');
}