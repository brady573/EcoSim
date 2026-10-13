/**
 * NUTRIENT FLUX AUDIT — per-pool, per-guild, per-process flow measurement
 * Measures: photosynthesis uptake, excretion returns, biotic mineralization,
 * abiotic regeneration, abiotic mineralization — separated by guild, pool, and source.
 *
 * Engine: ts-evo-poc/0.6.2
 * Run: node build/trace/nutrientflux.js [ticks] [seed]
 */
import { World } from '../world/world.js';
import { TROPHIC_COUNT } from '../bio/role.js';
import { NUTRIENT_COUNT } from '../core/soa.js';
import { TROPHIC } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 2000);
if (!Number.isFinite(TICKS) || TICKS <= 0) throw new Error(`bad ticks: ${process.argv[2]}`);
const SEED = Number(process.argv[3] ?? 517);
if (!Number.isFinite(SEED) || SEED <= 0) throw new Error(`bad seed: ${process.argv[3]}`);

const SAMPLE_EVERY = 500;

function buildWorld(seed: number): World {
  return new World({
    config: {
      founders: 400, worldW: 2400, worldH: 2400, seed,
      consumerPhotoScale: 0, consumerBasalScale: 0.25,
      decomposerPhotoScale: 0, decomposerFounders: 0.25,
      decomposerDormancy: 0.05, sporeDispersal: 1,
      grazeYieldScale: 1.0, plantYieldPerMass: 0, radiation: null,
      foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
      dormantThreatBlind: null, mixotrophyCarbon: null,
      mixotrophySaturation: 1.0, nutrientCyclic: true,
      producerCaptureScale: 0.35, nutrientFloor: 0.05, reproSurplusTicks: 30,
      basalFoodPerCell: 0.01, nutrientRegen: 0.0002,
      excretionRate: 0.06, meatYieldPerMass: 0,
    },
  });
}

const w = buildWorld(SEED);
const nCells = w.nutrients[0].data.length;
const caps = w.config.nutrientCapacity;
const guildNames = ['PRODUCER', 'CONSUMER', 'DECOMPOSER'];
const poolNames = ['POOL_A', 'POOL_B', 'POOL_C'];
const bioticSourceNames = ['SEDIMENT', 'DETRITUS', 'LITTER'];
const abioticSourceNames = ['DETRITUS', 'SEDIMENT', 'LITTER'];

console.log(`NUTRIENT FLUX AUDIT seed=${SEED} ticks=${TICKS} cells=${nCells}`);
console.log(`Config: nutrientPerCell=${w.config.nutrientPerCell} capacity=[${caps.join(',')}]`);
console.log('');

for (let t = 1; t <= TICKS; t++) {
  w.step();

  if (t % SAMPLE_EVERY === 0 || t === TICKS) {
    // Population by guild
    let pCount = 0, cCount = 0, dCount = 0;
    let pEnergy = 0, cEnergy = 0, dEnergy = 0;
    let pIngested = 0, cIngested = 0, dIngested = 0;
    for (let i = 0; i < w.store.count; i++) {
      if (!w.aliveAt(i)) continue;
      const g = w.roleOf(i).trophic;
      const e = w.store.energy[i];
      const ing = w.store.energyIngested[i];
      if (g === TROPHIC.PRODUCER) { pCount++; pEnergy += e; pIngested += ing; }
      else if (g === TROPHIC.CONSUMER) { cCount++; cEnergy += e; cIngested += ing; }
      else if (g === TROPHIC.DECOMPOSER) { dCount++; dEnergy += e; dIngested += ing; }
    }

    // Nutrient pool totals
    const nutTotals = w.nutrients.map(n => n.data.reduce((a,b)=>a+b,0));
    const detTotal = w.detritus.data.reduce((a,b)=>a+b,0);
    const sedTotal = w.sediment.data.reduce((a,b)=>a+b,0);
    const litTotal = w.litter.data.reduce((a,b)=>a+b,0);
    // mineralisedCell is private; use w.bioticMineralised as proxy
    const minTotal = w.bioticMineralised;

    // Cap utilization
    const capTotals = caps.map((cap, idx) => {
      const fert = w.habitat.fertility.data;
      const capSum = fert.reduce((a, f) => a + w.config.nutrientPerCell * f * cap, 0);
      const actualSum = w.nutrients[idx].data.reduce((a,b)=>a+b,0);
      const overCapCells = w.nutrients[idx].data.reduce((a,b,i) => a + (b > w.config.nutrientPerCell * fert[i] * cap ? 1 : 0), 0);
      const overCapValue = w.nutrients[idx].data.reduce((a,b,i) => {
        const c = w.config.nutrientPerCell * fert[i] * cap;
        return a + (b > c ? b - c : 0);
      }, 0);
      return { cap: capSum, actual: actualSum, util: capSum > 0 ? actualSum/capSum : 0, overCapCells, overCapValue };
    });

    console.log(`t${t}: P${pCount}/C${cCount}/D${dCount} | energy P${pEnergy.toFixed(0)}/C${cEnergy.toFixed(0)}/D${dEnergy.toFixed(0)}`);
    console.log(`  nutrients: [${nutTotals.map(x=>x.toFixed(1)).join(', ')}] | capUtil: [${capTotals.map(x=>x.util.toFixed(2)).join(', ')}] | overCapCells: [${capTotals.map(x=>x.overCapCells).join(',')}] | overCapValue: [${capTotals.map(x=>x.overCapValue.toFixed(1)).join(', ')}]`);
    console.log(`  organic: det=${detTotal.toFixed(1)} sed=${sedTotal.toFixed(1)} lit=${litTotal.toFixed(1)} | mineralised=${minTotal.toFixed(1)}`);
    console.log(`  ingested (cumulative survivors): P${pIngested.toFixed(1)}/C${cIngested.toFixed(1)}/D${dIngested.toFixed(1)}`);
    console.log('');

    // FLUX SNAPSHOT
    const flux = w.getFluxSnapshot();
    console.log(`  === FLUX SNAPSHOT at t${t} ===`);
    
    // Photosynthesis uptake
    console.log(`  Photosynthesis uptake (cumulative):`);
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      const row = flux.photoUptake[g].map(v => v.toFixed(2)).join(', ');
      console.log(`    ${guildNames[g]}: [${row}]`);
    }
    
    // Excretion returns
    console.log(`  Excretion returns (cumulative):`);
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      const row = flux.excretionReturns[g].map(v => v.toFixed(2)).join(', ');
      console.log(`    ${guildNames[g]}: [${row}]`);
    }
    
    // Biotic mineralization
    console.log(`  Biotic mineralization by source (cumulative):`);
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      for (let p = 0; p < NUTRIENT_COUNT; p++) {
        const row = flux.bioticMineralization[g][p].map(v => v.toFixed(2)).join(', ');
        console.log(`    ${guildNames[g]} ${poolNames[p]}: [${row}]  (${bioticSourceNames.join('/')})`);
      }
    }
    
    // Abiotic regeneration
    console.log(`  Abiotic regeneration (cumulative):`);
    const abioticRegenRow = flux.abioticRegen.map(v => v.toFixed(2)).join(', ');
    console.log(`    [${abioticRegenRow}]  (${poolNames.join('/')})`);
    
    // Abiotic mineralization
    console.log(`  Abiotic mineralization from organic pools (cumulative):`);
    for (let p = 0; p < NUTRIENT_COUNT; p++) {
      const row = flux.abioticMineralization[p].map(v => v.toFixed(2)).join(', ');
      console.log(`    ${poolNames[p]}: [${row}]  (${abioticSourceNames.join('/')})`);
    }
    console.log('');
  }
}

console.log('PER-POOL, PER-GUILD, PER-PROCESS FLUX AUDIT complete.');
console.log('This probe uses engine-internal flux accumulators (getFluxSnapshot)');
console.log('to measure instantaneous trophic flow, not just standing stocks.');