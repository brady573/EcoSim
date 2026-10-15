import { World } from '../../build/world/world.js';
import { TROPHIC } from '../../build/bio/role.js';
function build(seed, overrides={}) {
  return new World({ config: { founders:400, worldW:2400, worldH:2400, seed,
    consumerPhotoScale:0, consumerBasalScale:0.25, decomposerPhotoScale:0, decomposerFounders:0.25,
    decomposerDormancy:0.05, sporeDispersal:1, grazeYieldScale:1.0, plantYieldPerMass:0, radiation:null,
    foodDisease:0.15, pioneerBonus:null, dormantSenescence:null, dormantThreatBlind:null, mixotrophyCarbon:null,
    mixotrophySaturation:1.0, nutrientCyclic:true, producerCaptureScale:0.35, nutrientFloor:0.05, reproSurplusTicks:30,
    basalFoodPerCell:0.01, nutrientRegen:0.0002, excretionRate:0.06, meatYieldPerMass:0, bioticMineralisation:0.45,
    ...overrides } });
}
for (const seed of [517]) {
  const w = build(seed);
  for (let t=0;t<500;t++) w.step();
  const f = w.getFluxSnapshot();
  // per-guild biotic accepted totals
  for (let g=0; g<3; g++) {
    const tot = f.bioticMineralization.accepted[g].flat(Infinity).reduce((a,b)=>a+b,0);
    console.log(`seed ${seed} guild ${g} bioAccepted ${tot.toFixed(1)}`);
  }
  // phenotype census of live mineralisers
  let minCount=[0,0,0], minMobile=0, minSessile=0;
  let totMin=0;
  for (let i=0;i<w.store.count;i++) {
    if(!w.aliveAt(i)) continue;
    const m = w.bioticMineraliser[i]===1;
    if(!m) continue;
    totMin++;
    const g=w.roleOf(i).trophic;
    minCount[g]++;
  }
  console.log(`mineralisers live: total ${totMin} P/C/D=${minCount.join('/')}`);
  // pool totals vs caps
  const nuts = w.nutrients.map(n=>n.data.reduce((a,b)=>a+b,0));
  console.log(`nutrient totals ${nuts.map(x=>x.toFixed(0)).join(',')}`);
  // observer nonperturbation on experimental config: two builds same seed, one with extra hash reads?
  const w2 = build(seed);
  for (let t=0;t<500;t++) { w2.step(); if(t%100===0) w2.hashState(); }
  console.log(`hash w ${w.hashState().slice(0,16)} w2 ${w2.hashState().slice(0,16)} equal=${w.hashState()===w2.hashState()}`);
}
