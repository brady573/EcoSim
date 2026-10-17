import assert from 'node:assert/strict';
import { Chemistry, DEFAULT_CHEMISTRY, POOL, POOL_COUNT } from './world/chemistry.js';
import { CAP, REACTIONS, RX_COUNT, type ReactionOmission } from './bio/metabolism.js';
import { assimilate, DEFAULT_CHEM_CONFIG, newChemStores, runMetabolism } from './bio/chemlife.js';
import { biomassDemand } from './bio/elements.js';
import { World } from './world/world.js';
import { runIdentity } from './world/version.js';

export function reactionOmissionCases() {
  const rows = [];
  const cases: Array<[ReactionOmission, number, POOL, number]> = [
    ['nitrification', CAP.NITRIFY | CAP.N_ASSIM, POOL.NH4, 0.004],
    ['iron oxidation', CAP.FE_CHEMO | CAP.FE_UPTAKE, POOL.FE2, 0.00035],
    ['iron uptake', CAP.FE_UPTAKE, POOL.FE2, 0.00035],
  ];
  for (const [target, mask, pool, stock] of cases) {
    for (const omission of [null, target]) {
      const chem = new Chemistry(1, 1, 1, { ...DEFAULT_CHEMISTRY });
      chem.fields[pool].data[0] = stock;
      const st = newChemStores(1);
      st.capMask[0] = mask; st.capStrength.fill(1); st.light[0] = 1;
      const out = new Float64Array(POOL_COUNT);
      const extent = new Float64Array(RX_COUNT);
      const income = runMetabolism(chem, st, 0, 0,
        { ...DEFAULT_CHEM_CONFIG, enabled: true, reactionOmit: omission }, out, extent);
      const remaining = chem.remaining(pool, 0);
      for (let p = 0; p < POOL_COUNT; p++) chem.react(p, 0, out[p]);
      assimilate(chem, st, 0, 0, DEFAULT_CHEM_CONFIG, biomassDemand(1));
      assert.equal(st.capMask[0], mask, 'selector must not clear uptake capabilities');
      assert.ok(Array.from(st.capStrength).every((v) => v === 1));
      const id = REACTIONS.findIndex((r) => r.name === target);
      if (omission === null) assert.ok(extent[id] > 0, 'control target must execute');
      else assert.equal(extent[id], 0, 'targeted reaction must be absent');
      const expectedIncome = REACTIONS.reduce((s, r) => s + Math.max(0, r.energy) * extent[r.id], 0);
      assert.ok(Math.abs(income - expectedIncome) < 1e-12, 'no compensatory energy income');
      if (target === 'nitrification') {
        assert.ok((mask & CAP.N_ASSIM) !== 0);
        if (omission) { assert.ok(st.stores[3] > 0); assert.equal(out[POOL.NO3], 0); }
        else assert.equal(st.stores[3], 0);
      }
      if (target === 'iron uptake') {
        assert.ok((mask & CAP.FE_UPTAKE) !== 0);
        if (omission) { assert.ok(st.stores[6] > 0); assert.equal(out[POOL.OFE], 0); }
        else assert.equal(st.stores[6], 0);
      }
      if (target === 'iron oxidation' && omission) {
        assert.equal(out[POOL.FE3], 0);
        assert.ok(out[POOL.OFE] > 0, 'independent extracellular sink remains active');
        assert.equal(st.stores[6], 0, 'no invented Fe rescue through remaining sink');
      }
      rows.push({ target, omission, mask, income, remaining,
        extents: Array.from(extent), stores: Array.from(st.stores), delta: Array.from(out) });
    }
  }
  for (const bad of ['bogus', ['nitrification', 'iron uptake'], true, 0]) {
    assert.throws(() => new World({ config: { chemistry: true, chemistryReactionOmit: bad as never } }), /chemistryReactionOmit/);
  }
  assert.throws(() => new World({ config: { chemistry: null, chemistryReactionOmit: 'nitrification' } }), /chemistryReactionOmit/);
  assert.equal(runIdentity({ chemistry: true, chemistryReactionOmit: null }), runIdentity(true));
  assert.notEqual(runIdentity({ chemistry: true, chemistryReactionOmit: 'nitrification' }), runIdentity(true));
  // Each named family is an independently declared omission; the other sink
  // taking the resource is a valid outcome, not a failed test.
  return rows;
}
