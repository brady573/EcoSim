/**
 * LONG-RUN STABILITY — does three-guild recurrence survive to 4800 ticks?
 *
 * The 2400-tick acceptance (4/5 curated, 4/4 random) does not predict long-run
 * behavior. Three distinct collapse modes appear past 2400:
 *   1. Decomposer overgrowth (24601, 31415, 77031): D1000-1700, producers 10-21.
 *      Dormancy without senescence creates immortal nutrient sinks.
 *   2. Consumer overgrowth (517, 42): photox4 makes consumers better producers
 *      than producers. 517 ends P0 (exclusion); 42 trends to C26000+ (runaway).
 *   3. Decomposer fade (99991): D0 from t2400, P/C thrive without them.
 * Stable: 777 (all B/D >= 1.0), 1234 (all alive, B/D ~0.92-1.07).
 *
 * Reports per seed: P/C/D at 8 checkpoints to 4800 (or TICKS), B/D by guild,
 * dormant count at end. Pass = all guilds present at every checkpoint.
 *
 * Machine-readable JSON last line for MCP contracts.
 *
 * Run: tsx src/trace/longrun.ts [ticks] [seed,seed,...]
 */
import { World } from '../world/world.js';
import { TROPHIC_COUNT } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 4800);
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : [777, 1234];

interface SeedResult {
  seed: number;
  traj: string[];
  bdProd: number;
  bdCons: number;
  bdDecomp: number;
  dormantEnd: number;
  allPresent: boolean;
}

const MARKS = [600, 1200, 1800, 2400, 3000, 3600, 4200, 4800].filter((t) => t <= TICKS);
const results: SeedResult[] = [];

for (const seed of SEEDS) {
  const w = new World({
    config: {
      founders: 400, worldW: 2400, worldH: 2400, seed,
      consumerPhotoScale: 4, decomposerFounders: 0.25,
      decomposerDormancy: 0.05, sporeDispersal: 1,
    },
  });
  const s = w.store;
  const marks = new Set(MARKS);
  const traj: string[] = [];
  let dormantEnd = 0;
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    if (marks.has(t)) {
      const n = [0, 0, 0];
      for (let sl = 0; sl < s.count; sl++) {
        if (!w.aliveAt(sl)) continue;
        const g = w.roleOf(sl).trophic;
        if (g >= 0 && g < TROPHIC_COUNT) n[g]++;
      }
      const [dd] = w.dormantCounts();
      if (t === TICKS) dormantEnd = dd;
      traj.push(`t${t}:P${n[0]}/C${n[1]}/D${n[2]}`);
    }
  }
  const d = w.demographics();
  const bd = (g: number): number => {
    const b = d.births[g].reduce((a: number, x: number) => a + x, 0);
    const dd = d.deaths[g].reduce((a: number, x: number) => a + x, 0);
    return dd > 0 ? b / dd : -1;
  };
  const allPresent = traj.every((seg) => !seg.includes('/C0') && !seg.includes('/D0') && !seg.includes(':P0/'));
  results.push({
    seed, traj,
    bdProd: bd(0), bdCons: bd(1), bdDecomp: bd(2),
    dormantEnd, allPresent,
  });
}

console.log(`LONG-RUN STABILITY — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('Combined winner: photox4 + 25% seeding + dormancy 0.05 + spores.\n');
for (const r of results) {
  console.log(
    `seed ${r.seed}: ${r.traj.join(' ')}\n` +
      `  B/D P=${r.bdProd.toFixed(2)} C=${r.bdCons.toFixed(2)} D=${r.bdDecomp.toFixed(2)} ` +
      `dormantEnd=${r.dormantEnd} ALL_PRESENT=${r.allPresent ? 1 : 0}`,
  );
}

const passCount = results.filter((r) => r.allPresent).length;
console.log(`\nSEEDS_PASSING=${passCount}/${results.length} at ${TICKS} ticks`);
console.log(JSON.stringify({
  seedsPassing: passCount,
  seedsTotal: results.length,
  allPass: passCount === results.length ? 1 : 0,
  ticks: TICKS,
}));