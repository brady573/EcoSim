// Pre-registered cohort runner for chem/0.7.0.
// Reads PREREGISTRATION.md hypotheses H1-H7. Writes results only from measured data.
import { World } from '../build/world/world.js';
import { REACTIONS, RX_COUNT } from '../build/bio/metabolism.js';
import { runIdentity } from '../build/world/version.js';

const SEEDS = [517, 1013, 24601, 7, 99, 31337, 4242, 8080, 555, 12345];
const TICKS = Number(process.argv[2] ?? 1000);

function births(w) { return w.demographics().births.flat().reduce((a, x) => a + x, 0); }

function run(seed, ticks, extra = {}) {
  const w = new World({ config: Object.assign(
    { seed, founders: 400, genomeV2: true, chemistry: true, label: 'chem-cohort' }, extra) });
  const b0 = births(w);
  let pop = [];
  for (let i = 0; i < ticks; i++) {
    w.step();
    if (i % 100 === 99) pop.push(w.store.population);
  }
  const ext = Array.from(w.chemEvidence.extent);
  return {
    seed, births: births(w) - b0, pop: w.store.population, series: pop,
    nutLim: w.chemNutrientLimited, enLim: w.chemEnergyLimited,
    nb: w.chemReproBlockedNutrient, cb: w.chemReproBlockedCarbon,
    hypoxia: w.chemAudit.hypoxicFraction,
    carbonBuilt: w.chemistry.flux.chemCarbonBuilt,
    ext, capFe: countCap(w), startPop: 400,
  };
}
function countCap(w) {
  const st = w.chemStores, bit = 1 << 7; let y = 0, n = 0;
  for (let s = 0; s < w.store.capacity; s++) { if (!w.aliveAt(s)) continue; n++; if (st.capMask[s] & bit) y++; }
  return { y, n };
}
const stats = a => { const s = [...a].sort((x, y) => x - y); const m = s.reduce((x, y) => x + y, 0) / s.length;
  return { min: s[0], max: s[s.length - 1], mean: m, med: s[(s.length / 2) | 0] }; };
const f = (n, d = 2) => Number(n).toFixed(d);

console.log('IDENTITY:', runIdentity(true), '| seeds:', SEEDS.length, '| ticks:', TICKS, '\n');

const arms = {
  base: (s) => () => run(s, TICKS),
  noNutrients: (s) => () => run(s, TICKS, { chemistryNoNutrients: true }),
  noChemo: (s) => () => run(s, TICKS, { chemistryNoChemosynthesis: true }),
  noAnaerobic: (s) => () => run(s, TICKS, { chemistryNoAnaerobic: true }),
  noNitrogen: (s) => () => run(s, TICKS, { chemistryNoNitrogenCycle: true }),
  chemOff: (s) => () => { const w = new World({ config: { seed: s, founders: 400, label: 'chem-cohort' } }); for (let i = 0; i < TICKS; i++) w.step(); return { seed: s, pop: w.store.population }; },
};

console.log('--- H1/H2/H7 arm comparison (per-seed) ---');
console.log('arm            ' + SEEDS.map(s => String(s).padStart(7)).join(''));
const summary = {};
for (const [name, mk] of Object.entries(arms)) {
  const rows = [];
  for (const s of SEEDS) rows.push(mk(s)());
  summary[name] = rows;
  const cells = rows.map(r => (r.births !== undefined ? r.births : r.pop).toString().padStart(7)).join('');
  console.log(name.padEnd(15) + cells);
}
console.log('\n(value shown: births for chemistry arms, final population for chemOff)\n');

console.log('--- H1 nutrient vs energy limitation ---');
const nl = stats(summary.base.map(r => r.nutLim)), el = stats(summary.base.map(r => r.enLim));
console.log(`nutrientLimited  min ${f(nl.min)} med ${f(nl.med)} max ${f(nl.max)}`);
console.log(`energyLimited    min ${f(el.min)} med ${f(el.med)} max ${f(el.max)}`);
const ratios = summary.base.map(r => r.nutLim / Math.max(1, r.enLim));
console.log(`ratio med ${f(stats(ratios).med, 1)}  min ${f(stats(ratios).min, 1)}  max ${f(stats(ratios).max, 1)}`);
console.log(`seeds where nutrient-limited exceeds energy-limited >10x: ${ratios.filter(r => r > 10).length}/${SEEDS.length}`);

console.log('\n--- H2 nutrient-starved reproduction (counterfactual) ---');
const bFed = stats(summary.base.map(r => r.births));
const bStv = stats(summary.noNutrients.map(r => r.births));
console.log(`nutrients present : births min ${bFed.min} med ${bFed.med} max ${bFed.max}  (${summary.base.filter(r => r.births > 0).length}/${SEEDS.length} seeds nonzero)`);
console.log(`nutrients removed : births min ${bStv.min} med ${bStv.med} max ${bStv.max}  (${summary.noNutrients.filter(r => r.births > 0).length}/${SEEDS.length} seeds nonzero)`);

console.log('\n--- H3 anaerobic realized opportunity ---');
const ana = ['fermentation', 'sulfate reduction', 'denitrification'];
for (const n of ana) {
  const i = REACTIONS.findIndex(r => r.name === n);
  const e = summary.base.map(r => r.ext[i]);
  console.log(`${n.padEnd(20)} nonzero on ${e.filter(v => v > 0).length}/${SEEDS.length} seeds  median ${f(stats(e).med, 3)}`);
}
const hx = summary.base.map(r => r.hypoxia);
console.log(`hypoxic fraction  nonzero on ${hx.filter(v => v > 0).length}/${SEEDS.length} seeds  max ${f(stats(hx).max, 5)}`);

console.log('\n--- H4 chemosynthesis ---');
for (const n of ['sulfur oxidation', 'iron oxidation', 'photosynthesis']) {
  const i = REACTIONS.findIndex(r => r.name === n);
  const e = summary.base.map(r => r.ext[i]);
  console.log(`${n.padEnd(20)} nonzero on ${e.filter(v => v > 0).length}/${SEEDS.length} seeds  median ${f(stats(e).med, 2)}`);
}
console.log(`carbon built by chemistry path: median ${f(stats(summary.base.map(r => r.carbonBuilt)).med, 1)} mol`);

console.log('\n--- H5 capability heritability ---');
const seg = summary.base.map(r => r.capFe.y > 0 && r.capFe.y < r.capFe.n);
console.log(`iron-uptake capability segregates on ${seg.filter(Boolean).length}/${SEEDS.length} seeds`);
console.log(`per-seed (with/total): ${summary.base.map(r => `${r.capFe.y}/${r.capFe.n}`).join('  ')}`);

console.log('\n--- ablation arms ---');
for (const n of ['base', 'noChemo', 'noAnaerobic', 'noNitrogen', 'chemOff']) {
  const r = summary[n];
  const p = stats(r.map(x => x.pop));
  const b = r.map(x => x.births ?? 0);
  console.log(`${n.padEnd(14)} pop med ${f(p.med, 0).padStart(5)}  [${f(p.min, 0)}..${f(p.max, 0)}]  births med ${f(stats(b).med, 0).padStart(5)}  carbonBuilt med ${f(stats(r.map(x => x.carbonBuilt ?? 0)).med, 1)}`);
}

console.log('\n--- H7 terminal population vs 400 founders ---');
const decline = summary.base.filter(r => r.pop < 400).length;
console.log(`seeds ending BELOW 400 founders: ${decline}/${SEEDS.length}  -> H7 ${decline >= 6 ? 'SUPPORTED' : 'FALSIFIED'}`);
console.log(`median terminal population ${f(stats(summary.base.map(r => r.pop)).med, 0)}`);