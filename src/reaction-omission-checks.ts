import assert from 'node:assert/strict';
import { Chemistry, DEFAULT_CHEMISTRY, POOL, POOL_COUNT } from './world/chemistry.js';
import { CAP, ISOLATED_REACTIONS, REACTIONS, RX_COUNT, type ReactionOmission } from './bio/metabolism.js';
import { assimilate, DEFAULT_CHEM_CONFIG, newChemStores, runMetabolism } from './bio/chemlife.js';
import { biomassDemand } from './bio/elements.js';
import { World } from './world/world.js';
import { runIdentity } from './world/version.js';

export function reactionOmissionCases() {
  const rows = [];
  const cases: Array<[ReactionOmission, number, POOL, number]> = [
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
      assert.ok(id >= 0, `live omission target must exist: ${target}`);
      if (omission === null) assert.ok(extent[id] > 0, 'control target must execute');
      else assert.equal(extent[id], 0, 'targeted reaction must be absent');
      const expectedIncome = REACTIONS.reduce((s, r) => s + Math.max(0, r.energy) * extent[r.id], 0);
      assert.ok(Math.abs(income - expectedIncome) < 1e-12, 'no compensatory energy income');
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

  // ISOLATED PATHWAY — chem/0.8.1. Nitrification is not a live reaction, so
  // its omission is a declared no-op: the register keeps the name resolvable,
  // nothing executes, and the arms are IDENTICAL. That identity is the point —
  // the control/omission contrast is VACUOUS, not a measurement of an
  // oxygen-consuming pathway. (At chem/0.8.0 this case asserted a live
  // execution with zero extent under omission; see CHO-081-RESULTS.md.)
  {
    assert.ok(!REACTIONS.some((r) => r.name === 'nitrification'),
      'the isolated pathway must not be live');
    const declared = ISOLATED_REACTIONS.filter((r) => r.name === 'nitrification');
    assert.equal(declared.length, 1, 'the isolated pathway must remain declared exactly once');
    assert.ok(REACTIONS.every((r) => ISOLATED_REACTIONS.every((d) => d.name !== r.name)),
      'an isolated declaration must not shadow a live reaction');

    const cell = (mask: number, omission: ReactionOmission | null, uptake: boolean) => {
      const chem = new Chemistry(1, 1, 1, { ...DEFAULT_CHEMISTRY });
      chem.fields[POOL.NH4].data[0] = 0.004;
      chem.fields[POOL.O2].data[0] = 1;
      const st = newChemStores(1);
      st.capMask[0] = mask; st.capStrength.fill(1); st.light[0] = 1;
      const out = new Float64Array(POOL_COUNT);
      const extent = new Float64Array(RX_COUNT);
      const income = runMetabolism(chem, st, 0, 0,
        { ...DEFAULT_CHEM_CONFIG, enabled: true, reactionOmit: omission }, out, extent);
      for (let p = 0; p < POOL_COUNT; p++) chem.react(p, 0, out[p]);
      if (uptake) assimilate(chem, st, 0, 0, DEFAULT_CHEM_CONFIG, biomassDemand(1));
      return { income, extents: Array.from(extent), out: Array.from(out),
        stores: Array.from(st.stores), nh4: chem.remaining(POOL.NH4, 0),
        o2: chem.remaining(POOL.O2, 0) };
    };

    // A NITRIFY-capable organism in NH4-rich, oxic water books NOTHING: no
    // extent, no energy, no transfer, and neither NH4 nor O2 moves.
    const bare = cell(CAP.NITRIFY, null, false);
    assert.equal(bare.income, 0, 'the isolated pathway must credit no energy');
    assert.ok(bare.extents.every((v) => v === 0), 'no live reaction may book an extent');
    assert.ok(bare.out.every((v) => v === 0), 'no transfer may be written');
    assert.ok(bare.stores.every((v) => v === 0), 'no organism store may move');
    assert.ok(Math.abs(bare.nh4 - 0.004) < 1e-12, 'NH4 must not be drawn');
    assert.ok(Math.abs(bare.o2 - 1) < 1e-12, 'O2 must not be moved');

    // With uptake present as well, the retained selector is a declared no-op:
    // the omitted arm is state-for-state identical to the control.
    const control = JSON.stringify(cell(CAP.NITRIFY | CAP.N_ASSIM, null, true));
    const omitted = JSON.stringify(cell(CAP.NITRIFY | CAP.N_ASSIM, 'nitrification', true));
    assert.equal(omitted, control, 'omitting an isolated pathway must change nothing (VACUOUS contrast)');

    rows.push({ target: 'nitrification', omission: 'nitrification',
      mask: CAP.NITRIFY | CAP.N_ASSIM, vacuous: true, declared: declared[0],
      control: JSON.parse(control) as Record<string, unknown> });
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
