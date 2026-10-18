/** Explain measured residuals without changing any strict-audit verdict. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { conservationReport } from '../build/world/chemistry.js';
import { REACTIONS } from '../build/bio/metabolism.js';
import { attributeResidual } from './chem-residual-attribution.mjs';
import { reactionElementDefects } from './chem-residual-attribution.mjs';
import { validateTrialDemographics } from './rxomit-descendant-readout.mjs';
import { choAttributionCases } from './cho-attribution-checks.mjs';

export function assertExplained(audit, attribution) {
  const held = Float64Array.from(audit.residual, (r, e) => r.final - attribution.reactionDefect[e] - attribution.clampCreation[e]);
  // JSON roundtrips of typed arrays are keyed objects, not iterable arrays.
  const values = (v) => Float64Array.from({ length: 7 }, (_, e) => v[e]);
  const actual = conservationReport(values(audit.initial), held, values(audit.inputs), values(audit.outputs));
  assert.ok(actual.every(r => r.ok), 'unexplained residual exceeds the existing strict criterion');
  return actual;
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
  for (const [file, hash] of Object.entries(receipt.compiled)) {
    assert.equal(createHash('sha256').update(readFileSync(`${root}/${file}`)).digest('hex'), hash, `compiled input differs: ${file}`);
  }
  for (const rx of reactionElementDefects().filter(rx => rx.vector[1] || rx.vector[2])) {
    const fmt = n => n > 0 ? `+${n}` : String(n);
    assert.ok(doc.includes(`| ${rx.name} | ${fmt(rx.vector[1])} | ${fmt(rx.vector[2])} |`));
  }
  assert.deepEqual(protocol.newExploratorySeeds, [41003, 41004, 41005, 41006, 41007, 41008, 41009, 41010]);
  assert.equal(complete.newPairs, 8); assert.equal(complete.discoveryPairs, 2);
  assert.equal(complete.uniqueRuns, 20); assert.equal(complete.fullHorizonExecutions, 40);
  assert.equal(summary.length, 20);
  assert.deepEqual(protocol.seeds, [41001, 41002, 41003, 41004, 41005, 41006, 41007, 41008, 41009, 41010]);
  assert.equal(new Set(summary.map(r => `${r.seed}/${r.omission}`)).size, 20);
  for (const [file, hash] of Object.entries(protocol.sourceDigests)) {
    assert.equal(createHash('sha256').update(readFileSync(`${root}/${file}`)).digest('hex'), hash, `measured source changed: ${file}`);
  }
  const controls = choAttributionCases();
  assert.deepEqual(read('one-cell-controls.json'), JSON.parse(JSON.stringify(controls)), 'retained controls must match their rerun');
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
    const denit = REACTIONS.findIndex(rx => rx.name === 'denitrification');
    const nExport = r.extents[denit] * 1.4;
    const exportCheck = conservationReport(new Float64Array(7),
      Float64Array.of(0, 0, 0, r.audit.outputs[3], 0, 0, 0),
      Float64Array.of(0, 0, 0, nExport, 0, 0, 0), new Float64Array(7));
    assert.ok(exportCheck[3].ok, 'N export correction must match actual declared live-world book');
    if (r.omission) assert.equal(r.extents[REACTIONS.findIndex(rx => rx.name === 'nitrification')], 0);
    const config = read(`${name}-config.json`);
    const base = read('control-41001-config.json');
    assert.deepEqual(config, { ...base, seed: r.seed, chemistryReactionOmit: r.omission });
    assertExplained(r.audit, r.attribution);
    let count = 0; const first = {};
    for await (const line of createInterface({ input: createReadStream(`${dir}/${name}-ticks.jsonl`), crlfDelay: Infinity })) {
      const t = JSON.parse(line); assert.equal(t.tick, ++count);
      const attribution = attributeResidual(t.extents, t.clamps, t.audit.residual.map(e => e.residual));
      assert.deepEqual(t.attribution, attribution); assertExplained(t.audit, attribution);
      for (const e of t.audit.residual) if (!e.ok && first[e.element] === undefined) first[e.element] = t.tick;
      if (count === 1000) { assert.deepEqual(t.audit, r.audit); assert.equal(t.hash, r.hash); }
    }
    assert.equal(count, 1000); assert.deepEqual(first, r.firstFailures);
    const witnesses = read(`${name}-witnesses.json`);
    for (const [element, tick] of Object.entries(first)) {
      const w = witnesses.find(w => w.element === element && w.tick === tick);
      assert.ok(w && w.chemistry.length, 'first failure requires nonempty live chemistry witness');
    }
    // Negative: decomposition must not excuse an added unbooked carbon unit.
    const corrupt = structuredClone(r.audit); corrupt.residual[0].final += 1;
    assert.throws(() => assertExplained(corrupt, r.attribution), /unexplained/);
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
  console.log(`C/H/O attribution: 20 runs / 8 new pairs; 20000 strict raw tick books reconstructed; ${controls.length} controls; no audit reclassification.`);
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkChoEvidence();
