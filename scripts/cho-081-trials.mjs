/**
 * chem/0.8.1 correction — preregistered nitrification-isolation replay.
 *
 * The Owner review of PR #14 at 066d55b (2026-10-18) found ONE material
 * mechanism departure: chem/0.8.0 kept nitrification alive with its oxygen
 * reduced to a presence gate while the reaction still earned energy and
 * converted NH4 -> NO3 — an oxygen-consuming pathway consuming no booked
 * oxidant. Under POOL_COMPOSITION the pathway cannot be balanced (NH4 and NO3
 * are single-element nitrogen carriers; the balancing alternatives break
 * denitrification or manufacture H in sediment release), so the accepted
 * fallback was taken: the pathway is ISOLATED as unsupported/disabled — out
 * of the live network, preserved in ISOLATED_REACTIONS — and its retained
 * omission selector is a declared no-op whose control/omission contrast is
 * VACUOUS.
 *
 * Selection is frozen BEFORE outcomes: the two recorded discovery seeds
 * (41001, 41002), the same 400 founders / 1000 ticks / observer-twin
 * machinery as the chem/0.8.0 panel, arms null versus the retained
 * `+rxomit/1/nitrification` selector. All predictions are mechanical
 * invariants of the correction and are stated in protocol.json; a falsified
 * prediction is a result and is reported as one.
 *
 * Run: node scripts/cho-081-trials.mjs --out evidence/<dir>
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { World } from '../build/world/world.js';
import { ISOLATED_REACTIONS, REACTIONS, RX_COUNT } from '../build/bio/metabolism.js';
// CAP is a compile-time const enum with no runtime export: its bit values must
// be written out. NITRIFY = 1 << 3; N_ASSIM = 1 << 9.
const CAP_NITRIFY = 1 << 3;
import { Chemistry, DEFAULT_CHEMISTRY, POOL_RT as POOL, POOL_COMPOSITION, POOL_COUNT, POOL_NAMES } from '../build/world/chemistry.js';
import { DEFAULT_CHEM_CONFIG, newChemStores, runMetabolism } from '../build/bio/chemlife.js';
import { runIdentity } from '../build/world/version.js';
import { boundaryStateDigest } from './boundary-state-digest.mjs';
import { DescendantReadout, validateTrialDemographics } from './rxomit-descendant-readout.mjs';
import { attributeResidual, reactionElementDefects } from './chem-residual-attribution.mjs';
import { choContractCases } from './cho-attribution-checks.mjs';

assert.equal(process.argv.length, 4);
assert.equal(process.argv[2], '--out');
const out = process.argv[3];
assert.ok(!existsSync(out), 'refuse existing evidence');
const prior080 = 'evidence/cho-080-20261018';
const seeds = [41001, 41002];
const ticks = 1000;
const identity = 'ts-evo-poc/0.8.0+chem/0.8.1';

// The correction must hold BEFORE the replay is measured: the pathway is not
// live, it is declared exactly once, and the declaration preserves the removed
// pathway (energy and oxygen requirement included).
assert.ok(!REACTIONS.some(r => r.name === 'nitrification'), 'the isolated pathway must not be live');
const isolated = ISOLATED_REACTIONS.filter(r => r.name === 'nitrification');
assert.equal(isolated.length, 1, 'the isolated pathway must remain declared exactly once');
assert.ok(ISOLATED_REACTIONS.every(d => REACTIONS.every(r => r.name !== d.name)), 'no overlap with the live network');
assert.ok(isolated[0].energy > 0 && isolated[0].minO2 > 0, 'the declaration preserves the pathway it removed');
assert.equal(POOL_COUNT, 25);
assert.equal(POOL_NAMES.length, POOL_COUNT); // F1: names are the safe loop bound
assert.equal(runIdentity({ chemistry: true, chemistryReactionOmit: null }), identity);

const sourceDigests = {};
for (const file of [...readdirSync('src', { recursive: true }).filter(f => f.endsWith('.ts')).map(f => `src/${f}`),
  'scripts/cho-081-trials.mjs', 'scripts/chem-residual-attribution.mjs', 'scripts/cho-attribution-checks.mjs',
  'scripts/rxomit-descendant-readout.mjs', 'scripts/boundary-state-digest.mjs', 'tsconfig.build.json', 'package-lock.json']) {
  sourceDigests[file] = createHash('sha256').update(readFileSync(file)).digest('hex');
}
const defects = reactionElementDefects();
const worstDefect = Math.max(...defects.flatMap(rx => rx.vector.map(Math.abs)));
assert.ok(worstDefect < 1e-9, 'the contract must close every live reaction before a replay is measured through it');
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/protocol.json`, JSON.stringify({
  tranche: 'chem/0.8.1 nitrification isolation correction',
  baseSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDigests, runtime: process.version, command: process.argv.slice(1).join(' '),
  seeds, ticks, founders: 400, arms: [null, 'nitrification'], observerTwins: true,
  preregistration: 'Selection frozen before outcomes: the recorded discovery seeds 41001/41002, 400 founders, '
    + '1000 ticks, arms null versus the retained +rxomit/1/nitrification selector. Predictions (all mechanical '
    + 'invariants of the isolation): (1) the live network contains no nitrification and no run books a '
    + 'nitrification extent or income; (2) the two arms are identical in every recorded field at every tick — the '
    + 'control/omission contrast is VACUOUS by construction; (3) the corrected null arm reproduces the recorded '
    + 'chem/0.8.0 OMISSION arm state-for-state at every tick (that arm is this network with the pathway '
    + 'suppressed), so nothing else moved; (4) the corrected null arm diverges from the recorded chem/0.8.0 '
    + 'CONTROL arm, which ran the gated pathway — the isolation is operative; (5) no strict-audit first failures '
    + 'in any run at 1000 ticks. Falsification: any nitrification extent, any arm difference, any '
    + 'non-reproduction of the recorded omission hashes, any equality with the recorded control hashes, or a '
    + 'non-empty firstFailures grid.',
  records: 'All per-tick raw audit, extent/clamp totals, state hashes and demography; full chemistry at first '
    + 'strict failure per element; all reproductive events consumed losslessly into the retained actual birth graph.',
  limits: 'Exploratory; two seeds; no ecological verdict, no held-out inference, no merge authority. The recorded '
    + 'chem/0.8.0 panel is immutable provenance and is not relabelled; its demographic contrast is reinterpreted '
    + 'as VACUOUS under this isolation (CHO-081-RESULTS.md).',
  reactionDefects: defects, isolated: ISOLATED_REACTIONS.map(r => ({ ...r })),
  pools: POOL_NAMES, poolComposition: Array.from(POOL_COMPOSITION),
}, null, 2));
writeFileSync(`${out}/one-cell-controls.json`, JSON.stringify(choContractCases(), null, 2));

// Isolation witness: a NITRIFY-capable organism in NH4-rich, oxic water books
// nothing, and the retained selector changes nothing in that cell either.
{
  const cell = (omission) => {
    const chem = new Chemistry(1, 1, 1, { ...DEFAULT_CHEMISTRY });
    chem.fields[POOL.NH4].data[0] = 0.004;
    chem.fields[POOL.O2].data[0] = 1;
    const st = newChemStores(1);
    st.capMask[0] = CAP_NITRIFY; st.capStrength.fill(1); st.light[0] = 1;
    const o = new Float64Array(POOL_COUNT);
    const extent = new Float64Array(RX_COUNT);
    const income = runMetabolism(chem, st, 0, 0,
      { ...DEFAULT_CHEM_CONFIG, enabled: true, reactionOmit: omission }, o, extent);
    return { income, extents: Array.from(extent), out: Array.from(o), stores: Array.from(st.stores),
      nh4: chem.remaining(POOL.NH4, 0), o2: chem.remaining(POOL.O2, 0) };
  };
  const witness = cell(null), omitted = cell('nitrification');
  assert.equal(JSON.stringify(omitted), JSON.stringify(witness), 'the retained selector must be a declared no-op');
  assert.equal(witness.income, 0, 'the isolated pathway must credit no energy');
  assert.ok(witness.extents.every(v => v === 0), 'no live reaction may book an extent');
  assert.ok(witness.out.every(v => v === 0), 'no transfer may be written');
  assert.ok(witness.stores.every(v => v === 0), 'no organism store may move');
  assert.ok(Math.abs(witness.nh4 - 0.004) < 1e-12, 'NH4 must not be drawn');
  assert.ok(Math.abs(witness.o2 - 1) < 1e-12, 'O2 must not be moved');
  writeFileSync(`${out}/isolation-witness.json`, JSON.stringify({
    live: false, declared: isolated[0], cell: witness, omissionSelectorDifference: false,
  }, null, 2));
}

const results = [], rowsByArm = {}, hashesByArm = {};
for (const seed of seeds) {
  for (const omission of [null, 'nitrification']) {
    const name = `${omission ?? 'control'}-${seed}`;
    const config = { ...JSON.parse(readFileSync(`${prior080}/control-41001-config.json`)), seed, chemistryReactionOmit: omission };
    assert.equal(config.founders, 400, 'the frozen config must still start 400 founders');
    assert.equal(runIdentity(config), `${identity}${omission ? `+rxomit/1/${omission}` : ''}`);
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
      uptake, extents: Array.from(observed.chemEvidence.extent), extentNames: REACTIONS.map(r => r.name),
      clamps: Array.from(observed.chemistry.clampedCumulative),
      audit: observed.chemAudit, attribution: rows.at(-1).attribution,
      descendants: descendants.finish(observed.totalBirths), observerExact: true, unreadLost: 0 };
    validateTrialDemographics(result, 400);
    assert.equal(result.descendants.status, 'COMPLETE');
    // The isolated pathway can book no extent under EITHER arm: the omitting
    // arm is not "suppressed", it names something that never ran.
    assert.ok(!REACTIONS.some(r => r.name === omission || r.name === 'nitrification'));
    writeFileSync(`${out}/${name}-ticks.jsonl`, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    writeFileSync(`${out}/${name}-witnesses.json`, JSON.stringify(witnesses));
    writeFileSync(`${out}/${name}-result.json`, JSON.stringify(result, null, 2));
    results.push(result);
    rowsByArm[name] = rows; hashesByArm[name] = rows.map(r => r.hash);
    console.log(`${name}: pop=${result.population} births=${result.births} failures=${JSON.stringify(firstFailures)} exact observer`);
  }
}

// VACUITY — the retained selector is a declared no-op: every recorded field of
// the two arms must be identical at every tick. A difference here would mean
// the isolation leaked, not that biology moved.
const armIdentity = seeds.map((seed) => {
  const c = rowsByArm[`control-${seed}`], o = rowsByArm[`nitrification-${seed}`];
  const rowsIdentical = JSON.stringify(c) === JSON.stringify(o);
  assert.ok(rowsIdentical, `seed ${seed}: the omission arm must be a declared no-op (VACUOUS contrast)`);
  return { seed, identityControl: `${identity}`, identityOmission: `${identity}+rxomit/1/nitrification`,
    ticksCompared: ticks, recordsCompared: c.length, rowsIdentical,
    finalPopulation: c.at(-1).population, finalBirths: c.at(-1).births, finalHash: c.at(-1).hash };
});
writeFileSync(`${out}/arm-identity.json`, JSON.stringify(armIdentity, null, 2));

// CROSS-VERSION CONTRAST — against the recorded chem/0.8.0 panel.
const priorProtocol = JSON.parse(readFileSync(`${prior080}/protocol.json`, 'utf8'));
const priorIndex = priorProtocol.reactionDefects.findIndex(rx => rx.name === 'nitrification');
assert.ok(priorIndex >= 0, 'the recorded panel must carry its nitrification declaration');
const firstDivergence = (newHashes, oldFile) => {
  const oldHashes = readFileSync(oldFile, 'utf8').trim().split('\n').map(l => JSON.parse(l).hash);
  assert.equal(oldHashes.length, newHashes.length, 'recorded panel must have the same horizon');
  for (let i = 0; i < newHashes.length; i++) if (oldHashes[i] !== newHashes[i]) return i + 1;
  return null;
};
const crossVersion = seeds.map((seed) => {
  const newHashes = hashesByArm[`control-${seed}`];
  const vsControl = firstDivergence(newHashes, `${prior080}/control-${seed}-ticks.jsonl`);
  const vsOmission = firstDivergence(newHashes, `${prior080}/nitrification-${seed}-ticks.jsonl`);
  assert.equal(vsOmission, null,
    `seed ${seed}: the corrected null arm must reproduce the recorded 0.8.0 omission arm state-for-state`);
  assert.notEqual(vsControl, null,
    `seed ${seed}: the isolation must be operative relative to the recorded gated control arm`);
  const priorResult = JSON.parse(readFileSync(`${prior080}/control-${seed}-result.json`, 'utf8'));
  const priorExtent = priorResult.extents[priorIndex];
  assert.ok(priorExtent > 0, 'the recorded gated control must have booked a nitrification extent');
  return { seed,
    priorControlIdentity: 'ts-evo-poc/0.8.0+chem/0.8.0',
    priorOmissionIdentity: 'ts-evo-poc/0.8.0+chem/0.8.0+rxomit/1/nitrification',
    correctedIdentity: identity,
    correctedControlHash: newHashes.at(-1),
    priorOmissionHash: JSON.parse(readFileSync(`${prior080}/nitrification-${seed}-result.json`, 'utf8')).hash,
    recordsIdenticalToPriorOmission: vsOmission === null,
    firstDivergenceTickVsPriorControl: vsControl,
    priorControlHash: priorResult.hash,
    priorNitrificationExtent: priorExtent,
    priorNitrificationEnergyCredit: ISOLATED_REACTIONS[0].energy * priorExtent,
    correctedNitrificationExtent: 0, correctedNitrificationEnergyCredit: 0 };
});
writeFileSync(`${out}/cross-version-contrast.json`, JSON.stringify(crossVersion, null, 2));
writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
writeFileSync(`${out}/complete.json`, JSON.stringify({ uniqueRuns: results.length,
  seeds: seeds.length, armsPerSeed: 2, fullHorizonExecutions: results.length * 2,
  observerExact: true, armsIdentical: armIdentity.every(r => r.rowsIdentical),
  priorOmissionReproduced: crossVersion.every(r => r.recordsIdenticalToPriorOmission),
  controlDivergedFromGatedArm: crossVersion.every(r => r.firstDivergenceTickVsPriorControl !== null) }));
// A completed panel holds every file the summary claims; a partial panel is not
// evidence. (This is an archive assertion, not a verdict.)
for (const r of results) {
  const name = `${r.omission ?? 'control'}-${r.seed}`;
  for (const suffix of ['ticks.jsonl', 'witnesses.json', 'result.json', 'config.json']) {
    assert.ok(existsSync(`${out}/${name}-${suffix}`), `missing ${name}-${suffix}`);
  }
}
console.log(`replay complete: ${results.length} runs, ${results.length * 2} full-horizon executions`);
