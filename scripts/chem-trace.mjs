// Boundary-resolved tracer for chem/0.7.0.
// Books every pool transfer and samples both ledgers per tick so each boundary
// can be reconciled independently rather than only in aggregate.
import { World } from '../build/world/world.js';
import { POOL_RT as POOL, POOL_COMPOSITION, POOL_COUNT } from '../build/world/chemistry.js';
import { REACTIONS } from '../build/bio/metabolism.js';
import { runIdentity } from '../build/world/version.js';

const seed = Number(process.argv[2] ?? 517);
const TICKS = Number(process.argv[3] ?? 1000);
const EXTRA = process.argv[4] === 'freeNut' ? { chemistryFreeNutrients: true } : {};

const w = new World({ config: Object.assign(
  { seed, founders: 400, genomeV2: true, chemistry: true, label: 'tracer' }, EXTRA) });
const chem = w.chemistry, st = w.chemStores;

// Wrap react/claim so every pool debit and credit is captured at its source.
const N = chem.cols * chem.rows;
const delta = new Float64Array(POOL_COUNT);   // signed net per pool per tick
const oR = chem.react.bind(chem), oC = chem.claim.bind(chem);
chem.react = (p, c, a) => { delta[p] += a; return oR(p, c, a); };
chem.claim = (p, c, a) => { delta[p] -= a; return oC(p, c, a); };

const poolSum = p => { let s = 0; const f = chem.fields[p].data; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
// Element totals read the DECLARED composition table. The retired inline map
// here used the old flat conventions and mis-filed sulfide as phosphorus, so
// its P row over-counted by every mole of H2S and its S row missed the same
// amount. Every pool is now counted at its full declared content.
const elInPools = () => { const v = new Float64Array(7);
  for (let p = 0; p < POOL_COUNT; p++) {
    const s = poolSum(p);
    for (let e = 0; e < 7; e++) v[e] += s * POOL_COMPOSITION[p * 7 + e];
  }
  return v; };
const orgC = () => { let b = 0, s = 0;
  for (let sl = 0; sl < w.store.capacity; sl++) { if (!w.aliveAt(sl)) continue;
    b += st.biomass[sl * 7]; s += st.stores[sl * 7]; }
  return { b, s }; };
const orgE = () => new Float64Array(7);
const elInOrg = () => { const v = new Float64Array(7);
  for (let sl = 0; sl < w.store.capacity; sl++) { if (!w.aliveAt(sl)) continue;
    for (let e = 0; e < 7; e++) v[e] += st.biomass[sl * 7 + e] + st.stores[sl * 7 + e]; }
  return v; };

const birthsOf = () => w.demographics().births.flat().reduce((a, x) => a + x, 0);
const gen = () => { let mx = 0; for (let s = 0; s < w.store.capacity; s++) { if (w.aliveAt(s) && w.store.generationDepth[s] > mx) mx = w.store.generationDepth[s]; } return mx; };

let prevPhoto = 0;
const openPools = elInPools();
const openTissue = elInOrg();
let prevDelta = new Float64Array(POOL_COUNT);
const rows = [];
let prevBirths = birthsOf(), prevHunger = 0, prevEnergy = 0;
const cum = {
  weathering: 0, photosynthesisC: 0, assimilateC: 0, growthC: 0, reproC: 0, deathC: 0,
  excreteC: 0, burialC: 0, decayC: 0,
  legacyIncome: 0, legacySpend: 0, chemIncome: 0, chemSpend: 0,
  hungerDelta: 0, energyDelta: 0,
};
let prevBiomass = orgC().b, prevStores = orgC().s, prevBuilt = 0;

for (let t = 1; t <= TICKS; t++) {
  w.step();
  const co2 = chem.flux.co2In;
  cum.weathering += 0; // cumulative; sampled below

  // Reaction-attributed carbon. `extent` is a CUMULATIVE array, so it must be
  // differenced, not summed: adding the running total once per tick inflates a
  // 1000-tick run by a factor of ~1000.
  const pi = REACTIONS.findIndex(r => r.name === 'photosynthesis');
  const cur = w.chemEvidence.extent[pi] ?? 0;
  cum.photosynthesisC += Math.max(0, cur - prevPhoto);
  prevPhoto = cur;

  // Organic transfers booked from the measured buffer.
  cum.assimilateC += delta[POOL.OC] < 0 ? -delta[POOL.OC] : 0;   // pools -> stores
  cum.decayC += delta[POOL.OC] > 0 ? delta[POOL.OC] : 0;          // pools -> pools
  cum.burialC += delta[POOL.SC] > 0 ? delta[POOL.SC] : 0;
  cum.deathC += delta[POOL.ON] + delta[POOL.OP] + delta[POOL.OS] + delta[POOL.LC] + delta[POOL.LP] + delta[POOL.LS];
  if (delta[POOL.OC] < 0) cum.deathC -= delta[POOL.OC];

  const { b, s } = orgC();
  cum.growthC += w.chemistry.flux.chemCarbonBuilt - prevBuilt; prevBuilt = w.chemistry.flux.chemCarbonBuilt;
  cum.reproC += Math.max(0, (b - prevBiomass) === 0 ? 0 : 0);
  prevBiomass = b; prevStores = s;

  let ing = 0, sp = 0, hun = 0, en = 0, n = 0;
  for (let sl = 0; sl < w.store.capacity; sl++) { if (!w.aliveAt(sl)) continue; n++;
    ing += w.store.energyIngested[sl]; sp += w.store.energySpent[sl];
    hun += w.store.hunger[sl]; en += w.store.energy[sl]; }
  cum.legacyIncome += ing; cum.legacySpend += sp;
  if (n) { cum.hungerDelta += hun / n - prevHunger; cum.energyDelta += en / n - prevEnergy;
    prevHunger = hun / n; prevEnergy = en / n; }
  delta.fill(0);

  if (t % 200 === 0 || t === TICKS) {
    rows.push({ t, pop: w.store.population, gen: gen(), births: birthsOf() - prevBirths,
      bioC: b, storeC: s, oc: poolSum(POOL.OC), dic: poolSum(POOL.DIC),
      energy: n ? en / n : 0, hunger: n ? hun / n : 0,
      chemIncome: chem.flux.chemEnergyIncome, chemSpend: chem.flux.chemEnergySpent });
    prevBirths = birthsOf();
  }
}

const close = elInPools();
const org = elInOrg();
const held = k => close[k] + org[k];
// Weathering is PER ELEMENT. co2In is carbon and only carbon; adding it to the
// nitrogen account is what produced a -90% nitrogen residual in the first run of
// this tracer, which looked like a catastrophic leak and was a reporting error.
const accounted = k => openPools[k] + openTissue[k]
  + (k === 0 ? chem.flux.co2In : 0) + (k === 3 ? chem.flux.weatherN : 0)
  + (k === 4 ? chem.flux.weatherP : 0) + (k === 5 ? chem.flux.weatherS : 0)
  + (k === 6 ? chem.flux.weatherFe : 0);
const NAMES = ['C', 'H', 'O', 'N', 'P', 'S', 'Fe'];

console.log(`SEED ${seed}  TICKS ${TICKS}  IDENTITY ${runIdentity(true)}`
  + (EXTRA.chemistryFreeNutrients ? '  [free nutrients]' : ''));
console.log('\n--- trajectory ---');
console.log('tick   pop  gen  births   biomassC  storeC     OC     DIC   meanE  meanHunger  chemInc chemSpend');
for (const r of rows) console.log(
  String(r.t).padStart(5), String(r.pop).padStart(5), String(r.gen).padStart(4),
  String(r.births).padStart(7), r.bioC.toFixed(1).padStart(10), r.storeC.toFixed(1).padStart(8),
  r.oc.toFixed(1).padStart(8), r.dic.toFixed(1).padStart(8), r.energy.toFixed(2).padStart(7),
  r.hunger.toFixed(1).padStart(10), r.chemIncome.toFixed(0).padStart(8), r.chemSpend.toFixed(0).padStart(8));

console.log('\n--- CARBON BY BOUNDARY (mol) ---');
const carIn = openPools[0] + openTissue[0] + chem.flux.co2In;
const carHeld = close[0] + org[0];
console.log(`  weathering (CO2)          ${chem.flux.co2In.toFixed(2).padStart(12)}`);
console.log(`  photosynthesis (DIC->OC)  ${cum.photosynthesisC.toFixed(2).padStart(12)}`);
console.log(`  burial (OC->sediment)    ${cum.burialC.toFixed(2).padStart(12)}`);
console.log(`  pool->stores (assimilate)${(cum.assimilateC).toFixed(2).padStart(12)}`);
console.log(`  stores->biomass (growth)  ${cum.growthC.toFixed(2).padStart(12)}`);
console.log(`  released to pools (death) ${cum.deathC.toFixed(2).padStart(12)}`);
console.log(`  opening pools             ${openPools[0].toFixed(2).padStart(12)}`);
console.log(`  opening founder tissue    ${openTissue[0].toFixed(2).padStart(12)}`);
console.log(`  CLOSING held carbon       ${carHeld.toFixed(2).padStart(12)}   (pools ${close[0].toFixed(1)} + biomass ${org[0].toFixed(1)})`);
console.log(`  residual                  ${(carHeld - carIn).toFixed(2).padStart(12)}`);

console.log('\n--- ENERGY BY SOURCE ---');
const ei = chem.flux.chemEnergyIncome, es = chem.flux.chemEnergySpent;
console.log(`  legacy income  ${cum.legacyIncome.toFixed(0).padStart(12)}`);
console.log(`  legacy spend   ${cum.legacySpend.toFixed(0).padStart(12)}`);
console.log(`  legacy net     ${(cum.legacyIncome - cum.legacySpend).toFixed(0).padStart(12)}`);
console.log(`  chemical income${ei.toFixed(0).padStart(12)}   (${(100 * ei / Math.max(1, cum.legacyIncome)).toFixed(4)}% of legacy)`);
console.log(`  chemical spend ${es.toFixed(0).padStart(12)}`);
console.log(`  chemical net   ${(ei - es).toFixed(0).padStart(12)}`);

console.log('\n--- HUNGER AND DEATH ---');
console.log(`  mean hunger ${rows[rows.length - 1].hunger.toFixed(1)}  (organisms above the 400 starvation threshold are counted at death)`);
const d = w.deathReasons();
console.log(`  deaths: starve ${d.starve}  age ${d.age}  damage ${d.damage}   total ${d.starve + d.age + d.damage}`);
console.log(`  births ${birthsOf()}  net ${birthsOf() - (d.starve + d.age + d.damage)}  final pop ${w.store.population}`);

console.log('\n--- ALL-ELEMENT CONSERVATION ---');
for (let k = 0; k < 7; k++) {
  // H and O are NOT printed by this tracer. Its `accounted()` carries only the
  // legacy per-element boundary terms (CO2, weathering); the water reservoir
  // top-up, the two declared gas vents and the reservoir sink are not in it, so
  // an H/O row here would report the tracer's gaps rather than the engine's.
  // The world audit — elementTotal against the declared boundaries, G27 — is
  // the H/O authority. For the printed elements the same caveat applies to the
  // declared N2/H2 vents and ablation removals.
  if (NAMES[k] === 'H' || NAMES[k] === 'O') continue;
  const h = held(k), a = accounted(k);
  console.log(`  ${NAMES[k].padEnd(3)} held ${h.toFixed(2).padStart(10)}  accounted ${a.toFixed(2).padStart(10)}  residual ${((100 * (h - a)) / a).toFixed(4)}%`);
}