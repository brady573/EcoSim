/** Approved rapid isolated contrasts; no combined arms or permanent physiology. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, createWriteStream, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { World } from '../build/world/world.js';
import { REACTIONS } from '../build/bio/metabolism.js';
import { POOL_NAMES } from '../build/world/chemistry.js';
import { ELEMENT_NAMES } from '../build/bio/elements.js';
import { runIdentity } from '../build/world/version.js';
import { reactionOmissionCases } from '../build/reaction-omission-checks.js';
import { boundaryStateDigest } from './boundary-state-digest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node scripts/reaction-omission-trials.mjs --out NEW_DIRECTORY');
assert.equal(args[0], '--out');
const out = resolve(args[1]);
assert.ok(!existsSync(out), 'Refusing existing output');
const source = join(root, 'evidence/chem078-final-20261015');
assert.ok(!out.startsWith(source + '/'), 'Do not write inside baseline evidence');
const baseProtocol = JSON.parse(readFileSync(join(source, 'protocol.json'), 'utf8'));
assert.equal(runIdentity(true), baseProtocol.identity);
const oldRuns = readFileSync(join(source, 'runs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const arms = [null, 'nitrification', 'iron oxidation', 'iron uptake'];
const cadence = new Set([1, 32, 120, 300, 600, baseProtocol.ticks]);
const fixtures = reactionOmissionCases(); // Discriminating controls before live arms.
const digests = {};
for (const rel of [...readdirSync(join(root, 'src'), { recursive: true }).filter((f) => f.endsWith('.ts')).map((f) => `src/${f}`),
  'scripts/reaction-omission-trials.mjs', 'scripts/boundary-state-digest.mjs', 'tsconfig.build.json', 'package-lock.json']) {
  digests[rel] = createHash('sha256').update(readFileSync(join(root, rel))).digest('hex');
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'one-cell.json'), JSON.stringify(fixtures, null, 2));
writeFileSync(join(out, 'protocol.json'), JSON.stringify({
  approvalReview: 5540863270, preregistrationSource: '939575c:D3D4-SELECTIVE-PREREGISTRATION.md',
  baseSourceSHA: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDigests: digests, runtime: process.version, seeds: baseProtocol.seeds,
  ticks: baseProtocol.ticks, founders: baseProtocol.founders, arms,
  command: `node scripts/reaction-omission-trials.mjs --out ${args[1]}`,
  sampledChemicalTicks: [...cadence], reactions: REACTIONS.map((r) => r.name),
  pools: POOL_NAMES, elements: ELEMENT_NAMES, capacityPerKind: 8192,
  repeatedExecutions: 'Each arm is executed untraced and traced; state hashes match every tick, broad digests at fixed checkpoints.',
  firstDivergence: 'Extra null-selector reference until divergence. Pre-state broad digest ignores ONLY the two selector representations (config.chemistryReactionOmit and chemCfg.reactionOmit), plus standard diagnostic/timing exclusions.',
  records: 'All reached reproduction decisions retained. Chemistry events consumed losslessly for cumulative measurements; raw events retained only at declared ticks and first divergence. No full chemical life-history claim.',
  limits: 'Omission removes matter AND associated energy income. Same seeds do not hold later RNG trajectories fixed. No ecological success threshold or permanent physiology.',
}, null, 2));
const summary = [];
const finite = (value) => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), 'non-finite measurement');
  else if (value && typeof value === 'object') for (const v of Object.values(value)) finite(v);
};
for (const seed of baseProtocol.seeds) {
  let baselineInitial;
  for (const omission of arms) {
    const config = { ...JSON.parse(readFileSync(join(source, `advanced-${seed}-config.json`), 'utf8')), chemistryReactionOmit: omission };
    const identity = runIdentity(config);
    const name = omission === null ? 'control' : omission.replaceAll(' ', '-');
    const plain = new World({ config });
    const observed = new World({ config, chemBoundary: { capacity: 8192 } });
    let reference = omission === null ? null : new World({ config: { ...config, chemistryReactionOmit: null }, chemBoundary: { capacity: 8192 } });
    baselineInitial ??= plain.hashState();
    assert.equal(plain.hashState(), baselineInitial, 'only selector changes, no founder/RNG manipulation');
    assert.equal(observed.config.chemistryReactionOmit, omission);
    writeFileSync(join(out, `${name}-${seed}-config.json`), JSON.stringify(observed.config, null, 2));
    const gzip = createGzip();
    const flushed = pipeline(gzip, createWriteStream(join(out, `${name}-${seed}-events.jsonl.gz`), { flags: 'wx' }));
    flushed.catch(() => {});
    const write = async (r) => {
      finite(r);
      if (!gzip.write(JSON.stringify(r) + '\n')) await Promise.race([once(gzip, 'drain'), flushed.then(() => { throw new Error('stream ended early'); })]);
    };
    const consumed = { chemistry: 0, reproduction: 0 };
    let refConsumed = 0;
    const extents = REACTIONS.map(() => 0);
    const uptake = Array(7).fill(0);
    const gross = REACTIONS.map(() => Array(POOL_NAMES.length).fill(0));
    const gateCounts = {};
    let firstDivergence = null;
    const trajectory = [];
    for (let tick = 1; tick <= baseProtocol.ticks; tick++) {
      let before;
      if (reference !== null) {
        assert.equal(plain.hashState(), reference.hashState());
        const projected = boundaryStateDigest(plain, ['chemistryReactionOmit', 'reactionOmit']);
        assert.equal(projected, boundaryStateDigest(reference, ['chemistryReactionOmit', 'reactionOmit']));
        before = { hash: plain.hashState(), projectedBroad: projected };
      }
      plain.step(); observed.step(); reference?.step();
      assert.equal(plain.hashState(), observed.hashState(), `observer parity ${name}/${seed}/${tick}`);
      const chemistry = observed.chemistryBoundaryTrace('chemistry', consumed.chemistry);
      const reproduction = observed.chemistryBoundaryTrace('reproduction', consumed.reproduction);
      for (const [kind, log] of [['chemistry', chemistry], ['reproduction', reproduction]]) {
        assert.equal(log.unreadLost, 0, `unread ${kind} lost`);
        consumed[kind] = log.counts[kind];
      }
      for (const e of chemistry.events) {
        for (let i = 0; i < 7; i++) uptake[i] += e.uptake[i];
        for (let r = 0; r < REACTIONS.length; r++) {
          extents[r] += e.reactionExtents[r];
          for (let p = 0; p < POOL_NAMES.length; p++) gross[r][p] += e.reactionGross[r][p];
        }
      }
      for (const e of reproduction.events) {
        const key = `${e.stage}/${e.outcome}/${e.pathway ?? 'proposal'}`;
        gateCounts[key] = (gateCounts[key] ?? 0) + 1;
      }
      await write({ kind: 'reproduction', tick, events: reproduction.events });
      if (reference !== null) {
        const refLog = reference.chemistryBoundaryTrace('chemistry', refConsumed);
        assert.equal(refLog.unreadLost, 0); refConsumed = refLog.counts.chemistry;
        if (reference.hashState() !== plain.hashState()) {
          firstDivergence = { tick, before, controlAfter: reference.hashState(), omittedAfter: plain.hashState() };
          await write({ kind: 'firstDivergence', ...firstDivergence, controlChemistry: refLog.events, omittedChemistry: chemistry.events });
          reference = null;
        }
      }
      if (cadence.has(tick)) {
        assert.equal(boundaryStateDigest(plain), boundaryStateDigest(observed));
        await write({ kind: 'chemistrySample', tick, events: chemistry.events });
        trajectory.push({ tick, population: observed.store.population, births: observed.totalBirths,
          deaths: observed.totalDeaths, carbonBuilt: observed.chemistry.flux.chemCarbonBuilt,
          chemicalIncome: observed.chemistry.flux.chemEnergyIncome, hash: observed.hashState() });
      }
    }
    if (omission === null) {
      const prior = oldRuns.find((r) => r.seed === seed && r.arm === 'advanced');
      assert.equal(observed.hashState(), prior.finalHash, 'null selector restores qualified baseline exactly');
    } else assert.equal(extents[REACTIONS.findIndex((r) => r.name === omission)], 0, 'live omission must reach the engine');
    const record = { seed, omission, identity, tick: observed.tick, population: observed.store.population,
      births: observed.totalBirths, deaths: observed.totalDeaths, finalHash: observed.hashState(),
      consumed, extents, gross, uptake, gateCounts, firstDivergence, trajectory,
      chemicalIncome: observed.chemistry.flux.chemEnergyIncome,
      growthSpent: observed.chemistry.flux.chemEnergySpent,
      carbonBuilt: observed.chemistry.flux.chemCarbonBuilt,
      elementalResiduals: observed.chemAudit.residual, energyResidual: observed.accountingResidualFraction() };
    finite(record);
    gzip.end(); await flushed;
    writeFileSync(join(out, `${name}-${seed}-result.json`), JSON.stringify(record, null, 2));
    summary.push(record);
    console.log(`${name}/${seed}: tick=${observed.tick} pop=${record.population} births=${record.births}; observer exact`);
  }
}
assert.equal(summary.length, 8);
const reachability = [];
for (const seed of baseProtocol.seeds) for (const target of arms.slice(1)) {
  const baseline = summary.find((r) => r.seed === seed && r.omission === null);
  const id = REACTIONS.findIndex((r) => r.name === target);
  reachability.push({ seed, target, controlExtent: baseline.extents[id],
    status: baseline.extents[id] > 0 ? 'measured' : 'vacuous: target absent, no effect interpretation' });
}
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(out, 'reachability.json'), JSON.stringify(reachability, null, 2));
writeFileSync(join(out, 'complete.json'), JSON.stringify({ uniqueRuns: 8, executions: 16, observerParity: true, unreadLoss: 0, nullControlsMatched: 2 }));
