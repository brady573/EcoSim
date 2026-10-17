// Exercises the actual constructor/readouts imported by the primary viewer.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createViewerWorld, viewerProvenance, chemistryMeasurements, organismChemistry, viewerReplayConfig } from '../build/view/experiment.js';
import { World } from '../build/world/world.js';
import { runIdentity } from '../build/world/version.js';

for (const chemistry of [false, true]) for (const genome of [false, true]) {
  const w = createViewerWorld(400, 517, chemistry, genome);
  const control = new World({ config: { ...w.config } });
  for (let i = 0; i < 120; i++) { w.step(); control.step(); }
  assert.equal(w.hashState(), control.hashState(), 'matched engine config reproduces viewer construction');
  const before = w.hashState();
  const provenance = viewerProvenance(w);
  const rows = chemistryMeasurements(w);
  const exported = JSON.parse(viewerReplayConfig(w));
  assert.deepEqual(exported.resolvedConfig, JSON.parse(JSON.stringify(w.config)));
  assert.equal(exported.identity, runIdentity(chemistry));
  assert.equal(exported.tick, 120);
  const replayed = new World({ config: exported.resolvedConfig });
  for (let i = 0; i < exported.tick; i++) replayed.step();
  assert.equal(replayed.hashState(), before, 'exported config/tick reproduces the original world');
  const live = Array.from({ length: w.store.capacity }, (_, i) => i).find((i) => w.aliveAt(i));
  assert.notEqual(live, undefined, 'inspector witness is alive');
  const inspected = organismChemistry(w, live);
  assert.equal(inspected.length > 0, chemistry);
  if (chemistry) assert.ok(inspected.includes('Tissue (mol):') && inspected.includes('Stores (mol):'));
  assert.equal(organismChemistry(w, w.store.capacity), '', 'unused slot has no chemistry readout');
  assert.ok(provenance.includes(runIdentity(chemistry)));
  assert.ok(provenance.includes('seed 517') && provenance.includes('tick 120'));
  assert.equal(w.config.genomeV2, genome ? true : null);
  assert.equal(Boolean(w.chemistry), chemistry);
  assert.equal(rows.length > 0, chemistry);
  if (chemistry && genome) {
    assert.ok(w.chemistry.flux.chemEnergyIncome > 0, 'expressed modules execute chemical reactions');
    assert.ok(w.chemistry.flux.chemCarbonBuilt > 0, 'actual chemical tissue growth');
  }
  if (chemistry && !genome) assert.equal(w.chemistry.flux.chemEnergyIncome, 0, 'no module-enabled reactions without Genome V2');
  assert.equal(before, w.hashState(), 'readouts do not mutate the world');
  const restarted = createViewerWorld(400, 517, chemistry, genome);
  const initial = createViewerWorld(400, 517, chemistry, genome);
  assert.equal(restarted.hashState(), initial.hashState(), 'restart preserves seed/config');
  let kept = w;
  assert.throws(() => { kept = createViewerWorld(400, 0, chemistry, genome); }, /Seed/);
  assert.equal(kept, w, 'failed construction preserves the live world');
  assert.equal(kept.hashState(), before);
  console.log(`PASS chemistry=${chemistry} GenomeV2=${genome}: ${provenance}`);
}
assert.throws(() => createViewerWorld(400, 0, false, false), /Seed/);
assert.throws(() => createViewerWorld(0, 517, false, false), /Founders/);
assert.throws(() => createViewerWorld(NaN, 517, false, false), /Founders/);
const html = readFileSync(new URL('../src/view/index.html', import.meta.url), 'utf8');
const viewer = readFileSync(new URL('../build/view/viewer.js', import.meta.url), 'utf8');
for (const id of ['experiment-mode', 'run-error', 'btn-genome', 'btn-config', 'btn-copy-config', 'resolved-config']) {
  assert.ok(html.includes(`id="${id}"`), `served HTML includes ${id}`);
  assert.ok(viewer.includes(`'${id}'`), `compiled primary viewer wires ${id}`);
}
console.log('Primary-viewer construction/readout checks passed (not browser smoke).');
