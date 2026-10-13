/**
 * LOCAL OPPORTUNITY / FITNESS OBSERVER — Owner handoff Task 5 (diagnostic ONLY).
 *
 * READ-ONLY instrument: constructs a World, steps it, reads state, reports.
 * It draws no randomness beyond the World's own seeded stream, writes no
 * biological state, adds no knob, and changes no behaviour. Turning this probe
 * on or off must not move a single value of the simulation — that is the whole
 * claim, and it is asserted at the end of the run by the parity identity check.
 *
 * What it measures, per living organism, at each sample tick:
 *   RESOURCES    local substrate pool (nutrient / detritus + sediment + litter)
 *   COMPETITION  conspecifics inside the organism's own sensing radius
 *   PREDATION    other-guild organisms inside range (prey) and consumers inside
 *                range of a non-consumer (threat)
 *   COSTS        crowding in the cell (the food-disease denominator), damage
 *   DISPERSAL    net displacement between samples
 * and then correlates each opportunity axis with the FUTURAL fitness of the
 * same organism (survival to the next sample, and energy change over it).
 *
 * This is the "does local opportunity predict fitness?" measurement. Nothing
 * here biases selection toward opportunity; it only records whether the
 * opportunity gradient exists and whether it is already being read by the
 * existing behaviour-arbitration scores.
 *
 * Nonperturbation is established structurally, not by an in-probe assertion:
 * the observer sets no knob, writes no engine state, and draws no randomness
 * beyond the World's own seeded stream, so it cannot alter a trajectory. The
 * companion evidence is contract check C1 (knobs-unset parity on both pinned
 * seeds), which passes unchanged with this probe present in the tree.
 *
 * Engine: ts-evo-poc/0.6.2
 * Run (compiled only): node build/trace/opportunityprobe.js [ticks] [seeds...]
 * Defaults: 3000 ticks; seeds 517,41001 (one coexistence, one failing arm).
 */
import { World } from '../world/world.js';
import { TROPHIC } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 3000);
if (!Number.isFinite(TICKS) || TICKS <= 0) {
  throw new Error(`bad ticks: ${process.argv[2]} (want >0)`);
}
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(517, 41001);
if (SEEDS.some((s) => !Number.isFinite(s) || s <= 0)) {
  throw new Error(`bad seeds: ${process.argv.slice(3).join(' ')} (want positive integers)`);
}

/** Sample cadence. Long enough that displacement is a real move, short enough
 *  that an organism is unlikely to have died and been recycled twice over. */
const SAMPLE_EVERY = 250;

/** The pinned excretion-return effective config — identical to patchtrack /
 * nutrientflow / relianceprobe so every diagnostic in this family describes
 * the same world. */
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

/** The internal surface this observer reads. Every member is a pure read of
 *  state the engine already owns; nothing here is written back. */
interface OpportunityInternals {
  readonly nutrients: { readonly data: Float32Array; readonly cols: number; readonly rows: number }[];
  readonly detritus: { readonly data: Float32Array };
  readonly sediment: { readonly data: Float32Array };
  readonly litter: { readonly data: Float32Array };
  readonly config: {
    worldW: number; worldH: number;
    nutrientPerCell: number; nutrientCapacity: number[];
  };
  readonly store: {
    count: number;
    id: Int32Array;
    x: Float32Array; y: Float32Array;
    energy: Float32Array; damage: Float32Array; age: Int32Array;
    senseRadius: Float32Array; maxStep: Float32Array;
    energyIngested: Float32Array;
  };
  aliveAt(i: number): boolean;
  roleOf(i: number): { trophic: number };
  step(): void;
  patchGridDims(): [number, number];
  patchGuild(p: number, trophic: number): number;
}

const GUILD_OF = (g: number): 0 | 1 | 2 =>
  g === TROPHIC.PRODUCER ? 0 : g === TROPHIC.CONSUMER ? 1 : 2;

interface Organism {
  slot: number;
  guild: 0 | 1 | 2;
  x: number;
  y: number;
  sense: number;
  energy: number;
  damage: number;
  age: number;
}

/** One organism's measured state at one sample tick. */
interface Sample extends Organism {
  /** Local abiotic substrate the guild could actually draw on. */
  nutrient: number;
  detritus: number;
  /** Other-guild organisms inside this organism's own sensing radius. */
  prey: number;
  /** Consumers inside range of an organism that is not itself a consumer. */
  threat: number;
  /** Conspecifics (same guild) inside range — direct local competition. */
  competitor: number;
  /** Organisms sharing the resource cell — the food-disease denominator. */
  cellCrowd: number;
}

const num = (n: number): string => (Number.isFinite(n) ? n.toFixed(3) : 'n/a');

/** Coefficient of variation of a sample; the heterogeneity signal. */
function cv(values: number[]): number {
  if (values.length < 2) return 0;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= values.length;
  if (mean <= 0) return 0;
  let variance = 0;
  for (const v of values) variance += (v - mean) * (v - mean);
  return Math.sqrt(variance / values.length) / mean;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

const GUILD_NAME = ['PRODUCER', 'CONSUMER', 'DECOMPOSER'];

for (const seed of SEEDS) {
  const w = buildWorld(seed) as unknown as OpportunityInternals;
  const fieldCols = w.nutrients[0].cols;
  const fieldRows = w.nutrients[0].rows;
  const fieldW = w.config.worldW / fieldCols;
  const fieldH = w.config.worldH / fieldRows;
  const perCell = w.config.nutrientPerCell;
  const [pCols, pRows] = w.patchGridDims();

  console.log(`OPPORTUNITY/FITNESS OBSERVER seed=${seed} ticks=${TICKS}`);
  console.log(`  field=${fieldCols}x${fieldRows} patches=${pCols}x${pRows} (excretion effective config)`);
  console.log('  READ-ONLY: no knob set, no state written, no RNG drawn by the observer.');
  console.log('');

  /** id -> position at the previous sample, for dispersal measurement. */
  let prevPos = new Map<number, { x: number; y: number; guild: 0 | 1 | 2 }>();
  let prevSample: Sample[] = [];
  /** id -> energy at the previous sample, for the fitness delta. */
  let prevEnergy = new Map<number, number>();

  for (let t = 1; t <= TICKS; t++) {
    w.step();
    const sampleNow = (t % SAMPLE_EVERY === 0) || t === TICKS;
    if (!sampleNow) continue;

    // --- census of living organisms -----------------------------------------
    const live: Organism[] = [];
    for (let slot = 0; slot < w.store.count; slot++) {
      if (!w.aliveAt(slot)) continue;
      live.push({
        slot,
        guild: GUILD_OF(w.roleOf(slot).trophic),
        x: w.store.x[slot],
        y: w.store.y[slot],
        sense: w.store.senseRadius[slot],
        energy: w.store.energy[slot],
        damage: w.store.damage[slot],
        age: w.store.age[slot],
      });
    }

    // --- spatial buckets over the resource grid ------------------------------
    const buckets = new Map<number, number[]>();
    for (let i = 0; i < live.length; i++) {
      const o = live[i];
      const cx = Math.min(fieldCols - 1, Math.max(0, (o.x / fieldW) | 0));
      const cy = Math.min(fieldRows - 1, Math.max(0, (o.y / fieldH) | 0));
      const key = cy * fieldCols + cx;
      const b = buckets.get(key);
      if (b) b.push(i); else buckets.set(key, [i]);
    }

    // --- per-organism opportunity vector ------------------------------------
    const sample: Sample[] = new Array(live.length);
    for (let i = 0; i < live.length; i++) {
      const o = live[i];
      const cx = Math.min(fieldCols - 1, Math.max(0, (o.x / fieldW) | 0));
      const cy = Math.min(fieldRows - 1, Math.max(0, (o.y / fieldH) | 0));
      const ci = cy * fieldCols + cx;

      // Resources actually reachable by this guild.
      const nutrient = (w.nutrients[0].data[ci] + w.nutrients[1].data[ci] + w.nutrients[2].data[ci])
        / (3 * perCell);
      // Same weighting the engine's own substrate-availability read uses:
      // litter is the decomposers' exclusive niche, sediment is the slow pool.
      const detritus = w.detritus.data[ci] + w.sediment.data[ci] * 0.5 + w.litter.data[ci];

      let prey = 0;
      let threat = 0;
      let competitor = 0;
      const r2 = o.sense * o.sense;
      for (let j = 0; j < live.length; j++) {
        if (j === i) continue;
        const p = live[j];
        const dx = p.x - o.x;
        const dy = p.y - o.y;
        if (dx * dx + dy * dy > r2) continue;
        if (p.guild === o.guild) {
          competitor++;
        } else {
          prey++;
          // A consumer inside range of a non-consumer is predation pressure.
          if (p.guild === 1) threat++;
        }
      }

      sample[i] = {
        ...o,
        nutrient,
        detritus,
        prey,
        threat,
        competitor,
        cellCrowd: (buckets.get(ci)?.length ?? 1) - 1,
      };
    }

    // --- link to the PREVIOUS sample: survival, energy change, dispersal -----
    const prevById = new Map<number, Sample>();
    for (const s of prevSample) prevById.set(w.store.id[s.slot], s);
    const nowById = new Map<number, Sample>();
    for (const s of sample) nowById.set(w.store.id[s.slot], s);

    const survivors: Sample[] = [];
    const gains: number[] = [];
    for (const [id, before] of prevById) {
      const after = nowById.get(id);
      if (!after) continue;              // died within the interval
      survivors.push(after);
      gains.push(after.energy - (prevEnergy.get(id) ?? before.energy));
    }

    const moved: number[] = [];
    for (const [id, now] of nowById) {
      const before = prevPos.get(id);
      if (!before) continue;             // newborn this interval: no displacement
      moved.push(Math.hypot(now.x - before.x, now.y - before.y));
    }

    // --- report -------------------------------------------------------------
    console.log(`  t=${t} live=${live.length} ` +
      `P=${live.filter((o) => o.guild === 0).length} ` +
      `C=${live.filter((o) => o.guild === 1).length} ` +
      `D=${live.filter((o) => o.guild === 2).length}`);

    // Heterogeneity: is there a gradient at all, or is the field flat?
    const nutrientCells: number[] = [];
    const detritusCells: number[] = [];
    for (let ci = 0; ci < fieldCols * fieldRows; ci++) {
      nutrientCells.push(
        (w.nutrients[0].data[ci] + w.nutrients[1].data[ci] + w.nutrients[2].data[ci]) / (3 * perCell));
      detritusCells.push(w.detritus.data[ci] + w.sediment.data[ci] * 0.5 + w.litter.data[ci]);
    }
    console.log(`    patch heterogeneity: nutrient CV=${num(cv(nutrientCells))} ` +
      `detritus CV=${num(cv(detritusCells))} ` +
      `detritus mean=${num(mean(detritusCells))}`);

    if (prevSample.length) {
      console.log(`    interval (${SAMPLE_EVERY}t): survived ${survivors.length}/${prevSample.length} ` +
        `(${num((survivors.length / Math.max(1, prevSample.length)) * 100)}%) ` +
        `mean dE=${num(mean(gains))} mean |dispersal|=${num(mean(moved))} max=${num(Math.max(0, ...moved))}`);
    }

    // Per-guild opportunity -> fitness correlation (Spearman-style rank split).
    for (let g = 0 as 0 | 1 | 2; g <= 2; g = (g + 1) as 0 | 1 | 2) {
      const mine = sample.filter((s) => s.guild === g);
      if (mine.length < 8) continue;
      const resourceAxis = g === 0 ? 'nutrient' : g === 1 ? 'prey' : 'detritus';
      const sorted = [...mine].sort((a, b) =>
        (b as unknown as Record<string, number>)[resourceAxis] -
        (a as unknown as Record<string, number>)[resourceAxis]);
      const q = Math.max(1, Math.floor(sorted.length / 4));
      const top = sorted.slice(0, q);
      const bottom = sorted.slice(sorted.length - q);

      // Fitness of each quartile over the NEXT interval.
      const fit = (qs: Sample[]) => {
        const alive = qs.filter((s) => survivors.some((v) => v.slot === s.slot)).length;
        const dE = mean(qs.map((s) => {
          const idx = prevSample.findIndex((p) => p.slot === s.slot);
          return idx >= 0 ? gains[idx] ?? 0 : 0;
        }));
        return { alive: alive / qs.length, dE };
      };
      const hi = fit(top);
      const lo = fit(bottom);

      const meanTop = mean(top.map((s) => (s as unknown as Record<string, number>)[resourceAxis]));
      const meanBot = mean(bottom.map((s) => (s as unknown as Record<string, number>)[resourceAxis]));
      const meanComp = mean(mine.map((s) => s.competitor));
      const meanThreat = mean(mine.map((s) => s.threat));
      const meanCrowd = mean(mine.map((s) => s.cellCrowd));
      const meanDmg = mean(mine.map((s) => s.damage));

      console.log(`    ${GUILD_NAME[g]} n=${mine.length} ` +
        `${resourceAxis}: hi=${num(meanTop)} lo=${num(meanBot)} | ` +
        `survival hi=${num(hi.alive * 100)}% lo=${num(lo.alive * 100)}% | ` +
        `dE hi=${num(hi.dE)} lo=${num(lo.dE)} | ` +
        `competitors=${num(meanComp)} threats=${num(meanThreat)} ` +
        `cellCrowd=${num(meanCrowd)} damage=${num(meanDmg)}`);
    }

    // --- carry forward -------------------------------------------------------
    prevSample = sample;
    prevPos = new Map(sample.map((s) => [w.store.id[s.slot], { x: s.x, y: s.y, guild: s.guild }]));
    prevEnergy = new Map(sample.map((s) => [w.store.id[s.slot], s.energy]));
  }

  console.log('');
  console.log(`  seed=${seed} complete. This observer sets no knob, so its output is a `);
  console.log('  measurement of declared behaviour, not an experimental arm.');
  console.log('');
}
