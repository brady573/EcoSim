// Post-hoc diagnostic: predation-matter ride-along vs base chemistry.
import { World } from '../build/world/world.js';
import { runIdentity } from '../build/world/version.js';

const SEEDS = [517, 1013, 24601, 7, 99, 31337, 4242, 8080, 555, 12345];
const TICKS = Number(process.argv[2] ?? 1000);

const birthsTotal = (w) => w.demographics().births.flat().reduce((a, x) => a + x, 0);
const sexualBirths = (w) => w.demographics().births.reduce((a, g) => a + g[1], 0);

function run(seed, extra = {}) {
  const w = new World({ config: Object.assign(
    { seed, founders: 400, genomeV2: true, chemistry: true, label: 'chem-predation-knob' }, extra) });
  const b0 = birthsTotal(w);
  const sex0 = sexualBirths(w);
  for (let i = 0; i < TICKS; i++) w.step();
  const b1 = birthsTotal(w);
  const sex1 = sexualBirths(w);
  const a = w.chemAudit;
  const Cres = a ? ((a.biomass[0] + a.stores[0] + a.environment[0])
    - (a.initial[0] + a.inputs[0] - a.outputs[0]))
    / Math.abs(a.initial[0] + a.inputs[0] - a.outputs[0]) : 0;
  let gdMax = 0, gdSum = 0, gdN = 0;
  for (let sl = 0; sl < w.store.capacity; sl++) {
    if (!w.aliveAt(sl)) continue;
    const d = w.store.generationDepth[sl];
    gdMax = Math.max(gdMax, d); gdSum += d; gdN++;
  }
  return {
    seed, births: b1 - b0, sexualBirths: sex1 - sex0,
    pop: w.store.population, cb: w.predationMatterCarbon,
    cres: Cres, clamp: w.chemistry.totalClamped(),
    gdMax, gdMean: gdN ? gdSum / gdN : 0, gdN,
  };
}
const st = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.reduce((x, y) => x + y, 0) / s.length;
  return { med: s.length % 2 ? s[s.length >> 1] : (s[(s.length / 2) - 1] + s[s.length / 2]) / 2, min: s[0], max: s[s.length - 1], mean: m }; };
const f = (n, d = 0) => Number(n).toFixed(d);

console.log('IDENTITY:', runIdentity(true), 'seeds:', SEEDS.length, 'ticks:', TICKS);
for (const name of ['base', 'predationMatter']) {
  const rows = SEEDS.map(s => run(s, name === 'predationMatter' ? { chemistryPredationMatter: true } : {}));
  const pops = st(rows.map(r => r.pop));
  const mats = st(rows.map(r => r.cb));
  const cres = st(rows.map(r => r.cres));
  console.log(`--- ${name} ---`);
  for (const r of rows) console.log(` seed ${r.seed}: pop ${f(r.pop)} births ${f(r.births)} (sex ${f(r.sexualBirths)}) `
    + `matterC ${f(r.cb, 4)} C residual ${f(r.cres * 100, 4)}% clamp ${f(r.clamp, 3)} `
    + `gdMax ${f(r.gdMax)} gdMean ${f(r.gdMean, 3)}`);
  console.log(`${name}: pop med ${f(pops.med)} [${f(pops.min)}..${f(pops.max)}] | births med ${f(st(rows.map(r => r.births)).med)} `
    + `(sex med ${f(st(rows.map(r => r.sexualBirths)).med)}) | matterC med ${f(mats.med, 4)} | C residual med ${f(cres.med * 100, 4)}% `
    + `| gdMax ${f(st(rows.map(r => r.gdMax)).max)} gdMean ${f(st(rows.map(r => r.gdMean)).mean, 3)}`);
}
