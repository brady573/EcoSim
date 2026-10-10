/**
 * Drive decomposition — why consumer drive is so low.
 *
 * THE PROBLEM WITH THE PREVIOUS EXPLANATION
 * The prior conclusion held that consumers lose the breeding lottery because
 * they arrive at the gate with ~zero energy margin. The arithmetic refutes that.
 * With founder trait values (asexualRate 0.2, mateSeeking 0.4) the minimum
 * possible drive at ZERO margin is:
 *
 *     0.2 * (1 - 0.4*0.55) * 2.4 * 0.25 * 1  =  0.0936
 *
 * but the measured mean consumer drive (over positive-drive ticks) is 0.0182 —
 * about 5x BELOW the floor that margin alone can produce. Margin cannot explain
 * it. The deficit has to be in the heritable trait term
 * A*(1-0.55*M)*2.4, i.e. asexualRate and/or mateSeeking.
 *
 * A further hint: 1,541 of 3,396 consumer reached-roll ticks had drive <= 0.
 * Every other factor in the formula is positive whenever margin >= 0, which the
 * fraction gate guarantees. drive <= 0 therefore implies asexualRate <= 0 —
 * i.e. evolution drove asexual reproduction to zero in part of the population.
 *
 * WHAT THIS MEASURES
 * For every consumer (and producer, for contrast) tick that clears all gates:
 *   - margin = energyFrac - reproThreshold, and its distribution
 *   - the implied trait term, recovered by dividing out the known gain term
 *     gain(m) = (m + 0.25) * (1 + 10m), which depends only on margin
 *   - how many ticks cleared the gate yet still had drive <= 0
 *
 * Run: tsx src/trace/drivedecomp.ts [ticks] [seed,seed,...] [--threshold X]
 */
import { World } from '../world/world.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { ReproProbeLog } from './reproprobe.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(24601, 777, 1234);
const THRESH = process.argv.includes('--threshold')
  ? Number(process.argv[process.argv.indexOf('--threshold') + 1])
  : null;

/** Founder trait values, used only to state the arithmetic floor for comparison. */
const FOUNDER_A = 0.2;
const FOUNDER_M = 0.4;
const founderFloor = FOUNDER_A * (1 - FOUNDER_M * 0.55) * 2.4 * 0.25;

interface Row {
  seed: number;
  probe: ReproProbeLog;
  digestOff: string;
  digestOn: string;
}

const rows: Row[] = [];
for (const seed of SEEDS) {
  const mk = (probe: ReproProbeLog | null): World =>
    new World({
      config: { founders: 400, worldW: 2400, worldH: 2400, seed, reproThresholdInit: THRESH },
      reproProbe: probe ?? undefined,
    });
  const probe = new ReproProbeLog(TROPHIC_COUNT);
  const wOff = mk(null);
  for (let t = 0; t < TICKS; t++) wOff.step();
  const wOn = mk(probe);
  for (let t = 0; t < TICKS; t++) wOn.step();
  rows.push({ seed, probe, digestOff: wOff.hashState(), digestOn: wOn.hashState() });
}

const perturbed = rows.some((r) => r.digestOff !== r.digestOn);

console.log(`DRIVE DECOMPOSITION — ${TICKS} ticks, seeds ${SEEDS.join('/')}` +
  (THRESH === null ? '' : `, founder reproThreshold ${THRESH}`));
console.log(`\nArithmetic floor: with founder traits (A=${FOUNDER_A}, M=${FOUNDER_M}), the`);
console.log(`minimum drive at ZERO margin is ${founderFloor.toFixed(4)}. Any mean drive below`);
console.log('that cannot be explained by margin alone.');
console.log(`\nnonPerturbing=${!perturbed} (hashState probe-off vs probe-on)`);

const NAMES = ['PRODUCER', 'CONSUMER', 'DECOMPOSER'];

console.log('\nMARGIN AND TRAIT TERM AT THE GATE (fraction gate guarantees margin >= 0)');
console.log('guild        reached  meanMargin  ~zero%   drivePos  traitTerm  asexRate  mateSeek  A~0%  drive<=0%');
for (let g = 0; g < TROPHIC_COUNT; g++) {
  let reached = 0, mSum = 0, mN = 0, zero = 0, tSum = 0, dPos = 0, dPosN = 0, npd = 0;
  let aSum = 0, mSum2 = 0, aZero = 0;
  for (const r of rows) {
    const s = r.probe.read(g);
    if (!s) continue;
    reached += s.reachedRoll;
    mSum += s.marginMean * s.marginN;
    mN += s.marginN;
    tSum += s.traitTermMean * s.marginN;
    dPos += s.driveMeanPositive * s.eligiblePositive;
    dPosN += s.eligiblePositive;
    npd += s.nonPositiveDrive;
    aSum += s.asexualMean * (s.marginN || 0);
    mSum2 += s.mateMean * (s.marginN || 0);
    aZero += s.asexualZeroPct * (s.marginN || 0);
    if (s.marginPercentile(0.5) <= 1 / 64) zero += s.marginN;
  }
  if (!mN) continue;
  console.log(
    `${NAMES[g].padEnd(12)} ${String(reached).padStart(7)} ${(mSum / mN).toFixed(4).padStart(10)} ` +
      `${((zero / mN) * 100).toFixed(1).padStart(6)}% ${(dPosN ? dPos / dPosN : 0).toFixed(4).padStart(9)} ` +
      `${(tSum / mN).toFixed(4).padStart(10)} ${(aSum / mN).toFixed(4).padStart(8)} ${(mSum2 / mN).toFixed(4).padStart(8)} ` +
      `${(aZero / mN).toFixed(1).padStart(5)}% ${(reached ? (npd / reached) * 100 : 0).toFixed(1).padStart(9)}%`,
  );
}

console.log('\nPER-SEED CONSUMER DETAIL');
console.log('seed      reached  meanMargin  p50Margin  p95Margin  ~zero%  drivePos  traitTerm  drive<=0  vsFloor');
for (const r of rows) {
  const s = r.probe.read(TROPHIC.CONSUMER);
  if (!s) continue;
  const ratio = s.driveMeanPositive / founderFloor;
  console.log(
    `${String(r.seed).padStart(6)} ${String(s.reachedRoll).padStart(9)} ${s.marginMean.toFixed(4).padStart(10)} ` +
      `${s.marginPercentile(0.5).toFixed(4).padStart(9)} ${s.marginPercentile(0.95).toFixed(4).padStart(9)} ` +
      `${s.nearZeroMarginPct.toFixed(1).padStart(6)}% ${s.driveMeanPositive.toFixed(4).padStart(9)} ` +
      `${s.traitTermMean.toFixed(4).padStart(10)} ${String(s.nonPositiveDrive).padStart(9)}  ${ratio.toFixed(2)}x`,
  );
}

const cAgg = rows.map((r) => r.probe.read(TROPHIC.CONSUMER)).filter(Boolean);
const reachedTot = cAgg.reduce((a, s) => a + (s?.reachedRoll ?? 0), 0);
const npdTot = cAgg.reduce((a, s) => a + (s?.nonPositiveDrive ?? 0), 0);
const tmTot = cAgg.reduce((a, s) => a + (s?.traitTermMean ?? 0) * (s?.marginN ?? 0), 0);
const mNTot = cAgg.reduce((a, s) => a + (s?.marginN ?? 0), 0);
const traitTerm = mNTot ? tmTot / mNTot : 0;

console.log('\nATTRIBUTION (consumers, pooled)');
console.log(`  mean margin at gate      : ${(cAgg.reduce((a, s) => a + (s?.marginMean ?? 0), 0) / Math.max(1, cAgg.length)).toFixed(4)}`);
console.log(`  implied trait term       : ${traitTerm.toFixed(4)}  (founder value ${(FOUNDER_A * (1 - FOUNDER_M * 0.55) * 2.4).toFixed(4)})`);
console.log(`  drive <= 0 despite gate  : ${npdTot} of ${reachedTot} reached-roll ticks (${reachedTot ? ((npdTot / reachedTot) * 100).toFixed(1) : '0.0'}%)`);
console.log(`  founder trait term ratio : ${(traitTerm / (FOUNDER_A * (1 - FOUNDER_M * 0.55) * 2.4)).toFixed(3)}x`);
const aMeanC = mNTot ? tmTot / mNTot : 0;
const aAll = rows.reduce((acc, r) => { const x = r.probe.read(TROPHIC.CONSUMER); return acc + (x?.asexualMean ?? 0) * (x?.marginN ?? 0); }, 0);
const mAll = rows.reduce((acc, r) => { const x = r.probe.read(TROPHIC.CONSUMER); return acc + (x?.mateMean ?? 0) * (x?.marginN ?? 0); }, 0);
const zAll = rows.reduce((acc, r) => { const x = r.probe.read(TROPHIC.CONSUMER); return acc + (x?.asexualZeroPct ?? 0) * (x?.marginN ?? 0); }, 0);
console.log(`  mean asexualRate at roll : ${(mNTot ? aAll / mNTot : 0).toFixed(4)}  (founder ${FOUNDER_A})`);
console.log(`  mean mateSeeking at roll : ${(mNTot ? mAll / mNTot : 0).toFixed(4)}  (founder ${FOUNDER_M})`);
console.log(`  ticks with A <= 1e-6    : ${(mNTot ? zAll / mNTot : 0).toFixed(1)}%`);
void aMeanC;
console.log(`\nnonPerturbing=${!perturbed}`);
console.log(JSON.stringify({
  consumerMeanMargin: +((cAgg.reduce((a, s) => a + (s?.marginMean ?? 0), 0) / Math.max(1, cAgg.length)).toFixed(5)),
  consumerTraitTerm: +traitTerm.toFixed(5),
  consumerNonPositiveDrivePct: +(reachedTot ? (npdTot / reachedTot) * 100 : 0).toFixed(3),
  consumerDriveMeanPositive: +(cAgg.reduce((a, s) => a + (s?.driveMeanPositive ?? 0), 0) / Math.max(1, cAgg.length)).toFixed(5),
  founderDriveFloor: +founderFloor.toFixed(5),
  probeNonPerturbing: perturbed ? 0 : 1,
}));