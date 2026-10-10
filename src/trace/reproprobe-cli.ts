/**
 * Criterion-2 measurement for case 9b5ff0df + a non-perturbation proof.
 *
 * CRITERION 2
 * "Measure the fraction of gate-eligible consumer ticks lost to the stochastic
 * breeding roll (drive probability) rather than to ineligibility."
 *
 * This is the one criterion of the case that was never measured, and the
 * controlled threshold sweep made it the leading candidate explanation: raising
 * the fraction gate's eligibility by +49.9/+19.6/+32.6 points raised the consumer
 * birth/death ratio from 0.633 to 0.771 but never above 1.0. The extra
 * eligibility passed the deterministic gates and then failed to become births.
 * The only gate downstream of eligibility is
 * `if (!this.rng.chance(Math.min(0.9, drive))) continue`, which leaves no trace.
 *
 * NON-PERTURBATION
 * Every run is executed TWICE — once with the probe attached and once without —
 * and a full observable-state digest is compared. If the probe changed any
 * simulation outcome the digests would diverge, and this tool reports that as a
 * FAIL rather than printing numbers that would then be untrustworthy.
 *
 * Run: tsx src/trace/reproprobe.ts [ticks] [seeds...]
 */
import { World } from '../world/world.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { ReproProbeLog, REPRO_GATE_NAMES } from './reproprobe.js';

const TICKS = Number(process.argv[2] ?? 2400);
// Seeds may be given as one comma-separated arg or several.
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(24601, 777, 1234);
// Optional founder reproThreshold override, for the drive-vs-threshold sweep.
const THRESH = process.argv.includes('--threshold')
  ? Number(process.argv[process.argv.indexOf('--threshold') + 1])
  : null;

interface Row {
  seed: number;
  digestOff: string;
  digestOn: string;
  perturbs: boolean;
  perGuild: ReturnType<ReproProbeLog['read']>[];
  consAliveEnd: boolean;
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
  const digestOff = wOff.hashState();

  const wOn = mk(probe);
  for (let t = 0; t < TICKS; t++) wOn.step();
  const digestOn = wOn.hashState();

  rows.push({
    seed,
    digestOff,
    digestOn,
    perturbs: digestOff !== digestOn,
    perGuild: Array.from({ length: TROPHIC_COUNT }, (_, g) => probe.read(g)),
    consAliveEnd: (() => {
      const s = wOn.store;
      for (let sl = 0; sl < s.count; sl++) {
        if (wOn.aliveAt(sl) && wOn.roleOf(sl).trophic === TROPHIC.CONSUMER) return true;
      }
      return false;
    })(),
  });
}

const P = (guild: number): string => {
  const names = ['PRODUCER', 'CONSUMER', 'DECOMPOSER'];
  return names[guild];
};

console.log(
  `REPRODUCTION-GATE PROBE — ${TICKS} ticks, seeds ${SEEDS.join('/')}` +
    (THRESH === null ? '' : `, founder reproThreshold ${THRESH}`),
);
console.log('\nNON-PERTURBATION (engine hashState(), probe off vs on)');
console.log('seed        digestOFF  digestON   verdict');
for (const r of rows) {
  console.log(
    `${String(r.seed).padStart(6)}  ${r.digestOff.padStart(10)}  ${r.digestOn.padStart(9)}   ` +
      (r.perturbs ? 'DIVERGED (BAD)' : 'identical'),
  );
}
const anyPerturb = rows.some((r) => r.perturbs);
console.log(
  anyPerturb
    ? '\n*** PROBE PERTURBS THE SIMULATION — results below are NOT trustworthy. ***'
    : '\nAll hashState() digests identical: the probe is observationally inert.\n' +
      'hashState() covers RNG words, positions/heading, substrate, ledger, heritable\n' +
      'genome, lineage, hunger and demographics, so this is the authoritative check.\n' +
      'It remains a SAMPLE (3 seeds x 2400 ticks); what generalises is the per-call-site\n' +
      'argument that no RNG draw or state write is reachable from a probe callback.',
);

console.log('\nCONSUMER REPRODUCTION GATES (criterion 2)');
console.log('seed     cooldown  fraction  maturity  damage  surplus  sexual | reached  elig+  fired   LOST  drivePos  expBirths    p50    p95');
for (const r of rows) {
  const c = r.perGuild[TROPHIC.CONSUMER];
  if (!c) continue;
  const b = c.blocked;
  console.log(
    `${String(r.seed).padStart(6)} ${b.map((x) => String(x).padStart(9)).join('  ')} | ` +
      `${String(c.reachedRoll).padStart(7)} ${String(c.eligiblePositive).padStart(6)} ${String(c.fired).padStart(6)} ` +
      `${String(c.lostToRoll).padStart(6)}  ${c.driveMeanPositive.toFixed(4).padStart(9)} ${c.expectedBirths.toFixed(1).padStart(7)} ` +
      `${c.drivePercentile(0.5).toFixed(3).padStart(6)} ${c.drivePercentile(0.95).toFixed(3).padStart(6)}`,
  );
}

console.log('\nPER-GUILD COMPARISON (pooled across seeds)');
console.log('guild        reached  elig+   fired  LOST%   drivePos  driveMax   expBirths  obsBirths');
for (let g = 0; g < TROPHIC_COUNT; g++) {
  let reached = 0, elig = 0, fired = 0, lost = 0, expBirths = 0, dMax = 0;
  for (const r of rows) {
    const s = r.perGuild[g];
    if (!s) continue;
    reached += s.reachedRoll; elig += s.eligiblePositive; fired += s.fired;
    lost += s.lostToRoll; expBirths += s.expectedBirths; dMax = Math.max(dMax, s.driveMax);
  }
  console.log(
    `${P(g).padEnd(12)} ${String(reached).padStart(7)} ${String(elig).padStart(6)} ${String(fired).padStart(6)} ` +
      `${(elig ? ((lost / elig) * 100).toFixed(1) : '0.0').padStart(6)}%  ${(elig ? expBirths / elig : 0).toFixed(4).padStart(9)} ${dMax.toFixed(3).padStart(9)} ${expBirths.toFixed(1).padStart(9)} ${String(fired).padStart(9)}`,
  );
}

const cPool = rows.map((r) => r.perGuild[TROPHIC.CONSUMER]).filter(Boolean);
const eligTot = cPool.reduce((a, s) => a + (s?.eligiblePositive ?? 0), 0);
const lostTot = cPool.reduce((a, s) => a + (s?.lostToRoll ?? 0), 0);
console.log('\nCRITERION 2 ANSWER (consumers, pooled)');
console.log(`  gate-eligible consumer ticks : ${eligTot}`);
console.log(`  lost to the stochastic roll  : ${lostTot} (${eligTot ? ((lostTot / eligTot) * 100).toFixed(1) : '0.0'}%)`);
console.log(`\nseeds=${SEEDS.length} ticks=${TICKS} gates=[${REPRO_GATE_NAMES.join(',')}]`);
console.log(`NON_PERTURBING=${!anyPerturb}`);

// Machine-readable final line. The scientific MCP's statistical contracts parse
// the LAST stdout line as JSON and read `result[metricName]`, so every metric a
// verification contract can reference must appear here as a number.
//
// Metric names are camelCase by schema. Definitions:
//   consumerRollLossPct        - fraction of gate-eligible CONSUMER ticks lost to
//                                the stochastic roll. Criterion 2.
//   consumerGateEligibleTicks  - denominator for the above.
//   consumerReachedRollTicks   - consumer ticks clearing every deterministic gate.
//   consumerBirthsFromRoll     - consumer ticks where the roll fired.
//   consumerExpectedBirths     - sum(max(0, drive)) over eligible ticks.
//   producerRollLossPct        - same loss rate for producers, for comparison.
//   secondaryGateBlocks        - total ticks blocked by cooldown/maturity/damage/
//                                surplus across all guilds. Criterion 3.
//   probeNonPerturbing         - 1 if every hashState() matched probe-off.
//   consumerMedianDrive        - median drive over reached-roll consumer ticks.
{
  const cPoolFinal = rows.map((r) => r.perGuild[TROPHIC.CONSUMER]).filter(Boolean);
  const pPoolFinal = rows.map((r) => r.perGuild[TROPHIC.PRODUCER]).filter(Boolean);
  const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
  const elig = sum(cPoolFinal.map((x) => x?.eligiblePositive ?? 0));
  const lost = sum(cPoolFinal.map((x) => x?.lostToRoll ?? 0));
  const pElig = sum(pPoolFinal.map((x) => x?.eligiblePositive ?? 0));
  const pLost = sum(pPoolFinal.map((x) => x?.lostToRoll ?? 0));
  const secBlocks = sum(
    rows.flatMap((r) => r.perGuild.map((x) => sum((x?.blocked ?? []).slice(0, 4)))),
  );
  console.log(
    JSON.stringify({
      consumerRollLossPct: elig ? +((lost / elig) * 100).toFixed(4) : -1,
      consumerGateEligibleTicks: elig,
      consumerReachedRollTicks: sum(cPoolFinal.map((x) => x?.reachedRoll ?? 0)),
      consumerBirthsFromRoll: sum(cPoolFinal.map((x) => x?.fired ?? 0)),
      consumerExpectedBirths: +sum(cPoolFinal.map((x) => x?.expectedBirths ?? 0)).toFixed(4),
      producerRollLossPct: pElig ? +((pLost / pElig) * 100).toFixed(4) : -1,
      secondaryGateBlocks: secBlocks,
      probeNonPerturbing: anyPerturb ? 0 : 1,
      consumerMedianDrive: cPoolFinal.length ? cPoolFinal[0]!.drivePercentile(0.5) : -1,
    }),
  );
}