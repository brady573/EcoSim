// Multi-seed ecology comparison. Composition, generations, births, deaths,
// conservation and performance -- not final population alone.
import { World } from '../build/world/world.js';
import { POOL_RT as POOL } from '../build/world/chemistry.js';
import { runIdentity } from '../build/world/version.js';

const SEEDS = [517, 1013, 24601, 7, 99, 31337, 4242, 8080, 555, 12345];
const TICKS = Number(process.argv[2] ?? 1000);
const med = a => { const s = [...a].sort((x, y) => x - y); return s[(s.length / 2) | 0]; };
const rng = a => `${Math.min(...a)}-${Math.max(...a)}`;

function run(seed, chemOn, extra = {}) {
  const cfg = Object.assign(
    chemOn ? { seed, founders: 400, genomeV2: true, chemistry: true, label: 'eco' } : { seed, founders: 400, label: 'eco' },
    extra);
  const w = new World({ config: cfg });
  const t0 = Date.now();
  for (let i = 0; i < TICKS; i++) w.step();
  const ms = Date.now() - t0;
  const d = w.deathReasons();
  const hist = w.demographics();
  const guild = [0, 1, 2].map(g => w.store.population > 0 ? Math.round(hist.births[g][0] + hist.births[g][1]) : 0);
  let maxGen = 0, n = 0, sumGen = 0;
  for (let s = 0; s < w.store.capacity; s++) { if (!w.aliveAt(s)) continue; n++; sumGen += w.store.generationDepth[s];
    if (w.store.generationDepth[s] > maxGen) maxGen = w.store.generationDepth[s]; }
  const res = {
    seed, pop: w.store.population,
    births: hist.births.flat().reduce((a, x) => a + x, 0),
    asexual: hist.births.map(b => b[0]).reduce((a, x) => a + x, 0),
    sexual: hist.births.map(b => b[1]).reduce((a, x) => a + x, 0),
    starve: d.starve, age: d.age, damage: d.damage, guild,
    maxGen, meanGen: n ? sumGen / n : 0,
    meanAgeAtDeath: hist.meanAgeAtDeath.map(x => (x === null ? null : Math.round(x))),
    cons: null, tps: TICKS / (ms / 1000),
  };
  if (chemOn) {
    const a = w.chemAudit;
    const pe = k => { const h = a.biomass[k] + a.stores[k] + a.environment[k];
      const acc = a.initial[k] + a.inputs[k] - a.outputs[k];
      return Math.abs(acc) > 1e-9 ? Math.abs(100 * (h - acc) / acc) : 0; };
    res.cons = [pe(0), pe(3), pe(4), pe(5), pe(6)];  // C N P S Fe
  }
  return res;
}

const arms = [
  ['chemistry ON ', true, {}],
  ['free nutrients', true, { chemistryFreeNutrients: true }],
  ['chemistry OFF', false, {}],
];
console.log(`IDENTITY ${runIdentity(true)} | ${SEEDS.length} seeds | ${TICKS} ticks\n`);
for (const [name, on, extra] of arms) {
  const r = SEEDS.map(s => run(s, on, extra));
  const tot = k => r.reduce((a, x) => a + x[k], 0);
  console.log(`--- ${name} ---`);
  console.log(`  population        median ${String(med(r.map(x => x.pop))).padStart(5)}  range ${rng(r.map(x => x.pop))}  declining-vs-400: ${r.filter(x => x.pop < 400).length}/${SEEDS.length}`);
  console.log(`  births total      ${String(tot('births')).padStart(6)}   asexual ${tot('asexual')}  sexual ${tot('sexual')}`);
  console.log(`  guild births P/C/D ${r.map(x => x.guild.join('/')).join('  ')}`);
  console.log(`  deaths            ${String(tot('starve')).padStart(5)} starve  ${String(tot('age')).padStart(4)} age  ${String(tot('damage')).padStart(4)} damage`);
  console.log(`  generations       max ${Math.max(...r.map(x => x.maxGen))}  mean ${(r.reduce((a, x) => a + x.meanGen, 0) / r.length).toFixed(2)}  per-seed max ${r.map(x => x.maxGen).join('')}`);
  console.log(`  mean age at death ${JSON.stringify(r[0].meanAgeAtDeath)} (producer/consumer/decomposer, seed ${SEEDS[0]})`);
  if (r[0].cons) console.log(`  conservation |residual| %  C ${med(r.map(x => x.cons[0])).toFixed(4)}  N ${med(r.map(x => x.cons[1])).toFixed(4)}  P ${med(r.map(x => x.cons[2])).toFixed(4)}  S ${med(r.map(x => x.cons[3])).toFixed(4)}  Fe ${med(r.map(x => x.cons[4])).toFixed(4)}`);
  console.log(`  performance       ${med(r.map(x => x.tps)).toFixed(1)} ticks/s median  ${rng(r.map(x => Math.round(x.tps)))}`);
  console.log('');
}