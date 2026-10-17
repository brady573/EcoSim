/** Targeted D1/D2 regression cases, shared by gates and recorded evidence. */
import assert from 'node:assert/strict';
import { World } from './world/world.js';
import { biomassDemand, BIOMASS_STOICH } from './bio/elements.js';
import { COFACTOR_RESERVE, DEFAULT_CHEM_CONFIG, ENERGY_PER_CARBON,
  canAffordOffspring, grow, newChemStores } from './bio/chemlife.js';

const close = (actual: number, expected: number, label: string): void => {
  assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} != ${expected}`);
};

export function chemicalGrowthCases() {
  const records = [];
  for (const request of [0.001, 0.012, 1, 10]) {
    for (const kind of ['half-P', 'half-Fe', 'absent-Fe', 'abundant', 'energy-limited'] as const) {
      const st = newChemStores(1);
      st.stores.set(biomassDemand(request * (kind === 'abundant' ? 2 : 1)));
      if (kind === 'half-P') st.stores[4] *= 0.5;
      if (kind === 'half-Fe') st.stores[6] *= 0.5;
      if (kind === 'absent-Fe') st.stores[6] = 0;
      const initial = Array.from(st.stores);
      const expected = request * (kind === 'absent-Fe' ? 0
        : kind.startsWith('half-') ? 0.5 : kind === 'energy-limited' ? 0.25 : 1);
      const budget = request * ENERGY_PER_CARBON * (kind === 'energy-limited' ? 0.25 : 2);
      const result = { carbon: 0, nutrientLimited: false, energyLimited: false };
      grow(st, 0, request, budget, DEFAULT_CHEM_CONFIG, result, new Float64Array(7));
      close(result.carbon, expected, `${kind} reported carbon`);
      for (let e = 0; e < 7; e++) {
        close(st.biomass[e], BIOMASS_STOICH[e] * expected, `${kind} element ${e} tissue`);
        close(initial[e] - st.stores[e], st.biomass[e], `${kind} element ${e} debit`);
        assert.ok(st.stores[e] >= -1e-12);
      }
      assert.ok(result.carbon * ENERGY_PER_CARBON <= budget + 1e-12);
      const measuredCarbon = result.carbon;
      const beforeRepeat = Array.from(st.biomass);
      if (kind === 'abundant') {
        grow(st, 0, request, budget, DEFAULT_CHEM_CONFIG, result, new Float64Array(7));
        close(result.carbon, request, 'second complement really exists');
      }
      if (kind !== 'energy-limited') {
        const depletedTissue = Array.from(st.biomass);
        grow(st, 0, request, budget, DEFAULT_CHEM_CONFIG, result, new Float64Array(7));
        close(result.carbon, 0, `${kind} cannot spend limiting stores twice`);
        for (let e = 0; e < 7; e++) close(st.biomass[e], depletedTissue[e], 'repeat tissue');
      }
      records.push({ kind, requestedCarbon: request, builtCarbon: measuredCarbon, expectedCarbon: expected,
        biomass: beforeRepeat, conserved: true, repeatCannotDoubleSpend: kind !== 'energy-limited' });
    }
  }
  return records;
}

export function chemicalReproductionCases() {
  for (const invalid of [-1, NaN, Infinity, -Infinity]) {
    assert.throws(() => new World({ config: { chemistryReproNutrientDemand: invalid } }),
      /chemistryReproNutrientDemand must be finite and non-negative/);
  }
  const records = [];
  for (const scale of [0.5, 1, 2]) for (const element of [0, 3, 4, 5, 6]) {
    for (const boundary of ['below', 'exact', 'above'] as const) {
      const st = newChemStores(1);
      st.biomass[0] = scale * 2;
      for (const e of [3, 4]) st.stores[e] = BIOMASS_STOICH[e] * scale * 2;
      for (const e of [5, 6]) st.stores[e] = BIOMASS_STOICH[e] * scale * COFACTOR_RESERVE * 2;
      const threshold = element === 0 ? scale : BIOMASS_STOICH[element] * scale
        * (element === 5 || element === 6 ? COFACTOR_RESERVE : 1);
      const amount = threshold * (boundary === 'below' ? 0.999999 : boundary === 'above' ? 1.000001 : 1);
      if (element === 0) st.biomass[0] = amount;
      else st.stores[element] = amount;
      const before = { stores: Array.from(st.stores), biomass: Array.from(st.biomass) };
      const result = canAffordOffspring(st, 0, { ...DEFAULT_CHEM_CONFIG, reproNutrientDemand: scale });
      assert.equal(result.ok, boundary !== 'below', `scale ${scale} element ${element} ${boundary}`);
      if (!result.ok) assert.equal(result.lacking, element === 0 ? 'carbon' : 'nutrient');
      assert.deepEqual({ stores: Array.from(st.stores), biomass: Array.from(st.biomass) }, before);
      records.push({ scale, element, boundary, threshold, ...result });
    }
  }
  return records;
}

export function chemicalLiveGrowthCases() {
  const w = new World({ config: { seed: 517, founders: 400, chemistry: true, genomeV2: true },
    chemBoundary: { capacity: 512 } });
  let consumed = 0;
  let charged = 0;
  let expectedBooked = 0;
  let quantizationBound = 0;
  let positiveGrowth = 0;
  for (let tick = 0; tick < 120; tick++) {
    w.step();
    const log = w.chemistryBoundaryTrace('chemistry')!;
    const fresh = log.counts.chemistry - consumed;
    assert.ok(fresh <= log.returned, 'no unread growth events may be lost');
    consumed = log.counts.chemistry;
    for (const event of fresh === 0 ? [] : log.events.slice(-fresh)) {
      const carbon = event.biomassAfter![0] - event.biomassBeforeGrowth![0];
      if (carbon > 1e-12) positiveGrowth++;
      for (let e = 0; e < 7; e++) {
        const tissue = event.biomassAfter![e] - event.biomassBeforeGrowth![e];
        close(tissue, BIOMASS_STOICH[e] * carbon, 'live valid tissue');
        close(event.storesBefore![e] + event.uptake![e] - event.storesAfter![e], tissue, 'live store debit');
      }
      const spent = event.energyBeforeGrowth! - event.energy!;
      const cost = carbon * ENERGY_PER_CARBON;
      // Legacy energy is Float32 storage: the actual debit is its rounded
      // representation, while the causal ledger books the Float64 charge.
      assert.equal(event.energy, Math.fround(event.energyBeforeGrowth! - cost), 'actual rounded net energy charge');
      expectedBooked += cost;
      quantizationBound += Math.abs(event.energyBeforeGrowth!) * 2 ** -23 + 2 ** -149;
      charged += spent;
    }
  }
  assert.ok(positiveGrowth > 0, 'live growth test must not pass vacuously');
  close(expectedBooked, w.chemistry!.flux.chemEnergySpent, 'valid tissue cost versus flux');
  close(expectedBooked, w.ledger.chemicalSpent, 'valid tissue cost versus causal ledger');
  assert.ok(Math.abs(charged - expectedBooked) <= quantizationBound, 'net charge differs only within Float32 rounding budget');
  return [{ seed: 517, ticks: w.tick, positiveGrowth, charged,
    flux: w.chemistry!.flux.chemEnergySpent, ledger: w.ledger.chemicalSpent, quantizationBound,
    hash: w.hashState(), perElementPostconditions: true }];
}
