import { World as W063 } from '/root/EcoSim-issue15/build/world/world.js';
import { World as W064 } from '/root/EcoSim-o3/build/world/world.js';
const CFG = (seed) => ({ founders:400, worldW:2400, worldH:2400, seed,
  consumerPhotoScale:0, consumerBasalScale:0.25, decomposerPhotoScale:0, decomposerFounders:0.25,
  decomposerDormancy:0.05, sporeDispersal:1, grazeYieldScale:1.0, plantYieldPerMass:0, radiation:null,
  foodDisease:0.15, pioneerBonus:null, dormantSenescence:null, dormantThreatBlind:null, mixotrophyCarbon:null,
  mixotrophySaturation:1.0, nutrientCyclic:true, producerCaptureScale:0.35, nutrientFloor:0.05, reproSurplusTicks:30,
  basalFoodPerCell:0.01, nutrientRegen:0.0002, excretionRate:0.06, meatYieldPerMass:0, bioticMineralisation:0.45 });
const flat = (a) => a.flat(Infinity);
for (const seed of [517, 41001]) {
  const a = new W063({ config: CFG(seed) });
  const b = new W064({ config: CFG(seed) });
  const da = [], db = [];
  for (let t = 1; t <= 500; t++) { a.step(); b.step(); if (t % 100 === 0) { da.push(a.hashState()); db.push(b.hashState()); } }
  const digestsEqual = da.every((d, i) => d === db[i]);
  const fa = a.getFluxSnapshot(), fb = b.getFluxSnapshot();
  let guildMismatch = 0;
  for (const fam of ['excretionReturns', 'bioticMineralization'])
    for (const book of ['attempted', 'accepted', 'capLoss', 'eviction']) {
      const A = flat(fa[fam][book]), B = flat(fb[fam][book]);
      A.forEach((v, i) => { if (v !== B[i]) guildMismatch++; });
    }
  let P = [0,0,0];
  for (const w of [a]) for (let i = 0; i < w.store.count; i++) { if (!w.aliveAt(i)) continue; P[w.roleOf(i).trophic]++; }
  console.log(`seed ${seed} digests5x=${digestsEqual} guildBooksMismatch=${guildMismatch} census=P${P[0]}/C${P[1]}/D${P[2]}`);
}
