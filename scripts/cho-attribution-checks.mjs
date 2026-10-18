/**
 * Discriminating engine controls under the POOL_COMPOSITION contract.
 *
 * These are one-cell controls, not additional simulation executions: each case
 * drives the live chemistry machinery directly and records what the books did.
 * They are recorded with the new panels and verified by their checkers. The
 * retired 0.7.8 controls live in the archive itself and are verified there
 * under the frozen old convention (scripts/chem-attribution-078.mjs); this file
 * always speaks the CURRENT contract and never rewrites the old record.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Chemistry, DEFAULT_CHEMISTRY, POOL_RT as P, POOL_COUNT, conservationReport } from '../build/world/chemistry.js';
import { REACTIONS, reactionExtent } from '../build/bio/metabolism.js';
import { attributeResidual, reactionElementDefects } from './chem-residual-attribution.mjs';

const TOL = (expected) => Number.EPSILON * Math.max(1, Math.abs(expected)) * 8;

export function choContractCases() {
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
      assert.ok(Math.abs(finalPools[p] - expected) <= TOL(expected),
        `${name}: actual per-pool movement must match reaction and water top-up`);
    }
    const final = Float64Array.from({ length: 7 }, (_, e) => chem.elementTotal(e));
    const inputs = new Float64Array(7);
    inputs[1] = 2 * chem.flux.waterInput;   // water is 2 H + 1 O per unit
    inputs[2] = chem.flux.waterInput;
    const strict = conservationReport(initial, final, inputs, new Float64Array(7));
    // Under the current contract a single reaction in a closed cell must close
    // in every element, H and O included. The 0.7.8 controls recorded the
    // opposite for H/O; that difference IS the correction.
    assert.ok(strict.every(e => e.ok),
      `${name}: declared stoichiometry must close all seven elements, got ${strict.filter(e => !e.ok).map(e => e.element)}`);
    const extents = REACTIONS.map(r => r.name === name ? extent : 0);
    const attributed = attributeResidual(extents, Array.from(chem.clampedCumulative), strict.map(e => e.residual));
    for (let e = 0; e < 7; e++) {
      // G26's absolute 1e-9 on the per-unit defect, applied to the residual
      // scale of a cell holding 10 of every pool: bookkeeping dust here is
      // ~1e-14, while a genuine unbooked transfer in this cell is >= 1e-6.
      assert.ok(Math.abs(attributed.unexplained[e]) <= 1e-9,
        `${name}: a closing reaction has nothing left to explain in ${e}`);
    }
    assert.ok(Math.abs(chem.clampedCumulative[P.OC]) <= 1e-12, `${name}: no unreserved clamp in a closed cell`);
    // Intentionally unbooked carbon must remain unexplained, not be excused.
    const corrupt = attributeResidual(extents, Array.from(chem.clampedCumulative), strict.map((e, i) => e.residual + (i === 0 ? 1 : 0)));
    assert.ok(corrupt.unexplained[0] > 0.99);
    results.push({ name, extent, initialPools, finalPools, delta: Array.from(delta),
      waterInput: chem.flux.waterInput, strict, attributed });
  }
  {
    // The nitrification correction, stated as a control: the old books charged
    // this reaction 1.8 O it never booked as a substrate (and manufactured
    // 1.8 H on the product side). Both are gone; O2 remains a HABITAT gate
    // (minO2 on the reaction), not a booked substrate.
    const nitrification = reactionElementDefects().find(r => r.name === 'nitrification').vector;
    for (let e = 0; e < 7; e++) assert.ok(Math.abs(nitrification[e]) < 1e-12,
      `nitrification must close by declaration under the correction, got ${nitrification}`);
    const rx = REACTIONS.find(r => r.name === 'nitrification');
    assert.ok(rx.minO2 > 0, 'nitrification must still require oxygen as a habitat gate');
    results.push({ name: 'nitrification-correction', vector: nitrification, minO2: rx.minO2 });
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
    inputs[1] = 2 * chem.flux.waterInput;
    inputs[2] = chem.flux.waterInput;
    const gas = (rx.gas ?? []).find(g => g.element === 3);
    assert.ok(gas && gas.coeff > 0, 'denitrification must declare its N2 vent');
    outputs[3] = gas.coeff * extent;
    assert.ok(conservationReport(initial, final, inputs, outputs).every(r => r.ok));
    assert.equal(conservationReport(initial, final, inputs, new Float64Array(7))[3].ok, false,
      'the declared N vent, not silence, is what closes the N book');
    results.push({ name: 'denitrification-export', extent, outputN: outputs[3], gas: gas.coeff });
  }
  for (const unreserved of [false, true]) {
    const chem = new Chemistry(1, 1, 1, { ...DEFAULT_CHEMISTRY, diffusivity: 0, semiDiffusivity: 0 });
    chem.fields[P.OC].data[0] = 0.0001;
    const initialC = chem.elementTotal(0);
    const burial = chem.fields[P.OC].data[0] * chem.cfg.burial;
    if (unreserved) { chem.react(P.OC, 0, -burial); chem.react(P.SC, 0, burial); }             // the removed defect
    else { chem.claim(P.OC, 0, burial); chem.react(P.SC, 0, burial); }                          // the reservation, as fixed
    const rx = REACTIONS.find(r => r.name === 'aerobic respiration');
    const delta = new Float64Array(POOL_COUNT);
    const extent = reactionExtent(rx, chem, 0, 1, delta);
    const visible = unreserved ? 0.0001 : 0.0001 - burial;
    assert.ok(Math.abs(extent - visible) <= TOL(visible), 'a reserved draw is not available twice');
    for (let p = 0; p < POOL_COUNT; p++) chem.react(p, 0, delta[p]);
    chem.settle();
    const clamp = chem.clampedCumulative[P.OC];
    assert.ok(Math.abs(clamp - (unreserved ? burial : 0)) <= TOL(burial),
      unreserved ? 'the unreserved draw must reproduce the clamp' : 'a reserved draw must not clamp');
    const carbonCreated = chem.elementTotal(0) - initialC;
    assert.ok(Math.abs(carbonCreated - (unreserved ? burial : 0)) <= TOL(burial));
    results.push({ name: 'burial-reservation', unreserved, burial, extent, carbonCreated, clamp });
  }
  assert.throws(() => attributeResidual([], [], []));
  const zero = REACTIONS.map(() => 0), clamps = Array(POOL_COUNT).fill(0);
  assert.throws(() => attributeResidual(zero, clamps, [NaN, 0, 0, 0, 0, 0, 0]));
  assert.throws(() => attributeResidual(zero.map(() => -1), clamps, Array(7).fill(0)));
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(choContractCases(), null, 2));
}
