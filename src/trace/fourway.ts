/**
 * FOUR-WAY INTERVENTION SWEEP — testing all four consumer-viability directions.
 *
 * AUTHORIZED BY OWNER as the shortest path to acceptance (balanced ecosystem =
 * all guilds recurring). Each direction was identified by measured evidence:
 *
 *   1. PREDATION (predationYieldScale): consumers TRY to hunt/graze (20-30% of
 *      intents) but predation provides only 2.9% of income. Tests whether the
 *      yield per event is too small. Levels: 1 (baseline), 3, 8.
 *   2. PHOTOSYNTHESIS (consumerPhotoScale): consumers already get 27.5% of
 *      income this way. Tests whether leaning into mixotrophy restores them.
 *      Levels: 1, 2, 4.
 *   3. UPKEEP (consumerBasalScale): consumers spend 75.9% of budget on basal.
 *      Tests whether overhead is the binding constraint. Levels: 1, 0.5, 0.25.
 *   4. PRODUCER CAP (producerCaptureScale): producers take 97.2% with no
 *      density limit. Tests whether capping the top creates room. Levels:
 *      1, 0.6, 0.3.
 *
 * Each is tested INDEPENDENTLY against baseline (null = declared). 3 seeds ×
 * (1 baseline + 2 levels × 4 directions) = 27 runs. Reports B/D, births,
 * deaths, consumer presence over time, and end traits.
 *
 * Run: tsx src/trace/fourway.ts [ticks]
 */
import { World } from '../world/world.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { ReproProbeLog } from './reproprobe.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = [24601, 777, 1234];
// Optional 3rd arg: comma-separated arm names to run (default: all).
// Needed because 27 runs x 2400 ticks exceeds the 115 s command ceiling;
// run in batches (e.g. "baseline,predx3,predx8") and combine. The JSON line
// reports per-batch winners; ANY_WIN is batch-local.
const ONLY = process.argv[3]?.split(',');

interface Arm {
  name: string;
  config: Record<string, number | null>;
}

const ARMS: Arm[] = [
  { name: 'baseline', config: {} },
  { name: 'predx3', config: { predationYieldScale: 3 } },
  { name: 'predx8', config: { predationYieldScale: 8 } },
  { name: 'photox2', config: { consumerPhotoScale: 2 } },
  { name: 'photox4', config: { consumerPhotoScale: 4 } },
  { name: 'basal/2', config: { consumerBasalScale: 0.5 } },
  { name: 'basal/4', config: { consumerBasalScale: 0.25 } },
  { name: 'prodCap.6', config: { producerCaptureScale: 0.6 } },
  { name: 'prodCap.3', config: { producerCaptureScale: 0.3 } },
];

interface Cell {
  arm: string;
  seed: number;
  births: number;
  deaths: number;
  pop: number;
  consEnergyPct: number;
  prodEnergyPct: number;
  consumersAt: number[];
  capHits: number;
}

const cells: Cell[] = [];

const ACTIVE_ARMS = ONLY?.length ? ARMS.filter((a) => ONLY.includes(a.name)) : ARMS;
for (const arm of ACTIVE_ARMS) {
  for (const seed of SEEDS) {
    const probe = new ReproProbeLog(TROPHIC_COUNT);
    const w = new World({
      config: { founders: 400, worldW: 2400, worldH: 2400, seed, ...arm.config },
      reproProbe: probe,
    });
    const s = w.store;
    const marks = new Set([200, 400, 600, 800, 1000, 1400, 1800, 2100, 2300, 2400]);
    const at: number[] = [];
    for (let t = 1; t <= TICKS; t++) {
      w.step();
      if (marks.has(t)) {
        let n = 0;
        for (let sl = 0; sl < s.count; sl++) {
          if (w.aliveAt(sl) && w.roleOf(sl).trophic === TROPHIC.CONSUMER) n++;
        }
        at.push(n);
      }
    }
    const d = w.demographics();
    const en = [0, 0, 0];
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      const g = w.roleOf(sl).trophic;
      if (g >= 0 && g < TROPHIC_COUNT) en[g] += s.energy[sl];
    }
    const te = en.reduce((a, b) => a + b, 0) || 1;
    cells.push({
      arm: arm.name, seed,
      births: d.births[1][0] + d.births[1][1],
      deaths: d.deaths[1][0] + d.deaths[1][1] + d.deaths[1][2],
      pop: s.population,
      consEnergyPct: (en[1] / te) * 100,
      prodEnergyPct: (en[0] / te) * 100,
      consumersAt: at,
      capHits: (w as unknown as { populationCapHits: number }).populationCapHits,
    });
  }
}

console.log(`FOUR-WAY INTERVENTION SWEEP — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('Each arm varies ONE knob; baseline is declared behaviour.\n');
console.log('arm         seed   consBirths consDeaths    B/D   pop  cons%  prod%  capHits  consumers t=200..2400');
for (const c of cells) {
  const bd = c.deaths > 0 ? (c.births / c.deaths).toFixed(2) : 'n/a';
  console.log(
    `${c.arm.padEnd(11)} ${String(c.seed).padStart(5)} ${String(c.births).padStart(11)} ${String(c.deaths).padStart(11)} ` +
      `${bd.padStart(6)} ${String(c.pop).padStart(6)} ${c.consEnergyPct.toFixed(1).padStart(6)} ` +
      `${c.prodEnergyPct.toFixed(1).padStart(6)} ${String(c.capHits).padStart(8)}  ` +
      c.consumersAt.map((n) => String(n).padStart(4)).join(''),
  );
}

console.log('\nSUMMARY BY ARM');
console.log('arm          meanB/D  seedsB>D  seedsAliveEnd  meanBirths  meanDeaths  meanCons%  anyCapHit');
for (const arm of ACTIVE_ARMS) {
  const g = cells.filter((c) => c.arm === arm.name);
  const bd = g.map((c) => (c.deaths > 0 ? c.births / c.deaths : 0));
  const meanBd = bd.reduce((a, b) => a + b, 0) / bd.length;
  console.log(
    `${arm.name.padEnd(12)} ${meanBd.toFixed(3).padStart(9)} ` +
      `${String(g.filter((c) => c.births > c.deaths).length).padStart(9)} ` +
      `${String(g.filter((c) => c.consumersAt.at(-1)! > 0).length).padStart(14)} ` +
      `${(g.reduce((a, c) => a + c.births, 0) / g.length).toFixed(1).padStart(11)} ` +
      `${(g.reduce((a, c) => a + c.deaths, 0) / g.length).toFixed(1).padStart(11)} ` +
      `${(g.reduce((a, c) => a + c.consEnergyPct, 0) / g.length).toFixed(1).padStart(10)} ` +
      `${(g.some((c) => c.capHits > 0) ? 'YES' : 'no').padStart(10)}`,
  );
}

const base = cells.filter((c) => c.arm === 'baseline');
const baseBd = base.map((c) => (c.deaths > 0 ? c.births / c.deaths : 0)).reduce((a, b) => a + b, 0) / base.length;
console.log(`\nbaseline meanB/D ${baseBd.toFixed(3)}`);
console.log('WINNERS (B/D > 1.0 on any seed):');
for (const c of cells) {
  if (c.deaths > 0 && c.births / c.deaths > 1.0) {
    console.log(`  ${c.arm} seed ${c.seed}: B/D ${(c.births / c.deaths).toFixed(2)} (${c.births}/${c.deaths}) cons% ${c.consEnergyPct.toFixed(1)}`);
  }
}
const anyWin = cells.some((c) => c.deaths > 0 && c.births / c.deaths > 1.0);
console.log(`\nANY_WIN=${anyWin ? 1 : 0}`);
console.log(JSON.stringify({
  baselineBD: +baseBd.toFixed(4),
  anyWin: anyWin ? 1 : 0,
  bestArm: ARMS.map((a) => {
    const g = cells.filter((c) => c.arm === a.name);
    const bd = g.map((c) => (c.deaths > 0 ? c.births / c.deaths : 0));
    return { arm: a.name, bd: bd.reduce((x, y) => x + y, 0) / bd.length };
  }).reduce((x, y) => (y.bd > x.bd ? y : x)).arm,
}));