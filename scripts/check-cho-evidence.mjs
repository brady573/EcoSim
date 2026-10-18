/** Explain measured residuals without changing any strict-audit verdict. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { conservationReport } from '../build/world/chemistry.js';
import { ELEMENT_NAMES } from '../build/bio/elements.js';
import { attributeResidual078 } from './chem-attribution-078.mjs';
import { validateTrialDemographics } from './rxomit-descendant-readout.mjs';

function finiteVector(v, label) {
  assert.ok(v && typeof v === 'object', `${label}: missing vector`);
  assert.deepEqual(Object.keys(v), ELEMENT_NAMES.map((_, e) => String(e)), `${label}: incomplete vector`);
  for (let e = 0; e < 7; e++) assert.ok(typeof v[e] === 'number' && Number.isFinite(v[e]), `${label}/${e}: missing or non-finite number`);
  // JSON roundtrips of typed arrays are keyed objects, not iterable arrays.
  return Float64Array.from({ length: 7 }, (_, e) => v[e]);
}

export function validateRawAudit(audit) {
  assert.ok(audit && typeof audit === 'object', 'missing raw audit');
  assert.ok(Number.isSafeInteger(audit.tick) && audit.tick >= 0, 'invalid audit tick');
  const vectors = Object.fromEntries(['initial', 'inputs', 'outputs', 'biomass', 'stores', 'environment']
    .map(key => [key, finiteVector(audit[key], key)]));
  const held = Float64Array.from({ length: 7 }, (_, e) => vectors.biomass[e] + vectors.stores[e] + vectors.environment[e]);
  assert.ok(Array.isArray(audit.residual) && audit.residual.length === 7, 'missing strict reports');
  const expected = conservationReport(vectors.initial, held, vectors.inputs, vectors.outputs);
  assert.deepEqual(audit.residual, expected, 'stored strict audit must match actual compartment and boundary books');
  return { ...vectors, held };
}

export function assertExplained(audit, attribution) {
  const values = validateRawAudit(audit);
  assert.ok(attribution && typeof attribution === 'object', 'missing attribution');
  for (const key of ['reactionDefect', 'clampCreation', 'unexplained']) finiteVector(attribution[key], key);
  const held = Float64Array.from(values.held, (n, e) => n - attribution.reactionDefect[e] - attribution.clampCreation[e]);
  assert.deepEqual(attribution.unexplained,
    audit.residual.map((r, e) => r.residual - attribution.reactionDefect[e] - attribution.clampCreation[e]),
    'stored unexplained remainder must match raw residual');
  const actual = conservationReport(values.initial, held, values.inputs, values.outputs);
  assert.ok(actual.every(r => r.ok), 'unexplained residual exceeds the existing strict criterion');
  return actual;
}

/**
 * Verify the 0.7.8 one-cell controls as RECORDED data.
 *
 * These controls were executed by the retired chem/0.7.8 engine; re-running
 * them would require resurrecting its coefficients, and re-deriving them from
 * the current engine would silently reinterpret the panel. What can still be
 * checked without it is that the recorded numbers decompose exactly as the
 * recorded explanation claims: per-pool movement equals the recorded reaction
 * delta plus the declared water top-up, each case's reaction defect equals its
 * recorded extent times the recorded per-unit defect, and the burial
 * demonstration carries the clamp-created carbon it was recorded to carry.
 */
function verifyRecordedControls(controls, reactionDefects) {
  assert.equal(controls.length, 8);
  const names = new Set(controls.map(c => c.name));
  for (const name of ['photosynthesis', 'aerobic respiration', 'nitrification', 'sulfur oxidation',
    'iron oxidation', 'denitrification-export', 'burial-reservation']) {
    assert.ok(names.has(name), `recorded controls are missing ${name}`);
  }
  for (const c of controls) {
    if (c.name === 'denitrification-export') {
      assert.ok(Math.abs(c.outputN - 1.4 * c.extent) < 1e-12, 'recorded N export must match recorded extent');
      continue;
    }
    if (c.name === 'burial-reservation') {
      // The two burial cases are the record of the DEFECT this correction
      // repairs: an unclaimed burial draw settled into clamp-created carbon,
      // and with no burial the books were clean. Retained so the old panel
      // cannot be re-read as if the reservation had always held.
      assert.ok(Math.abs(c.clamp - (c.bury ? c.burial : 0)) < Number.EPSILON);
      assert.ok(Math.abs(c.carbonCreated - (c.bury ? c.burial : 0)) < Number.EPSILON);
      assert.equal(c.bury, c.carbonCreated > 0);
      continue;
    }
    assert.equal(c.initialPools.length, c.finalPools.length);
    for (let p = 0; p < c.initialPools.length; p++) {
      const expected = c.initialPools[p] + c.delta[p] + (p === 24 ? c.waterInput : 0);
      assert.ok(Math.abs(c.finalPools[p] - expected) <= Number.EPSILON * Math.max(1, Math.abs(expected)) * 8,
        `${c.name}: recorded per-pool movement must match recorded reaction delta and water top-up`);
    }
    const defect = reactionDefects.find(rx => rx.name === c.name);
    assert.ok(defect, `${c.name}: missing recorded defect row`);
    for (let e = 0; e < 7; e++) {
      assert.ok(Math.abs(c.attributed.reactionDefect[e] - defect.vector[e] * c.extent) < 1e-12,
        `${c.name}: recorded defect must equal recorded extent times its recorded per-unit defect`);
      assert.ok(Math.abs(c.attributed.unexplained[e]
        - (c.strict[e].residual - c.attributed.reactionDefect[e] - c.attributed.clampCreation[e])) < 1e-9,
        `${c.name}: recorded unexplained remainder must decompose from the recorded books`);
    }
    assert.ok(c.strict.some(e => ['H', 'O'].includes(e.element) && !e.ok),
      `${c.name}: the 0.7.8 flat map must record the H/O discrepancy this panel is about`);
  }
}

export async function checkChoEvidence(root = '.') {
  const dir = `${root}/evidence/cho-attribution-20261017`;
  const read = name => JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
  assert.ok(existsSync(`${dir}/complete.json`), 'partial panel is not complete evidence');
  const protocol = read('protocol.json'), complete = read('complete.json'), summary = read('summary.json');
  const doc = readFileSync(`${root}/CHO-ATTRIBUTION-ASSESSMENT.md`, 'utf8');
  const receipt = read('build-receipt.json');
  assert.equal(receipt.verifiedAfterLaunch, true);
  for (const [file, hash] of Object.entries(receipt.source)) {
    assert.equal(hash, protocol.sourceDigests[file]);
  }
  // The archive was measured under chem/0.7.8, whose engine no longer exists.
  // Comparing these digests against the live tree would demand the whole
  // repository stay frozen to keep an old panel "valid", and would reinterpret
  // the recorded measurement the moment the engine legitimately changed. The
  // recorded receipt is verified as RECORDED; the live identity is checked in
  // scripts/check-doc-figures.mjs. The compiled half is checked structurally:
  // every measured source module must name its compiled counterpart.
  const compiledList = Object.keys(receipt.compiled);
  assert.equal(compiledList.length, Object.keys(receipt.source).length,
    'receipt must record a compiled counterpart for every source module');
  for (const file of Object.keys(receipt.source)) {
    assert.ok(compiledList.includes(`build/${file.replace(/^src\//, '').replace(/\.ts$/, '.js')}`),
      `receipt is missing the compiled counterpart of ${file}`);
  }
  assert.ok(doc.includes('HISTORICAL'),
    'the retired panel must be marked historical in its assessment document');
  assert.ok(doc.includes('chem/0.8.0'),
    'the assessment must name the identity that superseded the panel');
  for (const rx of protocol.reactionDefects.filter(rx => rx.vector[1] || rx.vector[2])) {
    const fmt = n => n > 0 ? `+${n}` : String(n);
    assert.ok(doc.includes(`| ${rx.name} | ${fmt(rx.vector[1])} | ${fmt(rx.vector[2])} |`));
  }
  assert.deepEqual(protocol.newExploratorySeeds, [41003, 41004, 41005, 41006, 41007, 41008, 41009, 41010]);
  assert.equal(complete.newPairs, 8); assert.equal(complete.discoveryPairs, 2);
  assert.equal(complete.uniqueRuns, 20); assert.equal(complete.fullHorizonExecutions, 40);
  assert.equal(summary.length, 20);
  assert.deepEqual(protocol.seeds, [41001, 41002, 41003, 41004, 41005, 41006, 41007, 41008, 41009, 41010]);
  assert.equal(new Set(summary.map(r => `${r.seed}/${r.omission}`)).size, 20);
  verifyRecordedControls(read('one-cell-controls.json'), protocol.reactionDefects);
  const discovery = read('discovery-prefix-and-clamp.json');
  const discoveryResult = summary.find(r => r.seed === 41001 && r.omission === null);
  assert.equal(discovery.finalHash, discoveryResult.hash);
  assert.deepEqual(discovery.clamps, discoveryResult.clamps);
  for (const [element, row] of Object.entries(discovery.first)) assert.equal(row.tick, discoveryResult.firstFailures[element]);
  for (const r of summary) {
    assert.ok(protocol.seeds.includes(r.seed) && [null, 'nitrification'].includes(r.omission));
    const name = `${r.omission ?? 'control'}-${r.seed}`;
    assert.deepEqual(r, read(`${name}-result.json`));
    validateTrialDemographics(r, 400);
    assert.equal(r.observerExact, true); assert.equal(r.unreadLost, 0);
    assert.equal(r.descendants.status, 'COMPLETE');
    assert.equal(r.descendants.totalBirths, r.births);
    assert.equal(r.firstFailures.H, 17, 'quoted first-H-failure tick');
    assert.equal(r.firstFailures.O, 17, 'quoted first-O-failure tick');
    assert.equal(r.uptake[1], r.uptake[2], 'declared uptake carries H and O 1:1');
    const denit = protocol.reactionDefects.findIndex(rx => rx.name === 'denitrification');
    const nExport = r.extents[denit] * 1.4;
    const exportCheck = conservationReport(new Float64Array(7),
      Float64Array.of(0, 0, 0, r.audit.outputs[3], 0, 0, 0),
      Float64Array.of(0, 0, 0, nExport, 0, 0, 0), new Float64Array(7));
    assert.ok(exportCheck[3].ok, 'N export correction must match actual declared live-world book');
    if (r.omission) assert.equal(r.extents[protocol.reactionDefects.findIndex(rx => rx.name === 'nitrification')], 0);
    const config = read(`${name}-config.json`);
    const base = read('control-41001-config.json');
    assert.deepEqual(config, { ...base, seed: r.seed, chemistryReactionOmit: r.omission });
    assertExplained(r.audit, r.attribution);
    let count = 0; const first = {};
    for await (const line of createInterface({ input: createReadStream(`${dir}/${name}-ticks.jsonl`), crlfDelay: Infinity })) {
      const t = JSON.parse(line); assert.equal(t.tick, ++count);
      assert.equal(t.audit.tick, t.tick);
      const attribution = attributeResidual078(protocol.reactionDefects, t.extents, t.clamps, t.audit.residual.map(e => e.residual));
      assert.deepEqual(t.attribution, attribution); assertExplained(t.audit, attribution);
      for (const e of t.audit.residual) if (!e.ok && first[e.element] === undefined) first[e.element] = t.tick;
      if (count === 1000) {
        assert.deepEqual(t.audit, r.audit); assert.equal(t.hash, r.hash);
        assert.deepEqual(t.attribution, r.attribution, 'terminal attribution must match reconstructed raw tick');
      }
    }
    assert.equal(count, 1000); assert.deepEqual(first, r.firstFailures);
    const witnesses = read(`${name}-witnesses.json`);
    for (const [element, tick] of Object.entries(first)) {
      const w = witnesses.find(w => w.element === element && w.tick === tick);
      assert.ok(w && w.chemistry.length, 'first failure requires nonempty live chemistry witness');
    }
    // Negative: reject an altered final inventory with an unchanged stored report.
    // cho-evidence-fixtures also tests coherent books with unbooked carbon.
    const corrupt = structuredClone(r.audit); corrupt.residual[0].final += 1;
    assert.throws(() => assertExplained(corrupt, r.attribution), { code: 'ERR_ASSERTION' });
  }
  const newSeeds = protocol.newExploratorySeeds;
  for (const seed of newSeeds) {
    const a = summary.find(r => r.seed === seed && r.omission === null);
    const b = summary.find(r => r.seed === seed && r.omission === 'nitrification');
    assert.ok(doc.includes(`| ${seed} | ${a.population} → ${b.population} | ${a.births} → ${b.births} | ${a.descendants.offspringProducedChildren} → ${b.descendants.offspringProducedChildren} |`));
  }
  const mean = (omission, key) => summary.filter(r => newSeeds.includes(r.seed) && r.omission === omission).reduce((n, r) => n + r[key], 0) / newSeeds.length;
  assert.ok(doc.includes(`**${mean(null, 'population')} → ${mean('nitrification', 'population')}**`));
  assert.ok(doc.includes(`**${mean(null, 'births')} → ${mean('nitrification', 'births')}**`));
  console.log('C/H/O attribution: 20 runs / 8 new pairs; 20000 strict raw tick books reconstructed; '
    + '8 recorded controls verified under the frozen 0.7.8 convention; no audit reclassification.');
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkChoEvidence();
