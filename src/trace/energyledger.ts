/**
 * ENERGY LEDGER — where does the energy actually go?
 *
 * THE MEASUREMENT GAP
 * Every previous experiment in this investigation measured BREEDING: which gate
 * blocks, what the odds are, what the traits are. None of them measured where
 * energy is actually SPENT. The engine keeps five separate cumulative counters
 * (basal, movement, sensing, contest, reproduction) and we never read them.
 *
 * WHY THIS MATTERS RIGHT NOW
 * The current conclusion is "selection erodes reproduction because..." and both
 * candidate causes have been falsified by controlled experiment:
 *   - removing the entire ACT cost of breeding: end asexualRate 0.0051 either way
 *   - removing the entire PARENTAL TRANSFER: end asexualRate 0.0051 -> 0.0070
 * So neither energy term in reproduction is the gradient. But we have never
 * checked whether reproduction is a LARGE share of the energy budget at all. If
 * it is a tiny share, then breeding is cheap and the whole "cost" framing is
 * simply wrong. If it is a large share, something else is being missed.
 *
 * This also answers a question nobody has asked: for consumers, is the budget
 * dominated by staying alive, by moving, or by breeding? That determines whether
 * there is any budget at all to spend on reproduction.
 *
 * It reports per-guild, because producers and consumers may have completely
 * different shapes.
 *
 * NOTE ON LIMITS: the engine's ledger is GLOBAL, not per-organism. It cannot
 * attribute expenditure to a guild directly. So guild shares below are derived
 * from each guild's share of total living ENERGY at the sample point, applied to
 * the global cumulative totals. That is an approximation and is labelled as
 * such. The GLOBAL split is exact and is the load-bearing measurement.
 *
 * Run: tsx src/trace/energyledger.ts [ticks] [seed,seed,...]
 */
import { World } from '../world/world.js';
import { TROPHIC_COUNT } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(24601, 777, 1234);

const SAMPLES = [200, 500, 900, 1400, 1900, 2400];

interface Sample {
  tick: number;
  pop: number;
  guildPop: number[];
  guildEnergy: number[];
  basal: number;
  movement: number;
  sensing: number;
  contest: number;
  reproduction: number;
}

interface SeedRun {
  seed: number;
  samples: Sample[];
  finalPop: number;
  births: number[][];
  deaths: number[][];
}

const runs: SeedRun[] = [];

for (const seed of SEEDS) {
  const w = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed } });
  const s = w.store;
  const samples: Sample[] = [];
  const marks = new Set(SAMPLES);

  for (let t = 1; t <= TICKS; t++) {
    w.step();
    if (!marks.has(t)) continue;
    const guildPop = [0, 0, 0];
    const guildEnergy = [0, 0, 0];
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      const g = w.roleOf(sl).trophic;
      if (g < 0 || g >= TROPHIC_COUNT) continue;
      guildPop[g]++;
      guildEnergy[g] += s.energy[sl];
    }
    const L = w.ledger as unknown as {
      basalSpent: number; movementSpent: number; sensingSpent: number;
      contestSpent: number; reproductionSpent: number;
    };
    samples.push({
      tick: t, pop: s.population, guildPop, guildEnergy,
      basal: L.basalSpent, movement: L.movementSpent, sensing: L.sensingSpent,
      contest: L.contestSpent, reproduction: L.reproductionSpent,
    });
  }
  const d = w.demographics();
  runs.push({
    seed, samples, finalPop: s.population,
    births: d.births, deaths: d.deaths,
  });
}

console.log(`ENERGY LEDGER — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('GLOBAL cumulative expenditure split (exact, read from the engine ledger).\n');
console.log('seed      basal%  move%  sense%  contest%  REPRO%   totalSpent   pop');
for (const r of runs) {
  const f = r.samples.at(-1)!;
  const tot = f.basal + f.movement + f.sensing + f.contest + f.reproduction || 1;
  const pc = (x: number): string => ((x / tot) * 100).toFixed(1).padStart(7);
  console.log(
    `${String(r.seed).padStart(6)} ${pc(f.basal)} ${pc(f.movement)} ${pc(f.sensing)} ${pc(f.contest)} ` +
      `${pc(f.reproduction)} ${tot.toFixed(0).padStart(12)} ${String(r.finalPop).padStart(6)}`,
  );
}

console.log('\nPOOLED GLOBAL SPLIT (all seeds, final tick)');
{
  const f0 = runs[0].samples.at(-1)!;
  const sum = (k: keyof Sample): number =>
    runs.reduce((a, r) => a + (r.samples.at(-1)![k] as number), 0);
  const tot = sum('basal') + sum('movement') + sum('sensing') + sum('contest') + sum('reproduction') || 1;
  const pc = (x: number): string => ((x / tot) * 100).toFixed(2).padStart(7);
  console.log(`  basal       ${pc(sum('basal'))}%`);
  console.log(`  movement    ${pc(sum('movement'))}%`);
  console.log(`  sensing     ${pc(sum('sensing'))}%`);
  console.log(`  contest     ${pc(sum('contest'))}%`);
  console.log(`  REPRODUCTION ${pc(sum('reproduction'))}%   <-- the share breeding actually takes`);
  console.log(`  (seed ${runs[0].seed} alone: reproduction ${((f0.reproduction / (f0.basal + f0.movement + f0.sensing + f0.contest + f0.reproduction || 1)) * 100).toFixed(2)}%)`);
}

console.log('\nTIME SERIES (seed 24601 unless noted) — reproduction share of budget over time');
console.log('tick      pop   prod  cons  decomp |  basal%  move%  sense%  contest%  REPRO%');
for (const r of runs.slice(0, 1)) {
  for (const f of r.samples) {
    const tot = f.basal + f.movement + f.sensing + f.contest + f.reproduction || 1;
    const pc = (x: number): string => ((x / tot) * 100).toFixed(1).padStart(7);
    console.log(
      `${String(f.tick).padStart(5)} ${String(f.pop).padStart(6)} ${String(f.guildPop[0]).padStart(5)} ` +
        `${String(f.guildPop[1]).padStart(5)} ${String(f.guildPop[2]).padStart(7)} | ${pc(f.basal)} ${pc(f.movement)} ` +
        `${pc(f.sensing)} ${pc(f.contest)} ${pc(f.reproduction)}`,
    );
  }
}

console.log('\nGUILD ENERGY SHARE over time (exact; from living organisms, not apportioned)');
console.log('tick      prod%   cons%  decomp%   totalLivingEnergy');
for (const f of runs[0].samples) {
  const tot = f.guildEnergy.reduce((a, b) => a + b, 0) || 1;
  const pc = (x: number): string => ((x / tot) * 100).toFixed(1).padStart(6);
  console.log(
    `${String(f.tick).padStart(5)} ${pc(f.guildEnergy[0])} ${pc(f.guildEnergy[1])} ${pc(f.guildEnergy[2])} ${tot.toFixed(0).padStart(18)}`,
  );
}

console.log('\nBIRTH/DEATH TOTALS BY GUILD (whole run)');
console.log('seed      prodBirths consBirths decBirths | prodDeaths consDeaths decDeaths');
for (const r of runs) {
  const b = (g: number): number => r.births[g].reduce((a: number, x: number) => a + x, 0);
  const dd = (g: number): number => r.deaths[g].reduce((a: number, x: number) => a + x, 0);
  console.log(
    `${String(r.seed).padStart(6)} ${String(b(0)).padStart(10)} ${String(b(1)).padStart(10)} ${String(b(2)).padStart(9)} | ` +
      `${String(dd(0)).padStart(10)} ${String(dd(1)).padStart(10)} ${String(dd(2)).padStart(9)}`,
  );
}

const f = runs[0].samples.at(-1)!;
const tot = f.basal + f.movement + f.sensing + f.contest + f.reproduction || 1;
console.log('\nINTERPRETATION HINT');
console.log(`  Reproduction takes ${((f.reproduction / tot) * 100).toFixed(2)}% of all energy spent.`);
console.log('  If that share is small, breeding is CHEAP, and the "reproduction is a net');
console.log('  cost" framing is wrong regardless of which term is charged.');
console.log('  If basal dominates, consumers have no surplus budget to spend on anything.');
console.log(JSON.stringify({
  reproductionSpendPct: +((f.reproduction / tot) * 100).toFixed(4),
  basalSpendPct: +((f.basal / tot) * 100).toFixed(4),
  totalSpend: Math.round(tot),
  finalPop: runs[0].finalPop,
}));