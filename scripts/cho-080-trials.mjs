/**
 * chem/0.8.0 correction tranche — preregistered matched pairs (null vs
 * single-reaction omission), unchanged 400 founders / 1000 ticks.
 *
 * Selection is frozen BEFORE outcomes: the two recorded discovery seeds
 * (41001, 41002) as old-vs-new replays, plus the first two of the registered
 * exploratory pool (41003, 41004). Discovery replays cannot reproduce their
 * 0.7.8 hashes — the engine's declared chemistry semantics changed by design —
 * so the equality check of the old runner is replaced by a recorded CONTRAST
 * (old hash/births/first-failures next to the new ones). An unchanged hash
 * would falsify the claim that the correction moved the model, so it fails
 * loudly here.
 *
 * The panel measures; it decides nothing. A falsified prediction is a result
 * and is reported as one.
 *
 * Run: node scripts/cho-080-trials.mjs --out evidence/<dir>
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { World } from '../build/world/world.js';
import { REACTIONS } from '../build/bio/metabolism.js';
import { POOL_COUNT, POOL_NAMES, POOL_COMPOSITION } from '../build/world/chemistry.js';
import { runIdentity } from '../build/world/version.js';
import { boundaryStateDigest } from './boundary-state-digest.mjs';
import { DescendantReadout, validateTrialDemographics } from './rxomit-descendant-readout.mjs';
import { attributeResidual, reactionElementDefects } from './chem-residual-attribution.mjs';
import { choContractCases } from './cho-attribution-checks.mjs';

assert.equal(process.argv.length, 4);
assert.equal(process.argv[2], '--out');
const out = process.argv[3];
assert.ok(!existsSync(out), 'refuse existing evidence');
const prior = 'evidence/cho-attribution-20261017';
const seeds = [41001, 41002, 41003, 41004];
const discoveryReplays = [41001, 41002];
const ticks = 1000;
const sourceDigests = {};
for (const file of [...readdirSync('src', { recursive: true }).filter(f => f.endsWith('.ts')).map(f => `src/${f}`),
  'scripts/cho-080-trials.mjs', 'scripts/chem-residual-attribution.mjs', 'scripts/cho-attribution-checks.mjs',
  'scripts/rxomit-descendant-readout.mjs', 'scripts/boundary-state-digest.mjs', 'tsconfig.build.json', 'package-lock.json']) {
  sourceDigests[file] = createHash('sha256').update(readFileSync(file)).digest('hex');
}
const defects = reactionElementDefects();
const worstDefect = Math.max(...defects.flatMap(rx => rx.vector.map(Math.abs)));
assert.ok(worstDefect < 1e-9, 'the contract must close every reaction before a panel is measured through it');
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/protocol.json`, JSON.stringify({
  tranche: 'chem/0.8.0 multielement C/H/O contract',
  baseSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDigests, runtime: process.version, command: process.argv.slice(1).join(' '),
  seeds, discoveryReplays, newExploratorySeeds: seeds.slice(2), ticks,
  founders: 400, arms: [null, 'nitrification'], observerTwins: true,
  preregistration: 'Selection frozen before outcomes: discovery seeds 41001/41002 replay against the recorded '
    + '0.7.8 panel as a CONTRAST (hashes must differ; an unchanged model fails); 41003/41004 are the first two of '
    + 'the registered exploratory pool. Prediction: all seven elements close through all 1000 ticks in both arms '
    + 'and every seed (empty firstFailures), and the omission arm remains distinguishable in demography. '
    + 'Falsification: any non-empty firstFailures grid entry, or a discovery hash equal to the recorded one.',
  records: 'All per-tick raw audit, extent/clamp totals, state hashes and demography; full chemistry at first strict '
    + 'failure per element; all reproductive events consumed losslessly into the retained actual birth graph.',
  limits: 'Exploratory; no held-out inference, no biology repair, no merge authority. Old panels are immutable '
    + 'provenance and were not retroactively certified.',
  reactionDefects: defects, pools: [...POOL_NAMES, 'H2O'],
  poolComposition: Array.from(POOL_COMPOSITION),
}, null, 2));
writeFileSync(`${out}/one-cell-controls.json`, JSON.stringify(choContractCases(), null, 2));
const results = [];
for (const seed of seeds) for (const omission of [null, 'nitrification']) {
  const name = `${omission ?? 'control'}-${seed}`;
  const config = { ...JSON.parse(readFileSync(`${prior}/control-41001-config.json`)), seed, chemistryReactionOmit: omission };
  assert.equal(config.founders, 400, 'the frozen config must still start 400 founders');
  assert.equal(runIdentity(config), `ts-evo-poc/0.8.0+chem/0.8.0${omission ? `+rxomit/1/${omission}` : ''}`);
  const plain = new World({ config });
  const observed = new World({ config, chemBoundary: { capacity: 8192 } });
  writeFileSync(`${out}/${name}-config.json`, JSON.stringify(observed.config, null, 2));
  const descendants = new DescendantReadout(), firstFailures = {}, witnesses = [], rows = [];
  const uptake = Array(7).fill(0); let cChem = 0, cRepro = 0;
  assert.equal(boundaryStateDigest(plain), boundaryStateDigest(observed));
  for (let tick = 1; tick <= ticks; tick++) {
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
    rows.push({ tick, audit, extents, clamps, attribution, hash: observed.hashState(),
      population: observed.store.population, births: observed.totalBirths, deaths: observed.totalDeaths });
  }
  const result = { seed, omission, identity: runIdentity(config), population: observed.store.population,
    births: observed.totalBirths, deaths: observed.totalDeaths, hash: observed.hashState(), firstFailures,
    uptake, extents: Array.from(observed.chemEvidence.extent), clamps: Array.from(observed.chemistry.clampedCumulative),
    audit: observed.chemAudit, attribution: rows.at(-1).attribution,
    descendants: descendants.finish(observed.totalBirths), observerExact: true, unreadLost: 0 };
  validateTrialDemographics(result, 400);
  assert.equal(result.descendants.status, 'COMPLETE');
  if (omission) assert.equal(result.extents[REACTIONS.findIndex(r => r.name === omission)], 0);
  assert.equal(POOL_COUNT, 25);
  writeFileSync(`${out}/${name}-ticks.jsonl`, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(`${out}/${name}-witnesses.json`, JSON.stringify(witnesses));
  writeFileSync(`${out}/${name}-result.json`, JSON.stringify(result, null, 2));
  results.push(result);
  console.log(`${name}: pop=${result.population} births=${result.births} failures=${JSON.stringify(firstFailures)} exact observer`);
}
// Old-vs-new contrast: the two discovery seeds were measured under chem/0.7.8.
// Equality of the hashes would mean the correction never reached the model.
const contrast = results.filter(r => discoveryReplays.includes(r.seed)).map(r => {
  const name = `${r.omission ?? 'control'}-${r.seed}`;
  const old = JSON.parse(readFileSync(`${prior}/${name}-result.json`));
  assert.notEqual(r.hash, old.finalHash,
    `discovery replay ${name} is byte-identical to the 0.7.8 panel: the correction did not move this model`);
  return { name, oldIdentity: 'ts-evo-poc/0.8.0+chem/0.7.8', newIdentity: r.identity,
    oldHash: old.finalHash, newHash: r.hash, hashChanged: true,
    oldPopulation: old.population, newPopulation: r.population,
    oldBirths: old.births, newBirths: r.births,
    oldFirstFailures: old.firstFailures, newFirstFailures: r.firstFailures };
});
writeFileSync(`${out}/old-new-contrast.json`, JSON.stringify(contrast, null, 2));
writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
writeFileSync(`${out}/complete.json`, JSON.stringify({ uniqueRuns: results.length,
  discoveryPairs: discoveryReplays.length, newPairs: seeds.length - discoveryReplays.length,
  fullHorizonExecutions: results.length * 2, observerExact: true }));
// A completed panel holds every file the summary claims; a partial panel is not
// evidence. (This is an archive assertion, not a verdict.)
for (const r of results) {
  const name = `${r.omission ?? 'control'}-${r.seed}`;
  for (const suffix of ['ticks.jsonl', 'witnesses.json', 'result.json', 'config.json']) {
    assert.ok(existsSync(`${out}/${name}-${suffix}`), `missing ${name}-${suffix}`);
  }
}
console.log(`panel complete: ${results.length} runs, ${seeds.length * 2 * 2} full-horizon executions`);
