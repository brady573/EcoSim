/** Discriminating engine controls; no world mutation or biology repair. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Chemistry, DEFAULT_CHEMISTRY, POOL_RT as P, POOL_COUNT, conservationReport } from '../build/world/chemistry.js';
import { REACTIONS, reactionExtent } from '../build/bio/metabolism.js';
import { attributeResidual, reactionElementDefects } from './chem-residual-attribution.mjs';

export function choAttributionCases() {
  const results = [];
  for (const name of ['photosynthesis', 'aerobic respiration', 'nitrification', 'sulfur oxidation', 'iron oxidation']) {
    const chem = new Chemistry(1, 1, 1, { ...DEFAULT_CHEMISTRY, diffusivity: 0, semiDiffusivity: 0 });
    const rx = REACTIONS.find(r => r.name === name);
    for (const field of chem.fields) field.data.fill(10);
    const initial = Float64Array.from({ length: 7 }, (_, e) => chem.elementTotal(e));
    const initialPools = Array.from(chem.poolTotals());
    const delta = new Float64Array(POOL_COUNT);
    const extent = reactionExtent(rx, chem, 0, 1, delta, 1);
    assert.ok(extent > 0, `${name} must be nonvacuous`);
    for (let p = 0; p < POOL_COUNT; p++) chem.react(p, 0, delta[p]);
    chem.settle();
    const finalPools = Array.from(chem.poolTotals());
    for (let p = 0; p < POOL_COUNT; p++) {
      const expected = initialPools[p] + delta[p] + (p === P.H2O ? chem.flux.waterInput : 0);
      assert.ok(Math.abs(finalPools[p] - expected) <= Number.EPSILON * Math.max(1, Math.abs(expected)) * 8,
        `${name}: actual per-pool movement must match reaction and water top-up`);
    }
    const final = Float64Array.from({ length: 7 }, (_, e) => chem.elementTotal(e));
    const inputs = new Float64Array(7);
    inputs[1] = inputs[2] = chem.flux.waterInput;
    const strict = conservationReport(initial, final, inputs, new Float64Array(7));
    assert.ok(strict.some(e => ['H', 'O'].includes(e.element) && !e.ok));
    const extents = REACTIONS.map(r => r.name === name ? extent : 0);
    const attributed = attributeResidual(extents, Array.from(chem.clampedCumulative), strict.map(e => e.residual));
    const explained = conservationReport(initial, Float64Array.from(final, (n, e) => n - attributed.reactionDefect[e]), inputs, new Float64Array(7));
    assert.ok(explained.every(e => e.ok), 'reaction coefficients explain the discrepancy, not repair it');
    // Intentionally unbooked carbon must remain unexplained, not be excused.
    const corrupt = attributeResidual(extents, Array.from(chem.clampedCumulative), strict.map((e, i) => e.residual + (i === 0 ? 1 : 0)));
    assert.ok(corrupt.unexplained[0] > 0.99);
    results.push({ name, extent, initialPools, finalPools, delta: Array.from(delta), waterInput: chem.flux.waterInput, strict, attributed });
  }
  {
    const chem = new Chemistry(1, 1, 1, { ...DEFAULT_CHEMISTRY, diffusivity: 0, semiDiffusivity: 0 });
    chem.fields[P.O2].data[0] = 0;
    chem.fields[P.NO3].data[0] = 1;
    const initial = Float64Array.from({ length: 7 }, (_, e) => chem.elementTotal(e));
    const delta = new Float64Array(POOL_COUNT);
    const rx = REACTIONS.find(r => r.name === 'denitrification');
    const extent = reactionExtent(rx, chem, 0, 1, delta);
    assert.ok(extent > 0);
    for (let p = 0; p < POOL_COUNT; p++) chem.react(p, 0, delta[p]);
    chem.settle();
    const final = Float64Array.from({ length: 7 }, (_, e) => chem.elementTotal(e));
    const inputs = new Float64Array(7), outputs = new Float64Array(7);
    inputs[1] = inputs[2] = chem.flux.waterInput;
    outputs[3] = 1.4 * extent;
    assert.ok(conservationReport(initial, final, inputs, outputs).every(r => r.ok));
    assert.equal(conservationReport(initial, final, inputs, new Float64Array(7))[3].ok, false);
    results.push({ name: 'denitrification-export', extent, outputN: outputs[3] });
  }
  for (const bury of [false, true]) {
    const chem = new Chemistry(1, 1, 1, { ...DEFAULT_CHEMISTRY, diffusivity: 0, semiDiffusivity: 0 });
    chem.fields[P.OC].data[0] = 0.0001;
    const initialC = chem.elementTotal(0);
    const burial = chem.fields[P.OC].data[0] * chem.cfg.burial;
    if (bury) { chem.react(P.OC, 0, -burial); chem.react(P.SC, 0, burial); }
    const rx = REACTIONS.find(r => r.name === 'aerobic respiration');
    const delta = new Float64Array(POOL_COUNT);
    const extent = reactionExtent(rx, chem, 0, 1, delta);
    assert.equal(extent, 0.0001, 'reaction sees unreserved burial inventory');
    for (let p = 0; p < POOL_COUNT; p++) chem.react(p, 0, delta[p]);
    chem.settle();
    assert.ok(Math.abs(chem.clampedCumulative[P.OC] - (bury ? burial : 0)) < Number.EPSILON);
    const carbonCreated = chem.elementTotal(0) - initialC;
    assert.ok(Math.abs(carbonCreated - (bury ? burial : 0)) < Number.EPSILON);
    results.push({ name: 'burial-reservation', bury, burial, extent, carbonCreated, clamp: chem.clampedCumulative[P.OC] });
  }
  assert.deepEqual(reactionElementDefects().find(r => r.name === 'nitrification').vector, [0, 0, -1.8, 0, 0, 0, 0]);
  assert.equal(reactionElementDefects().find(r => r.name === 'denitrification').vector[3], 0);
  assert.throws(() => attributeResidual([], [], []));
  const zero = REACTIONS.map(() => 0), clamps = Array(POOL_COUNT).fill(0);
  assert.throws(() => attributeResidual(zero, clamps, [NaN, 0, 0, 0, 0, 0, 0]));
  assert.throws(() => attributeResidual(zero.map(() => -1), clamps, Array(7).fill(0)));
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(choAttributionCases(), null, 2));
}
