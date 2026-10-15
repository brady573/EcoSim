import { World } from '../../build/world/world.js';
function build(seed, overrides={}) {
  return new World({ config: { founders:400, worldW:2400, worldH:2400, seed,
    consumerPhotoScale:0, consumerBasalScale:0.25, decomposerPhotoScale:0, decomposerFounders:0.25,
    decomposerDormancy:0.05, sporeDispersal:1, grazeYieldScale:1.0, plantYieldPerMass:0, radiation:null,
    foodDisease:0.15, pioneerBonus:null, dormantSenescence:null, dormantThreatBlind:null, mixotrophyCarbon:null,
    mixotrophySaturation:1.0, nutrientCyclic:true, producerCaptureScale:0.35, nutrientFloor:0.05, reproSurplusTicks:30,
    basalFoodPerCell:0.01, nutrientRegen:0.0002, excretionRate:0.06, meatYieldPerMass:0, bioticMineralisation:0.45,
    ...overrides } });
}
function run(seed, overrides, ticks=500) {
  const w = build(seed, overrides);
  for (let t=0;t<ticks;t++) w.step();
  const f = w.getFluxSnapshot();
  const sum = (a)=>a.flat(Infinity).reduce((x,y)=>x+y,0);
  const photo = sum(f.photoUptake);
  const exAcc = sum(f.excretionReturns.accepted);
  const bioAcc = sum(f.bioticMineralization.accepted);
  const abio = f.abioticRegen.reduce((a,b)=>a+b,0);
  let P=0,C=0,D=0;
  for (let i=0;i<w.store.count;i++){ if(!w.aliveAt(i)) continue; const g=w.roleOf(i).trophic; if(g===0)P++; else if(g===1)C++; else D++; }
  return {P,C,D,photo:photo.toFixed(1),exAcc:exAcc.toFixed(1),bioAcc:bioAcc.toFixed(1),abio:abio.toFixed(1),hash:w.hashState()};
}
const t0=Date.now();
for (const seed of [517, 41001]) {
  const a = run(seed, {}, 500);
  const b = run(seed, {bioticMineralisation:0}, 500);
  const c = run(seed, {excretionRate:0}, 500);
  console.log(`seed ${seed} CONTROL P${a.P}/C${a.C}/D${a.D} photo${a.photo} ex${a.exAcc} bio${a.bioAcc} abio${a.abio} hash${a.hash.slice(0,12)}`);
  console.log(`seed ${seed} NO_BIO   P${b.P}/C${b.C}/D${b.D} photo${b.photo} ex${b.exAcc} bio${b.bioAcc} abio${b.abio} hash${b.hash.slice(0,12)}`);
  console.log(`seed ${seed} NO_EXCR  P${c.P}/C${c.C}/D${c.D} photo${c.photo} ex${c.exAcc} bio${c.bioAcc} abio${c.abio} hash${c.hash.slice(0,12)}`);
}
console.log(`elapsed ${(Date.now()-t0)/1000}s`);
