/**
 * PER-GUILD INCOME — who captures what, and why consumers capture almost nothing.
 *
 * THE GAP THIS CLOSES
 * The expenditure side is now fully attributed: consumers spend 1.3% of their
 * budget on reproduction and 75.9% on upkeep, from a total budget 40x smaller
 * than producers'. But that only shows consumers are POOR. It does not show
 * WHY they are poor. Energy enters through three paths — photosynthesis
 * (capture), scavenging (detritus), predation (stealing from others) — and the
 * ledger recorded all three GLOBALLY but none per-guild.
 *
 * THREE QUESTIONS
 *   1. SOURCE: what fraction of consumer income comes from predation vs
 *      scavenging vs (unexpected) photosynthesis? If consumers predate almost
 *      nothing, they are failing to catch or kill, not failing to digest.
 *   2. EFFICIENCY: what share of what consumers ingest is wasted
 *      (unassimilated)? If they ingest plenty but waste most of it, digestion
 *      is the bottleneck, not foraging.
 *   3. SCALE: how does total consumer income compare to producer capture? The
 *      40x budget gap has to come from somewhere on the income side.
 *
 * Run: tsx src/trace/guildincome.ts [ticks] [seed,seed,...]
 */
import { World } from '../world/world.js';
import { TROPHIC_COUNT } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(24601, 777, 1234);

const NAMES = ['PRODUCER', 'CONSUMER', 'DECOMPOSER'];

interface IncomeRow {
  seed: number;
  captured: number[];
  scavenged: number[];
  predated: number[];
  unassimilated: number[];
  globalCapture: number;
  globalScavenged: number;
  globalPredated: number;
  globalUnassimilated: number;
  guildPop: number[];
  guildEnergy: number[];
  births: number[];
  consistent: boolean;
}

const rows: IncomeRow[] = [];

for (const seed of SEEDS) {
  const w = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed } });
  for (let t = 0; t < TICKS; t++) w.step();
  const s = w.store;
  const L = w.ledger as unknown as {
    capture: number; scavenged: number; predated: number; unassimilated: number;
    capturedByGuild: Float64Array; scavengedByGuild: Float64Array;
    predatedByGuild: Float64Array; unassimilatedByGuild: Float64Array;
  };
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
  const arr = (f: Float64Array): number[] => Array.from(f);
  const tol = (x: number): number => 1e-6 * Math.max(1, x);
  const sum = (f: Float64Array): number => arr(f).reduce((a, b) => a + b, 0);
  const consistent =
    Math.abs(sum(L.capturedByGuild) - L.capture) < tol(L.capture) &&
    Math.abs(sum(L.scavengedByGuild) - L.scavenged) < tol(L.scavenged) &&
    Math.abs(sum(L.predatedByGuild) - L.predated) < tol(L.predated) &&
    Math.abs(sum(L.unassimilatedByGuild) - L.unassimilated) < tol(L.unassimilated);
  rows.push({
    seed,
    captured: arr(L.capturedByGuild), scavenged: arr(L.scavengedByGuild),
    predated: arr(L.predatedByGuild), unassimilated: arr(L.unassimilatedByGuild),
    globalCapture: L.capture, globalScavenged: L.scavenged,
    globalPredated: L.predated, globalUnassimilated: L.unassimilated,
    guildPop, guildEnergy,
    births: [0, 1, 2].map((g) => d.births[g].reduce((a: number, x: number) => a + x, 0)),
    consistent,
  });
}

const allConsistent = rows.every((r) => r.consistent);

console.log(`PER-GUILD INCOME — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log(`perGuildSumsMatchGlobal=${allConsistent}\n`);

console.log('INCOME BY GUILD AND SOURCE (cumulative, pooled across seeds)');
console.log('guild         capture  scavenge   predate    TOTAL   cap%  scav%  pred%');
for (let g = 0; g < TROPHIC_COUNT; g++) {
  const cap = rows.reduce((a, r) => a + r.captured[g], 0);
  const scv = rows.reduce((a, r) => a + r.scavenged[g], 0);
  const prd = rows.reduce((a, r) => a + r.predated[g], 0);
  const tot = cap + scv + prd || 1;
  console.log(
    `${NAMES[g].padEnd(12)} ${cap.toFixed(0).padStart(9)} ${scv.toFixed(0).padStart(9)} ${prd.toFixed(0).padStart(9)} ` +
      `${tot.toFixed(0).padStart(8)} ${(cap / tot * 100).toFixed(1).padStart(5)}% ${(scv / tot * 100).toFixed(1).padStart(5)}% ` +
      `${(prd / tot * 100).toFixed(1).padStart(5)}%`,
  );
}

console.log('\nDIGESTION EFFICIENCY — ingested vs wasted (pooled)');
console.log('guild        scavenged  unassimilated   waste%   (waste = ingested but not usable)');
for (let g = 0; g < TROPHIC_COUNT; g++) {
  const scv = rows.reduce((a, r) => a + r.scavenged[g], 0);
  const unw = rows.reduce((a, r) => a + r.unassimilated[g], 0);
  console.log(
    `${NAMES[g].padEnd(12)} ${scv.toFixed(0).padStart(10)} ${unw.toFixed(0).padStart(13)} ` +
      `${(scv > 0 ? (unw / scv * 100).toFixed(1) : 'n/a').padStart(7)}%`,
  );
}

console.log('\nSCALE — total income per guild (pooled)');
{
  const tot = [0, 1, 2].map((g) =>
    rows.reduce((a, r) => a + r.captured[g] + r.scavenged[g] + r.predated[g], 0));
  const grand = tot.reduce((a, b) => a + b, 0) || 1;
  for (let g = 0; g < TROPHIC_COUNT; g++) {
    console.log(`  ${NAMES[g].padEnd(10)} ${tot[g].toFixed(0).padStart(10)}  (${(tot[g] / grand * 100).toFixed(1)}% of all income)`);
  }
  console.log(`\n  producer-to-consumer income ratio: ${(tot[0] / Math.max(1, tot[1])).toFixed(1)}x`);
}

console.log('\nPER-SEED CONSUMER DETAIL');
console.log('seed      capture  scavenge   predate  unassim   births  alive(end)');
for (const r of rows) {
  console.log(
    `${String(r.seed).padStart(6)} ${r.captured[1].toFixed(0).padStart(8)} ${r.scavenged[1].toFixed(0).padStart(9)} ` +
      `${r.predated[1].toFixed(0).padStart(8)} ${r.unassimilated[1].toFixed(0).padStart(8)} ` +
      `${String(r.births[1]).padStart(7)} ${String(r.guildPop[1]).padStart(11)}`,
  );
}

const cCap = rows.reduce((a, r) => a + r.captured[1], 0);
const cScv = rows.reduce((a, r) => a + r.scavenged[1], 0);
const cPrd = rows.reduce((a, r) => a + r.predated[1], 0);
const cUnw = rows.reduce((a, r) => a + r.unassimilated[1], 0);
const pTot = rows.reduce((a, r) => a + r.captured[0] + r.scavenged[0] + r.predated[0], 0);
const cTot = cCap + cScv + cPrd || 1;
console.log('\nCONSUMER ANSWER (pooled)');
console.log(`  predation share of consumer income  : ${(cPrd / cTot * 100).toFixed(1)}%`);
console.log(`  scavenging share                    : ${(cScv / cTot * 100).toFixed(1)}%`);
console.log(`  photosynthesis share (unexpected?)  : ${(cCap / cTot * 100).toFixed(1)}%`);
console.log(`  waste rate (unassimilated/scavenged): ${(cScv > 0 ? cUnw / cScv * 100 : 0).toFixed(1)}%`);
console.log(`  producer-to-consumer income ratio   : ${(pTot / cTot).toFixed(1)}x`);
console.log(`\nperGuildSumsMatchGlobal=${allConsistent}`);
console.log(JSON.stringify({
  consumerPredationSharePct: +((cPrd / cTot) * 100).toFixed(3),
  consumerScavengeSharePct: +((cScv / cTot) * 100).toFixed(3),
  consumerCaptureSharePct: +((cCap / cTot) * 100).toFixed(3),
  consumerWastePct: cScv > 0 ? +((cUnw / cScv) * 100).toFixed(3) : -1,
  producerToConsumerIncomeRatio: +((pTot / cTot).toFixed(3)),
  perGuildSumsMatchGlobal: allConsistent ? 1 : 0,
}));