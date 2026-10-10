/**
 * MINERALIZER FATE — why do functional mineralizers fade?
 *
 * THE GAP
 * Functional mineralizers (bioticMineraliser=1) outnumber labeled decomposers
 * 2-5x, peak at 19-75 around t400-800, then fade to 0-22 by t2400 on all seeds.
 * The nutrient loop closes early through mobile generalists, then opens again.
 * Nothing in the current instrumentation explains why: the trait probe tracks
 * asexualRate/mateSeeking at roll entry (breeding traits), the ledger tracks
 * income/expenditure by guild label (not by mineralizer flag), and
 * bioticMineralised is read only as a cumulative total, never as a rate.
 *
 * TWO COMPETING EXPLANATIONS
 *   (a) TRAIT EROSION: recalc digestion is selected against (like asexualRate
 *       was), so carriers lose the trait and stop mineralizing while staying
 *       alive. Predicts: mean recalc falls over time; mineralizer count falls
 *       while total population holds.
 *   (b) CARRIER MORTALITY: mineralizers die (starvation/competition) with
 *       traits intact. Predicts: mean recalc among the living holds steady;
 *       mineralizer count falls with population or faster; deaths dominate.
 *
 * MEASURES, per checkpoint: mineralizer count, mean recalc/carrion/photo/speed
 * among mineralizers vs among all living, bioticMineralised cumulative (for
 * flow rate by differencing), and total population. All from public reads;
 * no engine hooks, so non-perturbation is structural.
 *
 * Run: tsx src/trace/mineralfate.ts [ticks] [seed,seed,...]
 */
import { World } from '../world/world.js';
import { TRAIT } from '../bio/genome.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(24601, 777, 1234);

const SAMPLES = [200, 400, 800, 1400, 1900, 2400];

interface Sample {
  tick: number;
  pop: number;
  mineralizers: number;
  labeledDecomp: number;
  meanRecalcAll: number;
  meanRecalcMin: number;
  meanCarrionMin: number;
  meanPhotoMin: number;
  meanSpeedMin: number;
  bioticMineralised: number;
  guildOfMin: number[];
}

const runs: { seed: number; samples: Sample[] }[] = [];

for (const seed of SEEDS) {
  const w = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed, consumerPhotoScale: 4 } });
  const s = w.store;
  const samples: Sample[] = [];
  const marks = new Set(SAMPLES);
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    if (!marks.has(t)) continue;
    let pop = 0, minN = 0, labD = 0;
    let rAll = 0, rAllN = 0, rMin = 0, cMin = 0, pMin = 0, spMin = 0;
    const guildOfMin = [0, 0, 0];
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      pop++;
      const recalc = s.trait(sl, TRAIT.RECALCITRANT_DIGESTION);
      rAll += recalc; rAllN++;
      if (w.roleOf(sl).trophic === TROPHIC.DECOMPOSER) labD++;
      if (w.bioticMineraliser[sl] === 1) {
        minN++;
        rMin += recalc;
        cMin += s.trait(sl, TRAIT.CARRION_AFFINITY);
        pMin += s.trait(sl, TRAIT.PHOTOSYNTHETIC_RATE);
        spMin += s.trait(sl, TRAIT.SPEED);
        const g = w.roleOf(sl).trophic;
        if (g >= 0 && g < TROPHIC_COUNT) guildOfMin[g]++;
      }
    }
    samples.push({
      tick: t, pop, mineralizers: minN, labeledDecomp: labD,
      meanRecalcAll: rAllN ? rAll / rAllN : 0,
      meanRecalcMin: minN ? rMin / minN : 0,
      meanCarrionMin: minN ? cMin / minN : 0,
      meanPhotoMin: minN ? pMin / minN : 0,
      meanSpeedMin: minN ? spMin / minN : 0,
      bioticMineralised: w.bioticMineralised,
      guildOfMin,
    });
  }
  runs.push({ seed, samples });
}

console.log(`MINERALIZER FATE — ${TICKS} ticks, seeds ${SEEDS.join('/')} (photox4 baseline for comparability)`);
console.log('No engine hooks; all public reads, structurally non-perturbing.\n');

for (const r of runs) {
  console.log(`seed ${r.seed}:`);
  console.log('tick      pop   miners  labelD  recalcAll  recalcMin  carrionMin  photoMin  speedMin  mineralFlow  minGuilds(P/C/D)');
  let prevMin = 0;
  for (const f of r.samples) {
    const flow = f.bioticMineralised - prevMin;
    prevMin = f.bioticMineralised;
    console.log(
      `${String(f.tick).padStart(5)} ${String(f.pop).padStart(6)} ${String(f.mineralizers).padStart(7)} ` +
        `${String(f.labeledDecomp).padStart(7)} ${f.meanRecalcAll.toFixed(3).padStart(10)} ` +
        `${f.meanRecalcMin.toFixed(3).padStart(10)} ${f.meanCarrionMin.toFixed(3).padStart(11)} ` +
        `${f.meanPhotoMin.toFixed(3).padStart(9)} ${f.meanSpeedMin.toFixed(3).padStart(9)} ` +
        `${flow.toFixed(0).padStart(12)}  ${f.guildOfMin.join('/')}`,
    );
  }
}

console.log('\nATTRIBUTION (pooled trend)');
for (const r of runs) {
  const first = r.samples[1]; // t400, near peak
  const last = r.samples.at(-1)!;
  const recalcHeld = last.meanRecalcMin >= first.meanRecalcMin * 0.8;
  console.log(
    `seed ${r.seed}: miners ${first.mineralizers} -> ${last.mineralizers} ` +
      `(${(last.mineralizers / Math.max(1, first.mineralizers) * 100).toFixed(0)}%), ` +
      `recalc ${first.meanRecalcMin.toFixed(3)} -> ${last.meanRecalcMin.toFixed(3)} ` +
      `(${recalcHeld ? 'HELD' : 'ERODED'}), ` +
      `pop recalc ${first.meanRecalcAll.toFixed(3)} -> ${last.meanRecalcAll.toFixed(3)}`,
  );
}
console.log('\nEROSION = mean recalc among mineralizers falls >20% (trait selected against).');
console.log('MORTALITY = recalc holds while count falls (carriers die with traits intact).');
// Scalar metrics for MCP statistical contracts (last stdout line must be JSON).
// recalcHeld777: 1 if seed 777 mineralizer recalc holds within 20% (the seed
//   where mineralizers persist; distinguishes mortality from erosion).
// minersEnd777: mineralizer count at t2400 on seed 777.
// photoGateBreach1234: 1 if seed 1234 final mineralizer photo >= 0.30
//   (approaching the 0.34 gate; tests photox4 interference).
// mineralFlowEnd777: flow at final checkpoint on 777 (loop still open?).
{
  // Seed-agnostic: fall back to runs[0] when 777/1234 absent, so any seed set works.
  const r777 = runs.find((r) => r.seed === 777) ?? runs[0];
  const r1234 = runs.find((r) => r.seed === 1234);
  const f777 = r777.samples[1], l777 = r777.samples.at(-1)!;
  // last mineralizer-bearing sample on 1234 (t1400, photo 0.339 in standard runs)
  const lastMin1234 = r1234
    ? [...r1234.samples].reverse().find((x) => x.mineralizers > 0)
    : [...r777.samples].reverse().find((x) => x.mineralizers > 0);
  console.log(JSON.stringify({
  recalcHeld777: l777.meanRecalcMin >= f777.meanRecalcMin * 0.8 ? 1 : 0,
  minersEnd777: l777.mineralizers,
  photoGateBreach1234: lastMin1234 && lastMin1234.meanPhotoMin >= 0.30 ? 1 : 0,
  mineralFlowEnd777: Math.round(l777.bioticMineralised - r777.samples.at(-2)!.bioticMineralised),
  verdicts: runs.map((r) => {
    const first = r.samples[1];
    const last = r.samples.at(-1)!;
    return {
      seed: r.seed,
      minersStart: first.mineralizers,
      minersEnd: last.mineralizers,
      recalcEroded: last.meanRecalcMin < first.meanRecalcMin * 0.8 ? 1 : 0,
    };
  }),
  }));
}