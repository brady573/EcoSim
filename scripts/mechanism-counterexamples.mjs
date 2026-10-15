/** Read-only engine investigation: fixtures use public helper APIs, not worlds.
 * Characterizes existing defects; PASS means reproduced, never healthy biology.
 * Run after compilation: node scripts/mechanism-counterexamples.mjs
 */
import assert from 'node:assert/strict';
import { grow, newChemStores, DEFAULT_CHEM_CONFIG, canAffordOffspring,
  COFACTOR_RESERVE, assimilate } from '../build/bio/chemlife.js';
import { Chemistry, DEFAULT_CHEMISTRY, POOL_RT as P, POOL_COUNT } from '../build/world/chemistry.js';
import { REACTIONS, reactionExtent } from '../build/bio/metabolism.js';
import { biomassDemand, BIOMASS_STOICH, ELEMENT_NAMES } from '../build/bio/elements.js';
import { runIdentity } from '../build/world/version.js';
assert.equal(runIdentity(true), 'ts-evo-poc/0.8.0+chem/0.7.7',
  'Historical defect reproducer: use source at 8fddb08; current corrections use scripts/chem-correctness-checks.mjs');

console.log(JSON.stringify({ kind: 'provenance', identity: runIdentity(true),
  scope: 'synthetic public-helper fixtures, not live-world causal evidence',
  command: 'node scripts/mechanism-counterexamples.mjs' }));
// Explicit fixture intervention: omit selected reaction calls, never modify a
// World, reaction table, production code or inherited capability. Assimilation
// keeps its N_ASSIM/FE_UPTAKE gates on in every contrast.
for (const [resource, stock, reactions] of [
  ['NH4', 0.004, ['nitrification']],
  ['FE2', 0.00035, ['iron oxidation', 'iron uptake']],
]) {
  const variants = resource === 'NH4' ? [[], reactions] : [[], [reactions[0]], [reactions[1]], reactions];
  for (const enabled of variants) {
    const chem = new Chemistry(1, 1, 1, { ...DEFAULT_CHEMISTRY });
    chem.fields[P[resource]].data[0] = stock;
    const st = newChemStores(1);
    st.capMask[0] = (1 << 9) | (1 << 7); // runtime const enums: N_ASSIM, FE_UPTAKE
    const out = new Float64Array(POOL_COUNT);
    const extents = {};
    for (const r of REACTIONS) if (enabled.includes(r.name)) {
      extents[r.name] = reactionExtent(r, chem, 0, 1, out, 1);
    }
    const remainingBeforeAssimilation = chem.remaining(P[resource], 0);
    for (let q = 0; q < POOL_COUNT; q++) chem.react(q, 0, out[q]);
    assimilate(chem, st, 0, 0, DEFAULT_CHEM_CONFIG, biomassDemand(1));
    const e = resource === 'NH4' ? 3 : 6;
    assert.ok(remainingBeforeAssimilation >= -1e-12);
    if (enabled.length === 0) assert.ok(st.stores[e] > 0);
    else {
      assert.ok(Object.values(extents).some((v) => v > 0), 'reaction arm must actually fire');
      assert.ok(Math.abs(stock - (stock - remainingBeforeAssimilation)) < 1e-12);
      assert.equal(st.stores[e], 0, 'reaction reservation excludes subsequent uptake in this fixture');
    }
    console.log(JSON.stringify({ kind: 'one-cell-reaction-then-assimilation', resource,
      stock, enabled, strength: 1, extents, grossReactionReservation: stock - remainingBeforeAssimilation,
      remainingBeforeAssimilation, assimilated: st.stores[e], stores: Array.from(st.stores),
      netReactionDelta: Object.fromEntries(['NH4', 'NO3', 'FE2', 'FE3', 'OFE'].map((p) => [p, out[P[p]]])),
      scope: 'one tick helper sequence; no settlement/weathering; not a live-world intervention' }));
  }
}
for (const [name, index, fraction] of [['half-P', 4, 0.5], ['missing-Fe', 6, 0]]) {
  const st = newChemStores(1);
  const request = 0.012;
  const demand = biomassDemand(request);
  st.stores.set(demand);
  st.stores[index] *= fraction;
  const before = Array.from(st.stores);
  const result = { carbon: 0, nutrientLimited: false, energyLimited: false };
  grow(st, 0, request, 1, DEFAULT_CHEM_CONFIG, result, new Float64Array(7));
  const expectedValidCarbon = request * fraction;
  const expectedTissue = biomassDemand(expectedValidCarbon);
  const actual = Array.from(st.biomass);
  const mismatches = ELEMENT_NAMES.filter((_, e) => Math.abs(actual[e] - expectedTissue[e]) > 1e-12);
  for (let e = 0; e < 7; e++) assert.ok(Math.abs(before[e] - st.stores[e] - actual[e]) < 1e-12);
  if (fraction > 0) {
    assert.ok(result.carbon > expectedValidCarbon + 1e-12, 'expected current dimensional defect to reproduce');
    assert.ok(mismatches.length > 0);
  } else {
    assert.equal(result.carbon, 0, 'missing trace excludes growth');
    assert.deepEqual(mismatches, []);
  }
  console.log(JSON.stringify({ kind: fraction > 0 ? 'confirmed-current-defect' : 'negative-control', fixture: name,
    requestedCarbon: request, expectedValidCarbon, reportedCarbon: result.carbon,
    biomass: actual, expectedTissue: Array.from(expectedTissue), mismatches,
    elementalConservation: true, fixedStoichiometry: mismatches.length === 0 }));
}
for (const scale of [0.5, 1, 2]) {
  const st = newChemStores(1);
  st.biomass.set(biomassDemand(scale));
  // Linear advertised demand; trace reserve has its own declared factor.
  for (const e of [3, 4]) st.stores[e] = BIOMASS_STOICH[e] * scale;
  for (const e of [5, 6]) st.stores[e] = BIOMASS_STOICH[e] * scale * COFACTOR_RESERVE;
  const cfg = { ...DEFAULT_CHEM_CONFIG, reproNutrientDemand: scale };
  const atLinear = canAffordOffspring(st, 0, cfg);
  for (const e of [3, 4]) st.stores[e] = BIOMASS_STOICH[e] * scale * scale;
  const atSquared = canAffordOffspring(st, 0, cfg);
  assert.equal(atLinear.ok, scale <= 1);
  assert.equal(atSquared.ok, true);
  console.log(JSON.stringify({ kind: 'reproduction-demand-characterization', scale,
    atLinear, atSquared, macronutrientThreshold: 'stoichiometry * scale^2',
    traceThreshold: 'stoichiometry * scale * cofactorReserve' }));
}
