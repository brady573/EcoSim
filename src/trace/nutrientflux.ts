/**
 * NUTRIENT FLUX AUDIT — per-pool, per-guild, per-process flow measurement
 * Measures: photosynthesis uptake, excretion returns, biotic mineralization,
 * abiotic regeneration, abiotic mineralization — separated by guild, pool, and source.
 *
 * Engine: ts-evo-poc/0.6.3
 * Run: node build/trace/nutrientflux.js [ticks] [seed]
 */
import { World, type ReturnBooks } from '../world/world.js';
import { WORLD_ENGINE_VERSION } from '../world/version.js';
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
console.log(`engine=${WORLD_ENGINE_VERSION} seed=${SEED} ticks=${TICKS}`);
console.log(`resolvedConfig=${JSON.stringify(w.config)}`);
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
    
    // Excretion returns — all four books, so a signed number can never be
    // mistaken for a biological return again. See ReturnBooks in world.ts.
    console.log(`  Excretion returns (cumulative) — accepted / attempted / capLoss / eviction:`);
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      const acc = flux.excretionReturns.accepted[g].map(v => v.toFixed(2)).join(', ');
      const att = flux.excretionReturns.attempted[g].map(v => v.toFixed(2)).join(', ');
      const los = flux.excretionReturns.capLoss[g].map(v => v.toFixed(2)).join(', ');
      const evi = flux.excretionReturns.eviction[g].map(v => v.toFixed(2)).join(', ');
      console.log(`    ${guildNames[g]}:`);
      console.log(`      accepted  [${acc}]`);
      console.log(`      attempted [${att}]`);
      console.log(`      capLoss   [${los}]`);
      console.log(`      eviction  [${evi}]`);
    }
    
    // Biotic mineralization
    console.log(`  Biotic mineralization by source (cumulative) — accepted / attempted / capLoss / eviction:`);
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      for (let p = 0; p < NUTRIENT_COUNT; p++) {
        const acc = flux.bioticMineralization.accepted[g][p].map(v => v.toFixed(2)).join(', ');
        const att = flux.bioticMineralization.attempted[g][p].map(v => v.toFixed(2)).join(', ');
        const los = flux.bioticMineralization.capLoss[g][p].map(v => v.toFixed(2)).join(', ');
        const evi = flux.bioticMineralization.eviction[g][p].map(v => v.toFixed(2)).join(', ');
        console.log(`    ${guildNames[g]} ${poolNames[p]}:  (${bioticSourceNames.join('/')})`);
        console.log(`      accepted  [${acc}]`);
        console.log(`      attempted [${att}]`);
        console.log(`      capLoss   [${los}]`);
        console.log(`      eviction  [${evi}]`);
      }
    }

    // Book audit over BOTH return families.
    //
    // `partitionResidual` is `attempted - accepted - capLoss`, summed over
    // every guild/pool/source. It must close to float summation error. That is
    // the strong claim: the three books are ONE partition of the same quantity,
    // not three independent measurements that merely look consistent. A
    // completely unwired site could still satisfy this identity vacuously;
    // independent comparison with field movement is required (G31).
    //
    // `evictionTotal` is the bounded over-cap event: nutrient the ceiling
    // deleted rather than accepted. If it is zero the clamp never bit here and
    // the partition was only exercised on its trivial branch; the next line
    // says so, so the record cannot mistake silence for confirmation.
    //
    // This is a book-identity check, NOT a mass balance on the pools. A
    // full-world mass balance would not close for reasons unrelated to these
    // books: abiotic regeneration and the unclamped recycling broadcast also
    // write the pools. The mass-balance case is covered where it can actually
    // be isolated — G31 in src/gates.ts runs a writer-isolated world (no
    // diffusion, regen, decay, broadcast or floor) and asserts the pool totals
    // move by `accepted - eviction - photoUptake`, allowing float32 rounding.
    const sumBooks = (b: ReturnBooks<unknown>): { att: number; acc: number; los: number; evi: number } => {
      // Recursive flatten: excretion books are guild x pool, biotic books are
      // guild x pool x source. One traversal keeps the audit identical for both.
      const flat = (v: unknown): number[] =>
        Array.isArray(v) ? (v as unknown[]).flatMap(flat) : [v as number];
      const att = flat(b.attempted).reduce((a, c) => a + c, 0);
      const acc = flat(b.accepted).reduce((a, c) => a + c, 0);
      const los = flat(b.capLoss).reduce((a, c) => a + c, 0);
      const evi = flat(b.eviction).reduce((a, c) => a + c, 0);
      return { att, acc, los, evi };
    };
    const ex = sumBooks(flux.excretionReturns);
    const bm = sumBooks(flux.bioticMineralization);
    const att = ex.att + bm.att, acc = ex.acc + bm.acc, los = ex.los + bm.los, evi = ex.evi + bm.evi;
    const residual = att - acc - los;
    console.log(`  RETURN BOOK PARTITION AUDIT (not a field mass balance):`);
    console.log(`    attempted ${att.toFixed(4)} == accepted ${acc.toFixed(4)} + capLoss ${los.toFixed(4)}  ->  residual ${residual.toExponential(3)}`);
    console.log(`    eviction total ${evi.toFixed(4)} (${evi > 0 ? 'over-cap path EXERCISED' : 'over-cap path NOT reached this run'})`);
    console.log('');
    
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
