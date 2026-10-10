/**
 * Controlled reproThreshold sweep — the discriminating experiment.
 *
 * QUESTION (case 9b5ff0df)
 * Is consumer non-reproduction caused by reproThreshold being set above the
 * steady-state energy fraction consumers can actually hold? Counterfactual
 * measurement already established that the fraction gate carries essentially all
 * of the marginal blocking effect (+49.9/+19.6/+32.6 points of eligibility,
 * versus +0.6/+3.5/+2.5 for the damage ceiling and +0.1/+0.0/+0.0 for the
 * surplus gate). That is attribution, not causation: it says the gate binds, not
 * that changing it restores the guild.
 *
 * DESIGN
 * Varies ONLY the founder reproThreshold init (config.reproThresholdInit). Seed,
 * founders, world size, immigration, and every energy term are held fixed. The
 * trait remains heritable, so this tests whether the STARTING threshold
 * determines persistence with evolution free to respond — including whether
 * selection drives the threshold back up, which an earlier session observed
 * (0.67 -> 0.70 population-wide).
 *
 * REPORTS, per seed and threshold: consumer births, consumer deaths, their ratio,
 * final population, consumer share of energy, producer share, population-cap
 * hits (to detect renewed producer runaway), and the evolved mean
 * reproThreshold at end of run (to detect selection reverting the change).
 *
 * Run: tsx src/trace/thresholdsweep.ts [ticks]
 */
import { World } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/world/world.js';
import { TRAIT } from '/root/DEE-TS-POC/experiment/ts-evolution-poc/src/bio/genome.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = [24601, 777, 1234];
const THRESHOLDS = [0.6, 0.45, 0.35, 0.25];

interface Row {
  seed: number; threshold: number;
  consBirths: number; consDeaths: number;
  finalPop: number; consEnergyPct: number; prodEnergyPct: number;
  capHits: number; endThreshold: number;
}

const rows: Row[] = [];

for (const threshold of THRESHOLDS) {
  for (const seed of SEEDS) {
    const w = new World({
      config: { founders: 400, worldW: 2400, worldH: 2400, seed, reproThresholdInit: threshold },
    });
    const s = w.store;
    // `demographics()` counters are monotonic, so a single read after the run is
    // exact — no per-tick sampling needed, and none is done here.
    for (let t = 1; t <= TICKS; t++) w.step();
    const d = w.demographics();
    const en = [0, 0, 0];
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      const g = w.roleOf(sl).trophic;
      if (g >= 0 && g < 3) en[g] += s.energy[sl];
    }
    const te = en.reduce((a, b) => a + b, 0) || 1;
    let thrSum = 0, thrN = 0;
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      thrSum += s.trait(sl, TRAIT.REPRO_THRESHOLD); thrN++;
    }
    rows.push({
      seed, threshold,
      consBirths: d.births[1][0] + d.births[1][1],
      consDeaths: d.deaths[1][0] + d.deaths[1][1] + d.deaths[1][2],
      finalPop: s.population,
      consEnergyPct: (en[1] / te) * 100,
      prodEnergyPct: (en[0] / te) * 100,
      capHits: (w as unknown as { populationCapHits: number }).populationCapHits,
      endThreshold: thrN ? thrSum / thrN : 0,
    });
  }
}

console.log(`CONTROLLED reproThreshold SWEEP — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('Only founder reproThreshold varies; all else held fixed. Trait remains heritable.\n');
console.log('thr    seed   consBirths consDeaths  B/D    pop   cons%E  prod%E  capHits  endThr');
for (const r of rows) {
  const ratio = r.consDeaths > 0 ? (r.consBirths / r.consDeaths).toFixed(2) : 'n/a';
  console.log(
    `${r.threshold.toFixed(2)} ${String(r.seed).padStart(6)} ${String(r.consBirths).padStart(11)} ` +
    `${String(r.consDeaths).padStart(10)} ${ratio.padStart(6)} ${String(r.finalPop).padStart(6)} ` +
    `${r.consEnergyPct.toFixed(1).padStart(7)} ${r.prodEnergyPct.toFixed(1).padStart(6)} ` +
    `${String(r.capHits).padStart(8)} ${r.endThreshold.toFixed(3).padStart(7)}`,
  );
}

const byThr = THRESHOLDS.map(t => {
  const g = rows.filter(r => r.threshold === t);
  const bd = g.map(r => (r.consDeaths > 0 ? r.consBirths / r.consDeaths : 0));
  const meanBd = bd.reduce((a, b) => a + b, 0) / bd.length;
  return {
    threshold: t,
    meanBirthDeath: meanBd,
    seedsAboveOne: g.filter(r => r.consBirths > r.consDeaths).length,
    meanConsPct: g.reduce((a, r) => a + r.consEnergyPct, 0) / g.length,
    meanEndThr: g.reduce((a, r) => a + r.endThreshold, 0) / g.length,
    anyCapHit: g.some(r => r.capHits > 0),
  };
});
console.log('\nSUMMARY BY THRESHOLD');
console.log('thr    meanB/D  seedsB>D  meanCons%E  meanEndThr  capHit');
for (const s of byThr) {
  console.log(
    `${s.threshold.toFixed(2)} ${s.meanBirthDeath.toFixed(3).padStart(9)} ${String(s.seedsAboveOne).padStart(9)} ` +
    `${s.meanConsPct.toFixed(1).padStart(10)} ${s.meanEndThr.toFixed(3).padStart(11)} ${(s.anyCapHit ? 'YES' : 'no').padStart(7)}`,
  );
}
console.log(`\nseeds=${SEEDS.length} thresholds=${THRESHOLDS.length} runs=${rows.length} ticksPerRun=${TICKS}`);