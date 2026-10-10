/**
 * Ecological regime sweep.
 *
 * The default configuration is subsidy-driven and explodes (§6 of REPORT.md):
 * exogenous organic input supplies ~93 % of energy, so nothing limits
 * population. Rather than guess new constants, this sweeps the subsidy and the
 * nutrient regeneration rate and reports what each regime actually does.
 *
 * The point is to find a regime in which resource limitation is REAL, i.e. one
 * where producers carry the energy budget and population settles for a reason.
 * Collapse, extinction, and continued explosion are all reported as outcomes;
 * none is filtered out.
 *
 * Bounded by design: short horizon, few cells, small founder counts.
 *
 * Run: pnpm regime
 *     pnpm regime -- --ticks=900 --seeds=11 --subsidies=0,0.005,0.02,0.06 --regens=0.0032,0.008
 */

import { World } from './world/world.js';
import { WORLD_ENGINE_VERSION } from './world/version.js';
import { LineageTracker } from './world/history.js';

const FOUNDERS = 400;
const WORLD = 2000;

interface Cell {
  subsidy: number;
  regen: number;
  founders: number;
}

interface Outcome {
  subsidy: number;
  regen: number;
  /** Fraction of total input that came from photosynthetic capture. */
  captureShare: number;
  finalPopulation: number;
  peakPopulation: number;
  peakTick: number;
  producerShare: number;
  meanGeneration: number;
  lineages: number;
  extinctLineages: number;
  contests: number;
  residualPct: number;
  kind: string;
  series: number[];
}

function run(cell: Cell, ticks: number, seed: number): Outcome {
  const w = new World({
    config: {
      founders: cell.founders,
      worldW: WORLD,
      worldH: WORLD,
      seed,
      label: `regime-${cell.subsidy}-${cell.regen}`,
      basalFoodPerCell: cell.subsidy,
      nutrientRegen: cell.regen,
    },
  });
  w.lineageSampling = true;
  const tracker = new LineageTracker();
  const interval = Math.max(1, Math.floor(ticks / 12));
  const series: number[] = [];
  let peakPopulation = 0;
  let peakTick = 0;

  for (let i = 0; i < ticks; i++) {
    w.step();
    if (w.store.population > peakPopulation) {
      peakPopulation = w.store.population;
      peakTick = w.tick;
    }
    if (w.tick % interval === 0) {
      w.sampleLineages(tracker, w.tick);
      series.push(w.store.population);
    }
  }
  w.sampleLineages(tracker, w.tick);

  let producers = 0;
  for (let slot = 0; slot < w.store.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    if (w.roleOf(slot).trophic === 0) producers++;
  }
  let gen = 0;
  let n = 0;
  for (let slot = 0; slot < w.store.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    gen += w.store.generationDepth[slot];
    n++;
  }

  const finalPop = w.store.population;
  const firstQ = series.slice(0, Math.max(1, Math.floor(series.length / 4)));
  const lastQ = series.slice(-Math.max(1, Math.floor(series.length / 4)));
  const fq = firstQ.reduce((x, y) => x + y, 0) / firstQ.length;
  const lq = lastQ.reduce((x, y) => x + y, 0) / lastQ.length;
  const tailSd = Math.sqrt(lastQ.reduce((s, v) => s + (v - lq) * (v - lq), 0) / lastQ.length);
  const cv = lq > 0 ? tailSd / lq : 0;
  const growth = fq > 0 ? lq / fq : 0;

  let kind: string;
  if (finalPop === 0) kind = 'EXTINCTION';
  else if (growth > 2.5) kind = 'expansion';
  else if (cv < 0.12) kind = 'LIMITED (resource-capped)';
  else if (cv > 0.35) kind = 'boom-bust';
  else kind = 'damped';

  return {
    subsidy: cell.subsidy,
    regen: cell.regen,
    captureShare: w.ledger.capture / Math.max(1e-9, w.ledger.totalInput()),
    finalPopulation: finalPop,
    peakPopulation,
    peakTick,
    producerShare: n > 0 ? producers / n : 0,
    meanGeneration: n > 0 ? gen / n : 0,
    lineages: tracker.totalCreated,
    extinctLineages: tracker.totalExtinct,
    contests: w.interactions.totalResolved,
    residualPct: w.accountingResidualFraction() * 100,
    kind,
    series,
  };
}

function main(): void {
  let ticks = 700;
  let seeds = [11];
  let subsidies = [0, 0.005, 0.02, 0.06];
  let regens = [0.014];
  let founds = [400, 1200];
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--ticks=')) ticks = parseInt(a.slice(8), 10);
    else if (a.startsWith('--seeds=')) seeds = a.slice(8).split(',').map((v) => parseInt(v, 10));
    else if (a.startsWith('--subsidies=')) subsidies = a.slice(12).split(',').map((v) => parseFloat(v));
    else if (a.startsWith('--regens=')) regens = a.slice(9).split(',').map((v) => parseFloat(v));
    else if (a.startsWith('--founders=')) founds = a.slice(11).split(',').map((v) => parseInt(v, 10));
  }

  console.log(`=== ecological regime sweep :: ${WORLD_ENGINE_VERSION} ===`);
  console.log(`founders=${FOUNDERS} world=${WORLD}^2 ticks=${ticks} seed=${seeds.join(',')}`);
  console.log(
    'subsidy = basalFoodPerCell (exogenous organic input per cell per tick).\n' +
      'regen   = nutrientRegen (fraction of a cell\'s deficit refilled per tick).\n' +
      'capture share = photosynthesis as a fraction of all energy input. Above ~0.5 means\n' +
      'producers carry the budget and the system is genuinely producer-driven.\n',
  );

  const results: Outcome[] = [];
  for (const subsidy of subsidies) {
    for (const regen of regens) {
      for (const seed of seeds) {
       for (const fnd of founds) {
        const o = run({ subsidy, regen, founders: fnd }, ticks, seed);
        results.push(o);
        console.log(
          `subsidy=${String(subsidy).padEnd(6)} regen=${String(regen).padEnd(7)} seed=${String(seed).padEnd(5)} ` +
            `-> ${o.kind.padEnd(24)} pop ${String(o.finalPopulation).padStart(5)} ` +
            `(peak ${String(o.peakPopulation).padStart(5)}@t${String(o.peakTick).padStart(4)}) ` +
            `capture=${(o.captureShare * 100).toFixed(1).padStart(5)}% ` +
            `producers=${(o.producerShare * 100).toFixed(0).padStart(3)}% ` +
            `gen=${o.meanGeneration.toFixed(2)} ` +
            `lineages=${o.lineages}/${o.extinctLineages}ext ` +
            `contests=${o.contests} resid=${o.residualPct.toFixed(5)}%`,
        );
        console.log(`           series: ${o.series.join(' -> ')}`);
       }
      }
    }
  }

  console.log('\n=== verdict ===');
  const producerDriven = results.filter((r) => r.captureShare > 0.5 && r.kind !== 'expansion');
  if (producerDriven.length > 0) {
    console.log(
      `  ${producerDriven.length} regime(s) are BOTH producer-driven (capture > 50 %) AND not expanding:`,
    );
    for (const r of producerDriven) {
      console.log(
        `    subsidy=${r.subsidy} regen=${r.regen} -> ${r.kind}, pop ${r.finalPopulation}, ` +
          `capture ${(r.captureShare * 100).toFixed(1)} %, producers ${(r.producerShare * 100).toFixed(0)} %, ` +
          `mean generation ${r.meanGeneration.toFixed(2)}`,
      );
    }
    console.log('  RECOMMEND promoting the lowest such subsidy to the default configuration.');
  } else {
    console.log('  NO regime in this sweep is both producer-driven and resource-limited.');
    console.log('  Every configuration either relies on the subsidy or expands without bound.');
  }
  const extinct = results.filter((r) => r.kind === 'EXTINCTION');
  if (extinct.length > 0) console.log(`  note: ${extinct.length} regime(s) went extinct. Reported, not hidden.`);
}

main();