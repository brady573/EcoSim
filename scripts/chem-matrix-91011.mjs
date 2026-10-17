// H9/H10/H11 re-run under ts-evo-poc/0.7.0.
// Pre-declaration: PREDECLARATION-H9H10-070.md. Seeds/horizon fixed there.
import { World } from '../build/world/world.js';
import { POOL_RT } from '../build/world/chemistry.js';
import { runIdentity } from '../build/world/version.js';

const SEEDS = [517, 1013, 24601, 7, 99];
const TICKS = Number(process.argv[2] ?? 1000);

function births(w) { return w.demographics().births.flat().reduce((a, x) => a + x, 0); }

function poolTotal(chem, p) {
  const d = chem.fields[p].data;
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i];
  return s;
}

function run(seed, extra = {}) {
  const w = new World({ config: Object.assign(
    { seed, founders: 400, genomeV2: true, chemistry: true, label: 'chem-91011' }, extra) });
  const b0 = births(w);
  for (let i = 0; i < TICKS; i++) w.step();
  const chem = w.chemistry;
  const det = (w).detritus.data;
  let detTotal = 0;
  for (let i = 0; i < det.length; i++) detTotal += det[i];
  return {
    seed,
    births: births(w) - b0,
    pop: w.store.population,
    oc: poolTotal(chem, POOL_RT.OC),
    dic: poolTotal(chem, POOL_RT.DIC),
    detritus: detTotal,
    carbonBuilt: w.chemistry.flux.chemCarbonBuilt,
  };
}

function stats(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = s.reduce((x, y) => x + y, 0) / s.length;
  return { min: s[0], max: s[s.length - 1], med: s.length % 2 ? s[s.length >> 1] : (s[(s.length / 2) - 1] + s[s.length / 2]) / 2 };
}
const f = (n, d = 1) => Number(n).toFixed(d);

console.log('IDENTITY:', runIdentity(true), '| seeds:', SEEDS.length, '| ticks:', TICKS, '\n');

const arms = {
  base: () => ({}),
  'H9 scale 3': () => ({ chemistryCo2WeatheringScale: 3 }),
  'H9 scale 10': () => ({ chemistryCo2WeatheringScale: 10 }),
  'H9 scale 30': () => ({ chemistryCo2WeatheringScale: 30 }),
  'H10 bridge': () => ({ chemistryToLegacyDetritus: true }),
  'H11 both': () => ({ chemistryCo2WeatheringScale: 30, chemistryToLegacyDetritus: true }),
  'ref freeNutrients': () => ({ chemistryFreeNutrients: true }),
  chemOff: null,
};

const rows = {};
for (const [name, mk] of Object.entries(arms)) {
  const r = [];
  for (const s of SEEDS) {
    if (mk === null) {
      const w = new World({ config: { seed: s, founders: 400, label: 'chem-91011' } });
      for (let i = 0; i < TICKS; i++) w.step();
      r.push({ seed: s, pop: w.store.population });
    } else {
      r.push(run(s, mk()));
    }
  }
  rows[name] = r;
  const pops = stats(r.map(x => x.pop));
  const birthsA = stats(r.map(x => x.births ?? 0));
  const ocA = stats(r.map(x => x.oc ?? 0));
  const dicA = stats(r.map(x => x.dic ?? 0));
  const detA = stats(r.map(x => x.detritus ?? 0));
  console.log(
    name.padEnd(18)
    + ` pop med ${f(pops.med, 0).padStart(5)} [${f(pops.min, 0)}..${f(pops.max, 0)}]`
    + `  births med ${f(birthsA.med, 0).padStart(5)}`
    + `  OC med ${f(ocA.med, 0).padStart(7)}  DIC med ${f(dicA.med, 0).padStart(9)}`
    + `  legacyDetritus med ${f(detA.med, 0).padStart(7)}`,
  );
}

// Byte-distinct check between each intervention arm and base (pop + OC + DIC signature).
const sig = (r) => r.map(x => `${x.pop}|${Math.round(x.oc ?? 0)}|${Math.round(x.dic ?? 0)}`).join(',');
const baseSig = sig(rows.base);
console.log('\n--- arms-differ check vs base (pop/OC/DIC signature) ---');
for (const [name, r] of Object.entries(rows)) {
  if (name === 'base') continue;
  const same = sig(r) === baseSig;
  console.log(`${name.padEnd(18)} ${same ? 'IDENTICAL to base' : 'distinct'}`);
}
