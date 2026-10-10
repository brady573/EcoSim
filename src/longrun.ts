/**
 * Long-run ecosystem dynamics.
 *
 * The amendment requires credible long-run dynamics, not just one-tick
 * throughput or peak organism count. This script runs several independent
 * worlds to a common horizon and CLASSIFIES what happened, because "it ran"
 * and "it behaved like an ecosystem" are different claims.
 *
 * Outcomes are classified, never forced. A run that explodes, collapses, or
 * goes quiescent is reported as-is.
 *
 * Bounded by design: modest founder counts and a horizon chosen to finish in
 * well under a minute per seed on constrained hardware.
 *
 * Run: pnpm longrun   |  pnpm longrun -- --ticks=4000 --seeds=1,2,3
 */

import { World } from './world/world.js';
import { WORLD_ENGINE_VERSION } from './world/version.js';
import { LineageTracker } from './world/history.js';
import { TROPHIC_NAME } from './bio/role.js';

const FOUNDERS = 400;
const WORLD = 2400;

/** Guild composition at the end of a run, by count and by energy. */
interface GuildShares {
  counts: number[];
  energy: number[];
}

interface Verdict {
  seed: number;
  kind: string;
  guilds: GuildShares;
  wallPerTick: number;
  description: string;
  finalPopulation: number;
  peakPopulation: number;
  peakTick: number;
  minPopulationAfterPeak: number;
  turnoverMultiple: number;
  meanGeneration: number;
  lineages: number;
  extinctLineages: number;
  contests: number;
  residualPct: number;
  capHits: number;
}

function classify(
  series: number[],
  finalPop: number,
  ticks: number,
): { kind: string; description: string } {
  const tail = series.slice(-Math.max(3, Math.floor(series.length / 5)));
  const tailMean = tail.reduce((a, b) => a + b, 0) / tail.length;
  const tailSd = Math.sqrt(tail.reduce((a, b) => a + b * b, 0) / tail.length - tailMean * tailMean);
  const cv = tailMean > 0 ? tailSd / tailMean : 0;
  const lastQuarterMean =
    series.slice(-Math.max(2, Math.floor(series.length / 4))).reduce((a, b) => a + b, 0) /
    Math.max(1, Math.floor(series.length / 4));
  const firstQuarterMean =
    series.slice(0, Math.max(2, Math.floor(series.length / 4))).reduce((a, b) => a + b, 0) /
    Math.max(2, Math.floor(series.length / 4));
  const growth = firstQuarterMean > 0 ? lastQuarterMean / firstQuarterMean : 0;

  if (finalPop === 0) {
    return { kind: 'extinction', description: 'population reached zero before the horizon' };
  }
  if (growth > 3) {
    return {
      kind: 'expansion (unbounded)',
      description:
        `population grew ${growth.toFixed(1)}x between the first and last quarter; ` +
        `no carrying capacity was reached within ${ticks} ticks. Substrate exhaustion is ` +
        `not yet limiting the system at this density.`,
    };
  }
  if (cv < 0.08) {
    return {
      kind: 'equilibrium',
      description:
        `population settled to ${tailMean.toFixed(0)} with low fluctuation (CV ${cv.toFixed(3)}); ` +
        `behaviour is self-limiting rather than still diverging.`,
    };
  }
  if (cv > 0.35) {
    return {
      kind: 'boom-bust cycling',
      description:
        `population oscillates strongly (mean ${tailMean.toFixed(0)}, CV ${cv.toFixed(2)}); ` +
        `predator-prey or resource-consumer cycles are plausibly operating.`,
    };
  }
  return {
    kind: 'damped / settling',
    description: `population fluctuating modestly (mean ${tailMean.toFixed(0)}, CV ${cv.toFixed(2)})`,
  };
}

function runSeed(seed: number, ticks: number): Verdict {
  const w = new World({
    config: { founders: FOUNDERS, worldW: WORLD, worldH: WORLD, seed, label: `longrun-${seed}` },
  });
  w.lineageSampling = true;
  const tracker = new LineageTracker();

  const interval = Math.max(1, Math.floor(ticks / 30));
  const series: number[] = [];
  const roleSeries: Record<string, number[]> = {};
  let peakPopulation = 0;
  let peakTick = 0;
  const t0 = Date.now();

  for (let i = 0; i < ticks; i++) {
    w.step();
    if (w.store.population > peakPopulation) {
      peakPopulation = w.store.population;
      peakTick = w.tick;
    }
    if (w.tick % interval === 0) {
      w.sampleLineages(tracker, w.tick);
      series.push(w.store.population);
      // Progress line: an unbounded run is a real possibility in this model,
      // and a silent multi-minute wait is indistinguishable from a hang.
      process.stdout.write(
        `    t=${String(w.tick).padStart(5)} pop=${String(w.store.population).padStart(6)} ` +
          `nutrient=${w.nutrientTotal().toFixed(0).padStart(7)} detritus=${w.detritus.total().toFixed(0).padStart(7)} ` +
          `contests=${w.interactions.totalResolved}\n`,
      );
      const h: Record<string, number> = {};
      for (let slot = 0; slot < w.store.count; slot++) {
        if (!w.aliveAt(slot)) continue;
        const k = TROPHIC_NAME[w.roleOf(slot).trophic];
        h[k] = (h[k] ?? 0) + 1;
      }
      for (const k of Object.keys(h)) {
        (roleSeries[k] ??= []).push(h[k]);
      }
    }
  }
  const wallMs = Date.now() - t0;
  const wallPerTick = wallMs / Math.max(1, ticks);

  const afterPeak = series.filter((_, i) => i * interval >= peakTick);
  const minAfterPeak = afterPeak.length > 0 ? Math.min(...afterPeak) : peakPopulation;
  const { kind, description } = classify(series, w.store.population, ticks);

  let meanGen = 0;
  let n = 0;
  for (let slot = 0; slot < w.store.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    meanGen += w.store.generationDepth[slot];
    n++;
  }

  // Guild composition, measured by ENERGY because that is what published
  // trophic-pyramid figures are expressed in; counts are not comparable
  // across body sizes.
  // Collapsed 5 -> 3 guilds (v0.3.3): producer / consumer / decomposer.
  // Indices 3-4 are dead; trophic values are now 0-2 only.
  const counts = [0, 0, 0];
  const energy = [0, 0, 0];
  for (let slot = 0; slot < w.store.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const t = w.roleOf(slot).trophic;
    counts[t]++;
    energy[t] += w.store.energy[slot];
  }

  return {
    seed,
    kind,
    description,
    guilds: { counts, energy },
    wallPerTick,
    finalPopulation: w.store.population,
    peakPopulation,
    peakTick,
    minPopulationAfterPeak: minAfterPeak,
    turnoverMultiple: FOUNDERS > 0 ? w.totalBirths / FOUNDERS : 0,
    meanGeneration: n > 0 ? meanGen / n : 0,
    lineages: tracker.totalCreated,
    extinctLineages: tracker.totalExtinct,
    contests: w.interactions.totalResolved,
    residualPct: w.accountingResidualFraction() * 100,
    capHits: w.populationCapHits,
  };
}

function main(): void {
  let ticks = 3000;
  let seeds = [11, 202, 3003];
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--ticks=')) ticks = parseInt(a.slice(8), 10);
    else if (a.startsWith('--seeds=')) seeds = a.slice(8).split(',').map((v) => parseInt(v, 10));
  }

  console.log(`=== long-run ecosystem dynamics :: ${WORLD_ENGINE_VERSION} ===`);
  console.log(`founders=${FOUNDERS} world=${WORLD}x${WORLD} horizon=${ticks} ticks seeds=${seeds.join(',')}`);
  console.log('Outcomes are classified, never forced. Expansion, collapse and quiescence are all reported as-is.\n');

  const verdicts: Verdict[] = [];
  for (const seed of seeds) {
    const v = runSeed(seed, ticks);
    verdicts.push(v);
    console.log(`--- seed ${seed} ---`);
    console.log(`  outcome: ${v.kind}`);
    console.log(`  ${v.description}`);
    console.log(
      `  final ${v.finalPopulation}, peak ${v.peakPopulation} @t${v.peakTick}, ` +
        `min-after-peak ${v.minPopulationAfterPeak}`,
    );
    console.log(
      `  turnover ${v.turnoverMultiple.toFixed(1)}x founders, mean generation ${v.meanGeneration.toFixed(2)}, ` +
        `lineages ${v.lineages} (extinct ${v.extinctLineages})`,
    );
    const gt = v.guilds.energy.reduce((a, b) => a + b, 0) || 1;
    const gc = v.guilds.counts.reduce((a, b) => a + b, 0) || 1;
    const names = ['prod', 'cons', 'decomp'];
    console.log(
      `  guilds %energy: ${names.map((nm, i) => `${nm} ${(v.guilds.energy[i] / gt * 100).toFixed(1)}%`).join('  ')}`,
    );
    console.log(
      `  guilds %count : ${names.map((nm, i) => `${nm} ${(v.guilds.counts[i] / gc * 100).toFixed(1)}%`).join('  ')}`,
    );
    console.log(`  wall ${v.wallPerTick.toFixed(2)} ms/tick`);
    console.log(
      `  contests ${v.contests}, residual ${v.residualPct.toFixed(5)}%, ` +
        `population-cap hits ${v.capHits}${v.capHits > 0 ? '  (CAP BOUND THIS RUN)' : ''}`,
    );
    console.log('');
  }

  console.log('=== summary across seeds ===');
  const kinds: Record<string, number> = {};
  for (const v of verdicts) kinds[v.kind] = (kinds[v.kind] ?? 0) + 1;
  for (const [k, n] of Object.entries(kinds)) {
    console.log(`  ${k.padEnd(24)} ${n}/${verdicts.length} runs`);
  }
  const same = Object.keys(kinds).length === 1;
  console.log(
    `\n  ${same ? 'All seeds produced the SAME outcome class.' : 'Seeds produced DIFFERENT outcome classes — ' +
      'the model is outcome-sensitive to initial conditions.'}`,
  );
  const capBound = verdicts.filter((v) => v.capHits > 0).length;
  if (capBound > 0) {
    console.log(`  WARNING: ${capBound} run(s) hit the population ceiling; those results are not free-standing.`);
  }
  const worstResidual = Math.max(...verdicts.map((v) => Math.abs(v.residualPct)));
  console.log(`  worst |accounting residual| across runs: ${worstResidual.toFixed(5)}%`);
}

main();