/**
 * Which trait collapsed? Asexual rate or mate seeking?
 *
 * The decomposition showed consumers' heritable trait term
 * A*(1-0.55*M)*2.4 sits at 0.0093 against a founder value of 0.3744 - 2.5% of
 * the original - while mean margin is identical to producers. The product can
 * collapse in two very different ways, and they imply different biology:
 *
 *   (a) asexualRate -> 0. Consumers stop reproducing asexually altogether.
 *       Sexual reproduction would then be their ONLY route, and it requires a
 *       mate, so consumers become hostage to mate encounter. This would be a
 *       coherent evolutionary trap: asexual reproduction is cheap and always
 *       available, so why would selection remove it? Only if it carries a cost
 *       that sexual reproduction avoids.
 *   (b) mateSeeking -> 1. The factor (1-0.55*M) floors at 0.45 and cannot zero
 *       the drive on its own, so this alone cannot explain the collapse.
 *
 * Measuring the trait distributions of the LIVING population, plus of the
 * ticks that reach the roll, distinguishes them directly.
 *
 * Run: tsx src/trace/traitsplit.ts [ticks] [seed,seed,...]
 */
import { World } from '../world/world.js';
import { TRAIT } from '../bio/genome.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { ReproProbeLog } from './reproprobe.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(24601, 777, 1234);

const q = (xs: number[], p: number): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
};

/** Trait quantiles for the living population of one guild, at end of run. */
function livingTraits(w: World, guild: number): Record<string, number[]> {
  const out: Record<string, number[]> = {
    asexualRate: [], mateSeeking: [], reproThreshold: [], basalCost: [], size: [],
  };
  const s = w.store;
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    if (w.roleOf(sl).trophic !== guild) continue;
    out.asexualRate.push(s.trait(sl, TRAIT.ASEXUAL_RATE));
    out.mateSeeking.push(s.trait(sl, TRAIT.MATE_SEEKING));
    out.reproThreshold.push(s.trait(sl, TRAIT.REPRO_THRESHOLD));
    out.basalCost.push(s.trait(sl, TRAIT.BASAL_COST));
    out.size.push(s.trait(sl, TRAIT.SIZE));
  }
  return out;
}

interface SeedRow {
  seed: number;
  digestOff: string;
  digestOn: string;
  traits: Record<number, Record<string, number[]>>;
  sexualBlocks: number;
  asexualRollEntries: number;
}

const rows: SeedRow[] = [];
for (const seed of SEEDS) {
  const probe = new ReproProbeLog(TROPHIC_COUNT);
  const wOff = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed } });
  for (let t = 0; t < TICKS; t++) wOff.step();
  const wOn = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed }, reproProbe: probe });
  for (let t = 0; t < TICKS; t++) wOn.step();

  const traits: Record<number, Record<string, number[]>> = {};
  for (const g of [TROPHIC.PRODUCER, TROPHIC.CONSUMER, TROPHIC.DECOMPOSER]) {
    traits[g] = livingTraits(wOn, g);
  }
  const c = probe.read(TROPHIC.CONSUMER);
  rows.push({
    seed,
    digestOff: wOff.hashState(),
    digestOn: wOn.hashState(),
    traits,
    sexualBlocks: c?.blocked[5] ?? 0,
    asexualRollEntries: c?.reachedRoll ?? 0,
  });
}

const perturbed = rows.some((r) => r.digestOff !== r.digestOn);
const NAMES = ['PRODUCER', 'CONSUMER', 'DECOMPOSER'];

console.log(`TRAIT SPLIT — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('Living population at end of run. Founder: asexualRate 0.2, mateSeeking 0.4.\n');
console.log('nonPerturbing=' + !perturbed + ' (hashState probe-off vs probe-on)');

for (const g of [TROPHIC.PRODUCER, TROPHIC.CONSUMER, TROPHIC.DECOMPOSER]) {
  const pool = rows.flatMap((r) => r.traits[g]?.asexualRate ?? []);
  const mPool = rows.flatMap((r) => r.traits[g]?.mateSeeking ?? []);
  const tPool = rows.flatMap((r) => r.traits[g]?.reproThreshold ?? []);
  console.log(`\n${NAMES[g]} (n=${pool.length} alive at end)`);
  if (pool.length < 5) { console.log('  too few survivors for trait statistics'); continue; }
  console.log(`  asexualRate    p10 ${q(pool, 0.1).toFixed(4)}  p50 ${q(pool, 0.5).toFixed(4)}  p90 ${q(pool, 0.9).toFixed(4)}   (founder 0.2000)`);
  console.log(`  mateSeeking    p10 ${q(mPool, 0.1).toFixed(4)}  p50 ${q(mPool, 0.5).toFixed(4)}  p90 ${q(mPool, 0.9).toFixed(4)}   (founder 0.4000)`);
  console.log(`  reproThreshold p10 ${q(tPool, 0.1).toFixed(4)}  p50 ${q(tPool, 0.5).toFixed(4)}  p90 ${q(tPool, 0.9).toFixed(4)}   (founder 0.6000)`);
  const nearZeroA = pool.filter((x) => x <= 1e-6).length;
  console.log(`  asexualRate <= 1e-6 : ${nearZeroA}/${pool.length} (${((nearZeroA / pool.length) * 100).toFixed(1)}%)`);
  const meanA = pool.reduce((a, b) => a + b, 0) / pool.length;
  const meanM = mPool.reduce((a, b) => a + b, 0) / mPool.length;
  console.log(`  implied trait term   : ${(meanA * (1 - meanM * 0.55) * 2.4).toFixed(4)}  (founder 0.3744)`);
}

const consBlocks = rows.reduce((a, r) => a + r.sexualBlocks, 0);
const consEntries = rows.reduce((a, r) => a + r.asexualRollEntries, 0);
console.log('\nCONSUMER REPRODUCTION ROUTING (whole run, pooled)');
console.log(`  ticks deferred to MATE interaction (sexual) : ${consBlocks}`);
console.log(`  ticks entering the asexual roll            : ${consEntries}`);
console.log(`  sexual share of all reproduction attempts   : ${((consBlocks / Math.max(1, consBlocks + consEntries)) * 100).toFixed(1)}%`);

const cPool = rows.flatMap((r) => r.traits[TROPHIC.CONSUMER]?.asexualRate ?? []);
const cMean = cPool.length ? cPool.reduce((a, b) => a + b, 0) / cPool.length : NaN;
console.log(`\nnonPerturbing=${!perturbed}`);
console.log(JSON.stringify({
  consumerMeanAsexualRate: Number.isFinite(cMean) ? +cMean.toFixed(6) : -1,
  consumerAsexualRateZeroPct: cPool.length ? +((cPool.filter((x) => x <= 1e-6).length / cPool.length) * 100).toFixed(3) : -1,
  consumerSexualSharePct: +((consBlocks / Math.max(1, consBlocks + consEntries)) * 100).toFixed(3),
  probeNonPerturbing: perturbed ? 0 : 1,
}));