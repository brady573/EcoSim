import { World } from '../build/world/world.js';
import { runIdentity } from '../build/world/version.js';

const SEEDS = [517, 1013, 24601, 7, 99];
const TICKS = Number(process.argv[2] ?? 1000);

function run(seed, extra = {}) {
  const w = new World({ config: Object.assign(
    { seed, founders: 400, genomeV2: true, chemistry: true, label: 'chem-predation-knob' }, extra) });
  const b0 = w.demographics().births.flat().reduce((a,x)=>a+x,0);
  for (let i = 0; i < TICKS; i++) w.step();
  const b1 = w.demographics().births.flat().reduce((a,x)=>a+x,0);
  const a = w.chemAudit;
  const Cres = a ? ((a.biomass[0]+a.stores[0]+a.environment[0])-(a.initial[0]+a.inputs[0]-a.outputs[0])) / Math.abs(a.initial[0]+a.inputs[0]-a.outputs[0]) : 0;
  return { seed, births: b1-b0, pop: w.store.population, cb: w.predationMatterCarbon, cres: Cres, clamp: w.chemistry.totalClamped() };
}
const st = (a)=>{const s=[...a].sort((x,y)=>x-y);const m=s.reduce((x,y)=>x+y,0)/s.length;return{med:s[(s.length/2)|0],min:s[0],max:s[s.length-1],mean:m};};
const f=(n,d=0)=>Number(n).toFixed(d);

console.log('IDENTITY:',runIdentity(true),'seeds:',SEEDS.length,'ticks:',TICKS);
for (const name of ['base','predationMatter']) {
  const rows = SEEDS.map(s => run(s, name==='predationMatter' ? {chemistryPredationMatter:true} : {}));
  console.log(`--- ${name} ---`);
  for (const r of rows) console.log(` seed ${r.seed}: pop ${f(r.pop,0)} births ${f(r.births,0)} matterC ${f(r.cb,4)} C residual ${f(r.cres*100,4)}% clamp ${f(r.clamp,3)}`);
  const pops = st(rows.map(r=>r.pop));
  const mats = st(rows.map(r=>r.cb));
  const cres = st(rows.map(r=>r.cres));
  console.log(`${name}: pop med ${f(pops.med,0)} [${f(pops.min,0)}..${f(pops.max,0)}] | births med ${f(st(rows.map(r=>r.births)).med,0)} | matterC med ${f(mats.med,4)} | C residual med ${f(cres.med*100,4)}%`);
}
