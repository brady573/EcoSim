/**
 * VIABILITY GATE ATTRIBUTION — which breeding gate stops consumers in the
 * viability config (diagnostic).
 *
 * READ-ONLY instrument: constructs Worlds, steps them, reports. Never writes
 * biology. Variant of gateattrib.ts (left untouched) pinned to the
 * viability-061 world config: --zero + lifts producerCaptureScale 0.35,
 * basalFoodPerCell 0.01, grazeYieldScale 1.0, nutrientRegen 0.0002, argvRest
 * off,4,0.25,null,null,null,0.15,null,off,off,on,1.0,null,0.05,30.
 *
 * Two pinned differences from gateattrib, both load-bearing for honesty:
 *   - surplus constant 30 (the arm's rsur), not 90;
 *   - upkeep replicated WITH the configured consumer factor 0.25
 *     (consumerBasalScale), mirroring the engine's shared helper. Without it
 *     the surplus barrier reads 4x too high and every tick misattributes.
 * pioneerBonus is null in this config, so pioneerFactor is 1 throughout.
 *
 * Run (compiled only): node build/trace/viabilitygates.js [ticks] [seeds...]
 * Defaults: 6000 ticks; contrast seeds 41002 (fail), 41004 + 41012 (persist).
 */
import { World } from '../world/world.js';
import { FATAL_DAMAGE } from '../world/world.js';
import { TRAIT } from '../bio/genome.js';
import { resolveCapacity } from '../bio/phenotype.js';
import { TROPHIC } from '../bio/role.js';

const REFERENCE_SIZE = 6.7;
// Matches the arm under test (rsur 30), NOT the engine default 90.
const SURPLUS_TICKS = 30;
// Matches consumerBasalScale 0.25 in the tested config (shared-helper rule:
// the engine scales all three upkeep sites together).
const CONSUMER_UPKEEP = 0.25;
const upkeepOf = (basalCost: number, size: number, massCost: number): number =>
  basalCost * (1 + massCost * 42 * REFERENCE_SIZE * Math.pow(size / REFERENCE_SIZE, 0.75)) *
  CONSUMER_UPKEEP;

const GATE = {
  IMMATURE: 'immature',
  COOLDOWN: 'cooldown',
  DAMAGE: 'damageCeiling',
  SURPLUS: 'reproSurplus',
  FRACTION: 'fractionGate',
  ELIGIBLE: 'ELIGIBLE (cleared all gates)',
} as const;

const TICKS = Number(process.argv[2] ?? 6000);
if (!Number.isFinite(TICKS) || TICKS <= 0) {
  throw new Error(`bad ticks: ${process.argv[2]} (want >0)`);
}
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(41002, 41004, 41012);
if (SEEDS.some((s) => !Number.isFinite(s) || s <= 0)) {
  throw new Error(`bad seeds: ${process.argv.slice(3).join(' ')} (want positive integers)`);
}

function buildWorld(seed: number): World {
  return new World({
    config: {
      founders: 400, worldW: 2400, worldH: 2400, seed,
      consumerPhotoScale: 0, consumerBasalScale: 0.25,
      decomposerPhotoScale: 0, decomposerFounders: 0.25,
      decomposerDormancy: 0.05, sporeDispersal: 1,
      grazeYieldScale: 1.0, plantYieldPerMass: 0, radiation: null,
      foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
      dormantThreatBlind: null, mixotrophyCarbon: null,
      mixotrophySaturation: 1.0, nutrientCyclic: true,
      producerCaptureScale: 0.35, nutrientFloor: 0.05, reproSurplusTicks: 30,
      basalFoodPerCell: 0.01, nutrientRegen: 0.0002,
      excretionRate: 0, meatYieldPerMass: 0,
    },
  });
}

console.log('VIABILITY GATE ATTRIBUTION (viability-061 config, surplus=30, consumer upkeep x0.25)');
console.log('Each post-maturity consumer tick attributed to the FIRST gate that blocks it.\n');
console.log('seed      postMatTicks   immature  cooldown  damageCeil  surplus  fraction  ELIGIBLE   elig%');

for (const seed of SEEDS) {
  const w = buildWorld(seed);
  const s = w.store;
  const tallies: Record<string, number> = {
    [GATE.IMMATURE]: 0, [GATE.COOLDOWN]: 0, [GATE.DAMAGE]: 0,
    [GATE.SURPLUS]: 0, [GATE.FRACTION]: 0, [GATE.ELIGIBLE]: 0,
  };
  let postMatTicks = 0;

  for (let t = 1; t <= TICKS; t++) {
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
      if (s.energy[sl] <= upkeep * SURPLUS_TICKS) { tallies[GATE.SURPLUS]++; continue; }
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
  // Final census: must match the archived viability-061 endpoint for this
  // seed exactly (same engine + same config => same trajectory). If it does
  // not, this probe is NOT measuring the arm it claims, and the tallies above
  // are void. Stated before inspection; checked on read.
  let fp = 0, fc = 0, fd = 0;
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const t = w.roleOf(sl).trophic;
    if (t === 0) fp++;
    else if (t === 1) fc++;
    else fd++;
  }
  console.log(`         final P${fp}/C${fc}/D${fd}`);
  if (tallies[GATE.SURPLUS] === 0 && postMatTicks > 0) {
    console.log('         (surplus gate never bound - upkeep replication may be wrong)');
  }
}
