/** Authorized exploratory attribution, not a confirmation panel or repair. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { World } from '../build/world/world.js';
import { REACTIONS } from '../build/bio/metabolism.js';
import { POOL_COUNT, POOL_NAMES } from '../build/world/chemistry.js';
import { runIdentity } from '../build/world/version.js';
import { boundaryStateDigest } from './boundary-state-digest.mjs';
import { DescendantReadout } from './rxomit-descendant-readout.mjs';
import { attributeResidual, reactionElementDefects } from './chem-residual-attribution.mjs';

assert.equal(process.argv.length, 4);
assert.equal(process.argv[2], '--out');
const out = process.argv[3];
assert.ok(!existsSync(out), 'refuse existing evidence');
const base = 'evidence/rxomit-rapid-20261016';
const seeds = [41001, 41002, 41003, 41004, 41005, 41006, 41007, 41008, 41009, 41010];
const sourceDigests = {};
for (const file of [...readdirSync('src', { recursive: true }).filter(f => f.endsWith('.ts')).map(f => `src/${f}`),
  'scripts/cho-attribution-trials.mjs', 'scripts/chem-residual-attribution.mjs',
  'scripts/rxomit-descendant-readout.mjs', 'scripts/boundary-state-digest.mjs', 'tsconfig.build.json', 'package-lock.json']) {
  sourceDigests[file] = createHash('sha256').update(readFileSync(file)).digest('hex');
}
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/protocol.json`, JSON.stringify({
  baseSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDigests, runtime: process.version, command: process.argv.slice(1).join(' '),
  seeds, newExploratorySeeds: seeds.slice(2), discoveryReplays: seeds.slice(0, 2), ticks: 1000,
  founders: 400, arms: [null, 'nitrification'], observerTwins: true,
  records: 'All per-tick raw audit, extent/clamp totals, state hashes and demography; full chemistry at first strict failure per element; all reproductive events consumed losslessly into retained actual birth graph and proposal counts.',
  limits: 'No full chemical life histories, no held-out inference, no biology repair; explained defects remain failed strict audits.',
  reactionDefects: reactionElementDefects(), pools: [...POOL_NAMES, 'H2O'],
}, null, 2));
const results = [];
for (const seed of seeds) for (const omission of [null, 'nitrification']) {
  const name = `${omission ?? 'control'}-${seed}`;
  const config = { ...JSON.parse(readFileSync(`${base}/control-41001-config.json`)), seed, chemistryReactionOmit: omission };
  const plain = new World({ config });
  const observed = new World({ config, chemBoundary: { capacity: 8192 } });
  writeFileSync(`${out}/${name}-config.json`, JSON.stringify(observed.config, null, 2));
  const descendants = new DescendantReadout(), firstFailures = {}, witnesses = [], ticks = [];
  const uptake = Array(7).fill(0); let cChem = 0, cRepro = 0;
  assert.equal(boundaryStateDigest(plain), boundaryStateDigest(observed));
  for (let tick = 1; tick <= 1000; tick++) {
    plain.step(); observed.step();
    assert.equal(plain.hashState(), observed.hashState(), `${name}/${tick} observer hash`);
    if ([17, 34, 120, 600, 1000].includes(tick)) assert.equal(boundaryStateDigest(plain), boundaryStateDigest(observed));
    const chemistry = observed.chemistryBoundaryTrace('chemistry', cChem);
    const repro = observed.chemistryBoundaryTrace('reproduction', cRepro);
    assert.equal(chemistry.unreadLost, 0); assert.equal(repro.unreadLost, 0);
    cChem = chemistry.counts.chemistry; cRepro = repro.counts.reproduction;
    chemistry.events.forEach(e => e.uptake.forEach((n, i) => { uptake[i] += n; }));
    repro.events.forEach(e => descendants.observe(e));
    const audit = structuredClone(observed.chemAudit);
    const extents = Array.from(observed.chemEvidence.extent);
    const clamps = Array.from(observed.chemistry.clampedCumulative);
    const attribution = attributeResidual(extents, clamps, audit.residual.map(e => e.residual));
    for (const e of audit.residual) if (!e.ok && firstFailures[e.element] === undefined) {
      firstFailures[e.element] = tick;
      witnesses.push({ element: e.element, tick, chemistry: chemistry.events,
        audit, extents, clamps, attribution });
    }
    ticks.push({ tick, audit, extents, clamps, attribution, hash: observed.hashState(),
      population: observed.store.population, births: observed.totalBirths, deaths: observed.totalDeaths });
  }
  const result = { seed, omission, identity: runIdentity(config), population: observed.store.population,
    births: observed.totalBirths, deaths: observed.totalDeaths, hash: observed.hashState(), firstFailures,
    uptake, extents: Array.from(observed.chemEvidence.extent), clamps: Array.from(observed.chemistry.clampedCumulative),
    audit: observed.chemAudit, attribution: ticks.at(-1).attribution,
    descendants: descendants.finish(observed.totalBirths), observerExact: true, unreadLost: 0 };
  assert.equal(result.descendants.status, 'COMPLETE');
  if (omission) assert.equal(result.extents[REACTIONS.findIndex(r => r.name === omission)], 0);
  if (seed <= 41002) {
    const old = JSON.parse(readFileSync(`${base}/${name}-result.json`));
    assert.equal(result.hash, old.finalHash); assert.equal(result.births, old.births);
  }
  assert.equal(POOL_COUNT, 25);
  writeFileSync(`${out}/${name}-ticks.jsonl`, ticks.map(r => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(`${out}/${name}-witnesses.json`, JSON.stringify(witnesses));
  writeFileSync(`${out}/${name}-result.json`, JSON.stringify(result, null, 2));
  results.push(result);
  console.log(`${name}: pop=${result.population} births=${result.births} failures=${JSON.stringify(firstFailures)} exact observer`);
}
writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
writeFileSync(`${out}/complete.json`, JSON.stringify({ uniqueRuns: 20, newPairs: 8, discoveryPairs: 2, fullHorizonExecutions: 40, observerExact: true }));
