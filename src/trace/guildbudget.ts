/**
 * PER-GUILD ENERGY BUDGET — can CONSUMERS afford to breed?
 *
 * THE GAP THIS CLOSES
 * The global ledger showed reproduction is 3.9% of all spending and basal
 * upkeep is 81.5%. But the ledger was GLOBAL: it cannot say whether that 3.9%
 * is affordable for a guild holding 9.5% of ecosystem energy and falling. The
 * engine now records per-guild expenditure (5 buckets x 3 guilds), per-guild
 * parental transfer at birth, and the crowding (density) cost separately.
 *
 * THREE QUESTIONS, EACH PREVIOUSLY UNANSWERABLE
 *   1. AFFORDABILITY: for consumers specifically, what share of THEIR spending
 *      goes to reproduction vs staying alive? If consumers spend nearly
 *      everything on basal, they cannot fund breeding no matter how cheap it
 *      is globally.
 *   2. DENSITY: who pays the crowding cost, and does it bind? The engine charges
 *      (crowding-4)*0.006*(1+SIZE) as basal when local crowding exceeds 4, but
 *      that term was never measured on its own. If crowding cost is negligible,
 *      density dependence does not bind and reproduction buys no advantage.
 *   3. TRANSFER: how large is the parental reserve transfer relative to the
 *      act cost, per guild? Two experiments removed each term and both failed
 *      to preserve asexualRate; this shows their RELATIVE sizes, which tells us
 *      whether the right term was even tested.
 *
 * Run: tsx src/trace/guildbudget.ts [ticks] [seed,seed,...]
 */
import { World } from '../world/world.js';
import { TROPHIC_COUNT } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(24601, 777, 1234);

const NAMES = ['PRODUCER', 'CONSUMER', 'DECOMPOSER'];
const BUCKETS = ['basal', 'movement', 'sensing', 'contest', 'reproduction'];

interface GuildBudget {
  seed: number;
  spentByGuild: number[][];
  transferredOut: number[];
  crowding: number[];
  crowdingTotal: number;
  globalBuckets: number[];
  guildPop: number[];
  guildEnergy: number[];
  births: number[];
  deaths: number[];
  digest: string;
}

const rows: GuildBudget[] = [];

for (const seed of SEEDS) {
  const w = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed } });
  for (let t = 0; t < TICKS; t++) w.step();
  const s = w.store;
  const L = w.ledger as unknown as {
    basalSpent: number; movementSpent: number; sensingSpent: number;
    contestSpent: number; reproductionSpent: number;
    spentByGuild: Float64Array; transferredOutByGuild: Float64Array;
    crowdingSpent: number; crowdingByGuild: Float64Array;
  };
  const spentByGuild: number[][] = [];
  for (let g = 0; g < TROPHIC_COUNT; g++) {
    spentByGuild.push(Array.from(L.spentByGuild.slice(g * 5, g * 5 + 5)));
  }
  const guildPop = [0, 0, 0];
  const guildEnergy = [0, 0, 0];
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const g = w.roleOf(sl).trophic;
    if (g < 0 || g >= TROPHIC_COUNT) continue;
    guildPop[g]++;
    guildEnergy[g] += s.energy[sl];
  }
  const d = w.demographics();
  rows.push({
    seed,
    spentByGuild,
    transferredOut: Array.from(L.transferredOutByGuild),
    crowding: Array.from(L.crowdingByGuild),
    crowdingTotal: L.crowdingSpent,
    globalBuckets: [L.basalSpent, L.movementSpent, L.sensingSpent, L.contestSpent, L.reproductionSpent],
    guildPop, guildEnergy,
    births: [0, 1, 2].map((g) => d.births[g].reduce((a: number, x: number) => a + x, 0)),
    deaths: [0, 1, 2].map((g) => d.deaths[g].reduce((a: number, x: number) => a + x, 0)),
    digest: w.hashState(),
  });
}

// Consistency: per-guild sums must equal the global buckets.
let consistent = true;
for (const r of rows) {
  for (let b = 0; b < 5; b++) {
    const sum = r.spentByGuild.reduce((a, g) => a + g[b], 0);
    if (Math.abs(sum - r.globalBuckets[b]) > 1e-6 * Math.max(1, r.globalBuckets[b])) {
      consistent = false;
      console.log(`MISMATCH seed ${r.seed} bucket ${BUCKETS[b]}: guildSum ${sum} vs global ${r.globalBuckets[b]}`);
    }
  }
}

console.log(`PER-GUILD ENERGY BUDGET — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log(`perGuildSumsMatchGlobal=${consistent}\n`);

console.log('PER-GUILD EXPENDITURE (cumulative, pooled across seeds)');
console.log('guild         basal    move    sense  contest   REPRO    total   repro%');
for (let g = 0; g < TROPHIC_COUNT; g++) {
  const tot = [0, 1, 2, 3, 4].map((b) => rows.reduce((a, r) => a + r.spentByGuild[g][b], 0));
  const grand = tot.reduce((a, b) => a + b, 0) || 1;
  const pc = (x: number): string => ((x / grand) * 100).toFixed(1).padStart(7);
  console.log(
    `${NAMES[g].padEnd(12)} ${tot.map((x) => x.toFixed(0).padStart(9)).join('')} ${tot.reduce((a: number, x: number) => a + x, 0).toFixed(0).padStart(8)} ` +
      `${((tot[4] / grand) * 100).toFixed(1).padStart(6)}%`,
  );
  void pc;
}

console.log('\nPARENTAL TRANSFER OUT (per-guild, pooled) vs ACT COST (reproduction bucket)');
console.log('guild         transferOut   actCost(repro)   transfer/act   births');
for (let g = 0; g < TROPHIC_COUNT; g++) {
  const tr = rows.reduce((a, r) => a + r.transferredOut[g], 0);
  const act = rows.reduce((a, r) => a + r.spentByGuild[g][4], 0);
  const births = rows.reduce((a, r) => a + r.births[g], 0);
  console.log(
    `${NAMES[g].padEnd(12)} ${tr.toFixed(1).padStart(12)} ${act.toFixed(1).padStart(15)} ` +
      `${(act > 0 ? (tr / act).toFixed(1) : 'n/a').padStart(13)}x ${String(births).padStart(7)}`,
  );
}

console.log('\nCROWDING (density) COST — who pays, and does it bind?');
console.log('guild         crowdingPaid   shareOfGuildSpend   shareOfGlobalCrowding');
for (let g = 0; g < TROPHIC_COUNT; g++) {
  const cw = rows.reduce((a, r) => a + r.crowding[g], 0);
  const guildTot = rows.reduce((a, r) => a + r.spentByGuild[g].reduce((x: number, y: number) => x + y, 0), 0) || 1;
  const globCw = rows.reduce((a, r) => a + r.crowdingTotal, 0) || 1;
  console.log(
    `${NAMES[g].padEnd(12)} ${cw.toFixed(1).padStart(13)} ${(cw / guildTot * 100).toFixed(3).padStart(16)}% ` +
      `${(cw / globCw * 100).toFixed(1).padStart(19)}%`,
  );
}
{
  const globCw = rows.reduce((a, r) => a + r.crowdingTotal, 0);
  const globSpend = rows.reduce((a, r) => a + r.globalBuckets.reduce((x: number, y: number) => x + y, 0), 0) || 1;
  console.log(`\n  crowding as share of ALL spending: ${((globCw / globSpend) * 100).toFixed(3)}%`);
  console.log('  If this is tiny, density dependence does not bind: being numerous costs');
  console.log('  nothing, so reproduction buys no competitive advantage.');
}

console.log('\nAFFORDABILITY — per-capita spending by guild (pooled)');
console.log('guild        alive(end)  spend/capita  basal/capita  repro/capita  energyHeld/capita');
for (let g = 0; g < TROPHIC_COUNT; g++) {
  const pop = rows.reduce((a, r) => a + r.guildPop[g], 0);
  const spend = rows.reduce((a, r) => a + r.spentByGuild[g].reduce((x: number, y: number) => x + y, 0), 0);
  const basal = rows.reduce((a, r) => a + r.spentByGuild[g][0], 0);
  const repro = rows.reduce((a, r) => a + r.spentByGuild[g][4], 0);
  const held = rows.reduce((a, r) => a + r.guildEnergy[g], 0);
  const per = (x: number): string => (pop > 0 ? (x / pop).toFixed(2).padStart(11) : 'n/a'.padStart(11));
  console.log(
    `${NAMES[g].padEnd(12)} ${String(pop).padStart(10)} ${per(spend)} ${per(basal)} ${per(repro)} ${per(held)}`,
  );
}

const cSpend = rows.reduce((a, r) => a + r.spentByGuild[1].reduce((x: number, y: number) => x + y, 0), 0);
const cRepro = rows.reduce((a, r) => a + r.spentByGuild[1][4], 0);
const cBasal = rows.reduce((a, r) => a + r.spentByGuild[1][0], 0);
const cTrans = rows.reduce((a, r) => a + r.transferredOut[1], 0);
const cBirths = rows.reduce((a, r) => a + r.births[1], 0);
console.log('\nCONSUMER ANSWER (pooled)');
console.log(`  consumer reproduction share of THEIR budget : ${((cRepro / (cSpend || 1)) * 100).toFixed(2)}%`);
console.log(`  consumer basal share of THEIR budget        : ${((cBasal / (cSpend || 1)) * 100).toFixed(2)}%`);
console.log(`  parental transfer vs act cost (consumers)   : ${(cRepro > 0 ? (cTrans / cRepro).toFixed(1) : 'n/a')}x`);
console.log(`  births per unit reproduction spend          : ${(cRepro > 0 ? (cBirths / cRepro).toFixed(2) : 'n/a')}`);
console.log(`\nperGuildSumsMatchGlobal=${consistent}`);
console.log(JSON.stringify({
  consumerReproSharePct: +((cRepro / (cSpend || 1)) * 100).toFixed(4),
  consumerBasalSharePct: +((cBasal / (cSpend || 1)) * 100).toFixed(4),
  consumerTransferToActRatio: cRepro > 0 ? +(cTrans / cRepro).toFixed(4) : -1,
  crowdingShareOfAllSpendPct: (() => {
    const gc = rows.reduce((a, r) => a + r.crowdingTotal, 0);
    const gs = rows.reduce((a, r) => a + r.globalBuckets.reduce((x: number, y: number) => x + y, 0), 0) || 1;
    return +(gc / gs * 100).toFixed(5);
  })(),
  perGuildSumsMatchGlobal: consistent ? 1 : 0,
}));