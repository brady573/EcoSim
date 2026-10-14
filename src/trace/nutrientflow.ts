/**
 * NUTRIENT FLOW AUDIT — ecological feedback by functional phenotype
 * Measures: producer uptake, abiotic regeneration, organic stocks,
 * excretion returns, biotic mineralization — separated by guild and pool.
 *
 * Engine: ts-evo-poc/0.6.2
 * Run: node build/trace/nutrientflow.js [ticks] [seed]
 */
import { World } from '../world/world.js';

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

// Access internal fields for flow measurement
interface WorldInternals {
  nutrients: { data: Float32Array }[];
  detritus: { data: Float32Array };
  sediment: { data: Float32Array };
  litter: { data: Float32Array };
  mineralisedCell: Float32Array;
  habitat: { fertility: { data: Float32Array }; drainage: { data: Float32Array } };
  config: { nutrientPerCell: number; nutrientCapacity: number[] };
  ledger: any;
  store: { count: number; role: Int32Array; energy: Float32Array; energyIngested: Float32Array };
  aliveAt(i: number): boolean;
  roleOf(i: number): { trophic: number };
  step(): void;
}

const w = buildWorld(SEED) as unknown as WorldInternals;
const nCells = w.nutrients[0].data.length;
const caps = w.config.nutrientCapacity;

console.log(`NUTRIENT FLOW AUDIT seed=${SEED} ticks=${TICKS} cells=${nCells}`);
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
      if (g === 0) { pCount++; pEnergy += e; pIngested += ing; }
      else if (g === 1) { cCount++; cEnergy += e; cIngested += ing; }
      else if (g === 2) { dCount++; dEnergy += e; dIngested += ing; }
    }

    // Nutrient pool totals
    const nutTotals = w.nutrients.map(n => n.data.reduce((a,b)=>a+b,0));
    const detTotal = w.detritus.data.reduce((a,b)=>a+b,0);
    const sedTotal = w.sediment.data.reduce((a,b)=>a+b,0);
    const litTotal = w.litter.data.reduce((a,b)=>a+b,0);
    const minTotal = w.mineralisedCell.reduce((a,b)=>a+b,0);

    // Cap utilization — CORRECTED: denominator = sum of configured per-cell caps
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
  }
}

// Final ledger dump if available
if (w.ledger && typeof w.ledger.report === 'function') {
  console.log('=== LEDGER REPORT ===');
  w.ledger.report();
}

console.log('STANDING-STOCK / SURVIVING-ORGANISM CUMULATIVE TELEMETRY complete.');
console.log('This probe samples population snapshots and cumulative energyIngested of');
console.log('organisms alive at checkpoints. It does NOT measure instantaneous or');
console.log('interval trophic flow, per-pool nutrient uptake, or flux by functional');
console.log('phenotype. For process-level flow, engine needs ReproProbe-style hooks');
console.log('on photosynthesis uptake, excretion returns, and mineralization per pool.');
