// Pre-registered cohort runner. Emits every figure the verdict documents quote,
// including per-guild births and generation depth, so the three-guild
// coexistence and Generations claims are measured rather than carried over.
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
  // chemistry-off worlds have no chemistry objects at all.
  const ext = w.chemEvidence ? Array.from(w.chemEvidence.extent) : new Array(RX_COUNT).fill(0);
  // Per-guild births, indexed [guild][path] where path 0 = asexual, 1 = sexual.
  // Guild 2 is the decomposer: the three-guild coexistence question is whether
  // it reproduces at all. These were previously quoted from a retired panel.
  const guildBirths = w.demographics().births.map((g) => ({ asex: g[0], sex: g[1] }));
  // Generation depth over LIVE organisms: sexual children increment depth.
  let gdMax = 0, gdSum = 0, gdN = 0;
  for (let sl = 0; sl < w.store.capacity; sl++) {
    if (!w.aliveAt(sl)) continue;
    const d = w.store.generationDepth[sl];
    gdMax = Math.max(gdMax, d); gdSum += d; gdN++;
  }
  const sexualBirths = guildBirths.reduce((a, g) => a + g.sex, 0);
  const asexBirths = guildBirths.reduce((a, g) => a + g.asex, 0);
  return {
    seed, births: births(w) - b0, pop: w.store.population, series: pop,
    nutLim: w.chemNutrientLimited, enLim: w.chemEnergyLimited,
    nb: w.chemReproBlockedNutrient, cb: w.chemReproBlockedCarbon,
    chemAuditOk: w.chemAudit !== null,
    // chemAudit is null when chemistry is off; the OFF arm must still run.
    hypoxia: w.chemAudit ? w.chemAudit.hypoxicFraction : 0,
    carbonBuilt: w.chemistry ? w.chemistry.flux.chemCarbonBuilt : 0,
    ext, capFe: countCap(w), startPop: 400,
    guildBirths, sexualBirths, asexBirths,
    gdMax, gdMean: gdN > 0 ? gdSum / gdN : 0,
  };
}
function countCap(w) {
  if (!w.chemStores) return { y: 0, n: 0 };
  const st = w.chemStores, bit = 1 << 7; let y = 0, n = 0;
  for (let s = 0; s < w.store.capacity; s++) { if (!w.aliveAt(s)) continue; n++; if (st.capMask[s] & bit) y++; }
  return { y, n };
}
const stats = a => { const s = [...a].sort((x, y) => x - y); const m = s.reduce((x, y) => x + y, 0) / s.length;
  return { min: s[0], max: s[s.length - 1], mean: m, med: s.length % 2 ? s[s.length >> 1] : (s[(s.length / 2) - 1] + s[s.length / 2]) / 2 }; };
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

// --- Three-guild coexistence and generation depth (measured here, not carried over) ---
console.log('\n--- guild births, reproduction pathway and generation depth ---');
const armsForGuild = [
  ['base', {}],
  ['chemOff', { chemistry: false }],
];
for (const [name, extra] of armsForGuild) {
  // run(seed, ticks, extra) — the horizon must be passed explicitly; passing
  // the config object as `ticks` silently runs ZERO ticks and reports all-zero
  // guild births, which reads exactly like a real null result.
  const rows = SEEDS.map((sd) => run(sd, TICKS, extra));
  const nDecomp = rows.filter((r) => r.guildBirths[2].asex + r.guildBirths[2].sex > 0).length;
  const nProd = rows.filter((r) => r.guildBirths[0].asex + r.guildBirths[0].sex > 0).length;
  const nCons = rows.filter((r) => r.guildBirths[1].asex + r.guildBirths[1].sex > 0).length;
  const sexTot = rows.reduce((a, r) => a + r.sexualBirths, 0);
  const asexTot = rows.reduce((a, r) => a + r.asexBirths, 0);
  console.log(`${name.padEnd(8)} producer births on ${nProd}/10 | consumer ${nCons}/10 | DECOMPOSER ${nDecomp}/10`);
  console.log(`${name.padEnd(8)} asexual births total ${asexTot} | sexual births total ${sexTot}`
    + ` | max gd ${stats(rows.map((r) => r.gdMax)).max}`
    + ` | mean gd ${stats(rows.map((r) => r.gdMean)).mean.toFixed(3)}`);
}
