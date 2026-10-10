/**
 * FIVE-SEED ACCEPTANCE — three-guild recurrence on an expanded seed set.
 *
 * The 3-seed acceptance (24601/777/1234) met the user-approved metric (all
 * guilds recurring, no zeros after start). This extends to 5 seeds by adding
 * 99991 (longest natural decomposer persistence in prior work) and 42
 * (strongest historical consumer peak, 721 at t2400).
 *
 * Configuration is the combined winner: consumerPhotoScale 4 + 25% decomposer
 * seeding + dormancy 0.05 + spore dispersal. 2400 ticks.
 *
 * Reports per seed: P/C/D trajectory at 6 checkpoints, B/D by guild,
 * mineralizer count at end, dormant count at end. Pass = all guilds present
 * at every checkpoint (no zeros after start).
 *
 * Machine-readable JSON last line for MCP contracts.
 *
 * Run: tsx src/trace/fiveseed.ts [ticks]
 */
import { World } from '../world/world.js';
import { TROPHIC_COUNT } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 2400);
// Optional comma-separated seeds (default: the standard five). A fixed seed set
// per command keeps runs reproducible and authorizable as MCP commands.
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : [24601, 777, 1234, 99991, 42];

interface SeedResult {
  seed: number;
  traj: string[];
  bdProd: number;
  bdCons: number;
  bdDecomp: number;
  minersEnd: number;
  dormantEnd: number;
  allPresent: boolean;
}

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
  const marks = new Set([200, 400, 800, 1400, 1900, 2400].filter((t) => t <= TICKS));
  const traj: string[] = [];
  let minersEnd = 0, dormantEnd = 0;
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    if (marks.has(t)) {
      const n = [0, 0, 0];
      let miners = 0;
      for (let sl = 0; sl < s.count; sl++) {
        if (!w.aliveAt(sl)) continue;
        const g = w.roleOf(sl).trophic;
        if (g >= 0 && g < TROPHIC_COUNT) n[g]++;
        if (w.bioticMineraliser[sl] === 1) miners++;
      }
      const [dd] = w.dormantCounts();
      if (t === TICKS) { minersEnd = miners; dormantEnd = dd; }
      traj.push(`t${t}:P${n[0]}/C${n[1]}/D${n[2]}`);
    }
  }
  const d = w.demographics();
  const bd = (g: number): number => {
    const b = d.births[g].reduce((a: number, x: number) => a + x, 0);
    const dd = d.deaths[g].reduce((a: number, x: number) => a + x, 0);
    return dd > 0 ? b / dd : -1;
  };
  // All guilds present at every checkpoint = no "/C0", "/D0", or "P0/" segments.
  const allPresent = traj.every((seg) => !seg.includes('/C0') && !seg.includes('/D0') && !seg.includes(':P0/'));
  results.push({
    seed, traj,
    bdProd: bd(0), bdCons: bd(1), bdDecomp: bd(2),
    minersEnd, dormantEnd, allPresent,
  });
}

console.log(`SEED ACCEPTANCE — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('Combined winner: photox4 + 25% seeding + dormancy 0.05 + spores.\n');
for (const r of results) {
  console.log(
    `seed ${r.seed}: ${r.traj.join(' ')}\n` +
      `  B/D P=${r.bdProd.toFixed(2)} C=${r.bdCons.toFixed(2)} D=${r.bdDecomp.toFixed(2)} ` +
      `minersEnd=${r.minersEnd} dormantEnd=${r.dormantEnd} ALL_PRESENT=${r.allPresent ? 1 : 0}`,
  );
}

const passCount = results.filter((r) => r.allPresent).length;
console.log(`\nSEEDS_PASSING=${passCount}/${results.length}`);
console.log('ACCEPTANCE = all guilds recurring (no zeros after start) on every seed.');
console.log(JSON.stringify({
  seedsPassing: passCount,
  seedsTotal: results.length,
  allPass: passCount === results.length ? 1 : 0,
  meanConsBD: +(results.reduce((a, r) => a + r.bdCons, 0) / results.length).toFixed(4),
  seedsConsAboveOne: results.filter((r) => r.bdCons > 1.0).length,
}));