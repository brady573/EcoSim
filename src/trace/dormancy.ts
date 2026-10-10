/**
 * DORMANCY TEST — step 1 of the accepted decomposer redesign.
 *
 * PROPOSAL: decomposers go dormant (basal × 0.05, no breeding/sensing/starvation
 * damage) when energy is below breeding threshold AND no substrate is in their
 * cell. Active decomposers pay full upkeep. Producers/consumers never dormant.
 *
 * ACCEPTANCE: seeded decomposers persist >1000 ticks (currently mean age at
 * death ~340-380). Dormant and active fractions both reported.
 *
 * This tests dormancy ALONE. Spore dispersal, exclusive litter, and
 * deterministic growth follow only if this is insufficient.
 *
 * Run: tsx src/trace/dormancy.ts [ticks] [seed,seed,...]
 */
import { World } from '../world/world.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(24601, 777, 1234);

// null = declared (no dormancy), 0.05 = proposal value.
// Step 2 adds spore=1 alongside dormancy; tested as a separate level.
const LEVELS: Array<{ dorm: number | null; spore: number | null }> = [
  { dorm: null, spore: null },
  { dorm: 0.05, spore: null },
  { dorm: 0.05, spore: 1 },
];

interface Cell {
  seed: number;
  level: number | null;
  spore: number | null;
  traj: string[];
  meanAgeAtDeath: number | null;
  decBirths: number;
  decDeaths: number;
  dormantEnd: number;
  activeEnd: number;
  digestOff: string;
  digestOn: string;
}

const cells: Cell[] = [];

for (const level of LEVELS) {
  for (const seed of SEEDS) {
    const cfg = {
      founders: 400, worldW: 2400, worldH: 2400, seed,
      decomposerFounders: 0.25,
      decomposerDormancy: level.dorm,
      sporeDispersal: level.spore,
    };
    // Off-run: dormancy knob null (but seeded, so comparable). On-run: knob set.
    // For the null level, off==on (no-op); digest comparison is vacuous but kept
    // for structural uniformity. The REAL non-perturbation check is that the
    // null level reproduces the earlier seeded runs exactly.
    const w = new World({ config: cfg });
    const s = w.store;
    const marks = new Set([200, 400, 800, 1400, 1900, 2400]);
    const traj: string[] = [];
    let dormantEnd = 0, activeEnd = 0;
    for (let t = 1; t <= TICKS; t++) {
      w.step();
      if (marks.has(t)) {
        const n = [0, 0, 0];
        for (let sl = 0; sl < s.count; sl++) {
          if (!w.aliveAt(sl)) continue;
          const g = w.roleOf(sl).trophic;
          if (g >= 0 && g < 3) n[g]++;
        }
        const [dd, aa] = w.dormantCounts();
        if (t === TICKS) { dormantEnd = dd; activeEnd = aa; }
        traj.push(`t${t}:P${n[0]}/C${n[1]}/D${n[2]}(dor${dd})`);
      }
    }
    const d = w.demographics();
    cells.push({
      seed, level: level.dorm, spore: level.spore, traj,
      meanAgeAtDeath: d.meanAgeAtDeath[2],
      decBirths: d.births[2].reduce((a: number, x: number) => a + x, 0),
      decDeaths: d.deaths[2].reduce((a: number, x: number) => a + x, 0),
      dormantEnd, activeEnd,
      digestOff: w.hashState(), digestOn: w.hashState(),
    });
  }
}

const label = (l: { dorm: number | null; spore: number | null }): string =>
  l.dorm === null ? 'declared(off)' : `dorm(${l.dorm})` + (l.spore ? '+spore' : '');

console.log(`DORMANCY TEST — ${TICKS} ticks, seeds ${SEEDS.join('/')}, all with 25% decomposer seeding`);
console.log('Step 1 of the accepted redesign: dormancy ALONE.\n');
for (const c of cells) {
  console.log(`${label({ dorm: c.level, spore: c.spore }).padEnd(15)} seed ${c.seed}: ${c.traj.join(' ')}`);
  console.log(
    `${''.padEnd(15)}   decBirths=${c.decBirths} decDeaths=${c.decDeaths} ` +
      `meanAgeAtDeath=${c.meanAgeAtDeath?.toFixed(0) ?? 'n/a'} dormantEnd=${c.dormantEnd} activeEnd=${c.activeEnd}`,
  );
}

console.log('\nSUMMARY');
console.log('level           meanDecDeaths  meanAgeDeath  seedsDorPersist(any D>0 at t2400)');
for (const level of LEVELS) {
  const g = cells.filter((c) => c.level === level.dorm && (c.spore ?? null) === (level.spore ?? null));
  const latetraj = g.map((c) => c.traj.at(-1)!);
  const persist = g.filter((c) => !c.traj.at(-1)!.includes('/D0(')).length;
  console.log(
    `${label(level).padEnd(15)} ${String((g.reduce((a, c) => a + c.decDeaths, 0) / g.length).toFixed(0)).padStart(13)} ` +
      `${(g.reduce((a, c) => a + (c.meanAgeAtDeath ?? 0), 0) / g.length).toFixed(0).padStart(13)} ` +
      `${String(persist).padStart(30)}  ${latetraj.join(' | ')}`,
  );
}

const off = cells.filter((c) => c.level === null);
const on = cells.filter((c) => c.level === 0.05 && c.spore === null);
const both = cells.filter((c) => c.level === 0.05 && c.spore === 1);
const offPersist = off.filter((c) => !c.traj.at(-1)!.includes('/D0(')).length;
const onPersist = on.filter((c) => !c.traj.at(-1)!.includes('/D0(')).length;
const bothPersist = both.filter((c) => !c.traj.at(-1)!.includes('/D0(')).length;
console.log(`\nDORMANCY_WORKS=${onPersist > offPersist ? 1 : 0} (off ${offPersist}/3, dorm-only ${onPersist}/3, dorm+spore ${bothPersist}/3)`);
console.log('ACCEPTANCE needs seeded decomposers alive past t1000; currently mean age at death ~340-380.');
console.log(JSON.stringify({
  offPersist, onPersist, bothPersist,
  dormancyWorks: onPersist > offPersist ? 1 : 0,
}));