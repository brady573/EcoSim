/**
 * NUTRIENT CAP REACHABILITY — Owner handoff Task 6 (diagnostic).
 *
 * The reported mismatch: nutrient RETURN paths clamp to a FLAT cap
 * `nutrientPerCell * fertility`, while the per-pool capacity multipliers
 * `nutrientCapacity = [1.0, 0.78, 0.62]` are applied at seeding and at the
 * abiotic regeneration clamp. The question this probe answers is whether the
 * difference is REACHED in a running world, not merely whether it exists in
 * the source.
 *
 * Four return sites clamped to the flat cap; all four now clamp through the
 * shared per-pool helper `nutrientCapAt` (world.ts:1387):
 *   world.ts:2236  excretion (all organisms, every tick)
 *   world.ts:2404  biotic mineralisation from sediment
 *   world.ts:2471  biotic mineralisation from labile detritus
 *   world.ts:2553  biotic mineralisation from recalcitrant litter
 * Two sites apply the per-pool multiplier but were NOT routed through the
 * helper, so three spellings of the cap still exist in the engine:
 *   world.ts:1060  initial seeding   (capacityAt * mod)
 *   world.ts:1504  abiotic regen clamp (inline: perCell * fert * mod)
 * One further writer has NO cap at all and is deliberately untouched:
 *   world.ts:1607  abiotic mineralisation broadcast `nData[i] += share`
 *
 * Phase order inside step(): regeneration clamps FIRST (Phase 2), then returns
 * are written (Phase 4, actPhase). So an excess created this tick survives
 * until the NEXT tick's regeneration clamp — a one-tick window in which the
 * pool holds more than its declared capacity.
 *
 * CAVEAT ON "EXCESS": the per-pool cap is a SOFT TARGET, not an invariant.
 * `ScalarField.step()` diffusion runs AFTER the regen clamp (world.ts:1531 vs
 * 1528), so a low-fertility cell beside a rich one drifts above its own
 * per-pool cap every tick regardless of any return path. The NEGATIVE CONTROL
 * arm measures that baseline; every other arm must be read against it, never
 * against zero.
 *
 * READ-ONLY: constructs a World, steps it, reads. Sets no knob, writes no
 * state, draws no randomness.
 *
 * Engine: ts-evo-poc/0.6.2
 * Run (compiled only): node build/trace/capsreach.js [ticks] [seed]
 * Defaults: 3000 ticks; seed 517.
 */
import { World } from '../world/world.js';

const TICKS = Number(process.argv[2] ?? 3000);
if (!Number.isFinite(TICKS) || TICKS <= 0) {
  throw new Error(`bad ticks: ${process.argv[2]} (want >0)`);
}
const SEED = Number(process.argv[3] ?? 517);
if (!Number.isFinite(SEED) || SEED <= 0) throw new Error(`bad seed: ${process.argv[3]}`);

function buildWorld(seed: number, overrides: Record<string, unknown>): World {
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
      bioticMineralisation: 0.45,
      ...overrides,
    },
  });
}

interface CapsInternals {
  readonly nutrients: { readonly data: Float32Array }[];
  readonly habitat: { readonly fertility: { readonly data: Float32Array } };
  readonly config: { nutrientPerCell: number; nutrientCapacity: number[] };
}

/** Per-pool declared capacity: the value seeding and regeneration clamp to. */
function perPoolCap(w: CapsInternals, nIdx: number, ci: number): number {
  const mod = w.config.nutrientCapacity[nIdx] ?? 1;
  return w.config.nutrientPerCell * w.habitat.fertility.data[ci] * mod;
}

/** The flat cap the four RETURN paths clamp to — no per-pool multiplier. */
function flatCap(w: CapsInternals, ci: number): number {
  return w.config.nutrientPerCell * w.habitat.fertility.data[ci];
}

const POOL_NAME = ['A', 'B', 'C'];

/** padEnd helper for aligned console output. */
function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

/**
 * Scan every cell of every pool. An "excess" is a cell holding more than its
 * declared per-pool capacity — reachable only via a return path, because the
 * regeneration clamp in Phase 2 already brought it back down.
 */
function scan(w: CapsInternals) {
  const nCells = w.nutrients[0].data.length;
  const excessCount = [0, 0, 0];
  const excessMass = [0, 0, 0];
  const excessMax = [0, 0, 0];
  /** Cells above the FLAT cap too — i.e. the flat clamp itself bound. */
  const aboveFlat = [0, 0, 0];
  for (let nIdx = 0; nIdx < 3; nIdx++) {
    const data = w.nutrients[nIdx].data;
    for (let ci = 0; ci < nCells; ci++) {
      const cap = perPoolCap(w, nIdx, ci);
      const over = data[ci] - cap;
      if (over > 1e-9) {
        excessCount[nIdx]++;
        excessMass[nIdx] += over;
        if (over > excessMax[nIdx]) excessMax[nIdx] = over;
      }
      if (data[ci] > flatCap(w, ci) + 1e-9) aboveFlat[nIdx]++;
    }
  }
  return { excessCount, excessMass, excessMax, aboveFlat, nCells };
}

console.log(`NUTRIENT CAP REACHABILITY seed=${SEED} ticks=${TICKS}`);
console.log('READ-ONLY: no knob set, no state written, no RNG drawn by this probe.');
console.log('');
// Honest config disclosure: this probe's BASE is the diagnostic effective
// config shared with patchtrack/nutrientflow/relianceprobe, NOT the engine's
// declared defaults. ~16 fields differ (worldW/H 2400 vs 4000, founders 400
// vs 1200, nutrientCyclic true vs null, producerCaptureScale 0.35 vs null,
// nutrientFloor 0.05 vs 0, mixotrophySaturation 1.0 vs 0.4, meatYieldPerMass
// 0 vs 1.6, and others). Call it "effective", never "declared": a zero-excess
// result here does NOT by itself establish non-reachability under declared
// defaults. That conclusion rests on parity (C1) being byte-identical, which
// is an independent, defaults-based check.
console.log('CONFIG: diagnostic effective config (excretion-return family), NOT engine defaults.');
console.log('  Non-reachability under DECLARED defaults rests on parity C1, not on this probe.');
console.log('');

interface Arm {
  label: string;
  overrides: Record<string, unknown>;
}

const ARMS: Arm[] = [
  {
    label: 'BASE effective config, excretion ON (0.06)',
    overrides: { excretionRate: 0.06 },
  },
  {
    label: 'BASE effective config, excretion OFF (0.0) — isolates the excretion path',
    overrides: { excretionRate: 0 },
  },
  {
    // SATURATION ARM. The declared config never fills the pools, so a zero
    // excess there proves nothing about reachability. High regeneration with
    // nutrientCyclic off drives every pool toward its ceiling; with no
    // producer draw at all (producerCaptureScale 0 and a detritus-only web)
    // the return paths are the only thing writing nutrient, so if the flat
    // cap is ever going to bind above the per-pool cap, it binds here.
    label: 'SATURATION arm — fast abiotic regen, no producer draw (reachability test)',
    overrides: {
      excretionRate: 0.06,
      nutrientRegen: 0.5,
      nutrientCyclic: false,
      nutrientFloor: 0,
      producerCaptureScale: 0,
      bioticMineralisation: 1.0,
      basalFoodPerCell: 0.5,
    },
  },
  {
    // DISCRIMINATOR 1. Same saturation, but recyclingRate=0 removes the
    // UNCLAMPED abiotic broadcast at world.ts:1575 (the only writer that can
    // exceed even the FLAT cap). Any excess left here is attributable purely
    // to the flat-cap return sites, i.e. the reported mismatch.
    label: 'SATURATION + recyclingRate=0 — unclamped broadcast removed',
    overrides: {
      excretionRate: 0.06,
      nutrientRegen: 0.5,
      nutrientCyclic: false,
      nutrientFloor: 0,
      producerCaptureScale: 0,
      bioticMineralisation: 1.0,
      basalFoodPerCell: 0.5,
      recyclingRate: 0,
    },
  },
  {
    // DISCRIMINATOR 2. Recycling on, but every RETURN path silenced
    // (excretion 0, biotic mineralisation 0). Only the unclamped broadcast
    // remains. Pool A (mod 1.0) exceeding its cap here proves that the
    // broadcast, not the flat-cap sites, is what crosses the FLAT ceiling.
    label: 'SATURATION + all returns silenced — broadcast only',
    overrides: {
      excretionRate: 0,
      nutrientRegen: 0.5,
      nutrientCyclic: false,
      nutrientFloor: 0,
      producerCaptureScale: 0,
      bioticMineralisation: 0,
      basalFoodPerCell: 0.5,
    },
  },
  {
    // NEGATIVE CONTROL. Everything silenced: no broadcast, no returns, no
    // producer draw, no floor. Only the per-pool regen clamp runs.
    //
    // PREREGISTERED PREDICTION: ZERO excess on every pool.
    // OUTCOME: FALSIFIED. It reports ~0.05-0.08. Root cause found:
    // `ScalarField.step()` diffusion runs AFTER the regen clamp
    // (world.ts diffusion call vs the clamp above it), so a low-fertility
    // cell beside a rich one is pushed past its own per-pool cap every tick.
    // The per-pool cap is a SOFT TARGET, not an invariant — which is why
    // every other arm must be read against this baseline, never against zero.
    // The residual scales 1 : 0.780 : 0.620 across pools, matching the
    // capacity multipliers: a relative overshoot of the ceiling, not noise.
    // A falsified prediction is a result, so it is recorded here, not deleted.
    label: 'NEGATIVE CONTROL — all nutrient writers silenced (diffusion baseline)',
    overrides: {
      excretionRate: 0,
      nutrientRegen: 0.5,
      nutrientCyclic: false,
      nutrientFloor: 0,
      producerCaptureScale: 0,
      bioticMineralisation: 0,
      basalFoodPerCell: 0,
      recyclingRate: 0,
    },
  },
  {
    // DECISIVE DISCRIMINATOR. The negative control above attributes its
    // residual to diffusion by inference. This arm turns that inference into
    // a measurement: identical to the negative control but with diffusion off,
    // so the ONLY remaining mechanism capable of moving a pool past its clamp
    // is gone. It must report exactly ZERO on every pool.
    //
    // PREREGISTERED PREDICTION: exactly 0 excess, all pools, all ticks.
    // If it does not report zero, the diffusion attribution is wrong and the
    // baseline has some other cause that must be found before any cap claim
    // in this file can be trusted.
    label: 'DECISIVE — negative control + nutrientDiffusivity=0 (attribution test)',
    overrides: {
      excretionRate: 0,
      nutrientRegen: 0.5,
      nutrientCyclic: false,
      nutrientFloor: 0,
      producerCaptureScale: 0,
      bioticMineralisation: 0,
      basalFoodPerCell: 0,
      recyclingRate: 0,
      nutrientDiffusivity: 0,
    },
  },
];

for (const arm of ARMS) {
  console.log(`--- ${arm.label} ---`);
  const w = buildWorld(SEED, arm.overrides) as unknown as CapsInternals;
  const mods = w.config.nutrientCapacity;

  // Tally across the whole run, not just the final tick: the excess is
  // transient (one tick), so a single end-of-run read would miss it.
  let ticksWithExcess = 0;
  const totalExcessMass = [0, 0, 0];
  const peakExcessMax = [0, 0, 0];
  const peakExcessCount = [0, 0, 0];
  let ticksAboveFlat = 0;

  for (let t = 1; t <= TICKS; t++) {
    (w as unknown as { step(): void }).step();
    const s = scan(w);
    if (s.excessCount.some((c) => c > 0)) ticksWithExcess++;
    if (s.aboveFlat.some((c) => c > 0)) ticksAboveFlat++;
    for (let nIdx = 0; nIdx < 3; nIdx++) {
      totalExcessMass[nIdx] += s.excessMass[nIdx];
      if (s.excessMax[nIdx] > peakExcessMax[nIdx]) peakExcessMax[nIdx] = s.excessMax[nIdx];
      if (s.excessCount[nIdx] > peakExcessCount[nIdx]) peakExcessCount[nIdx] = s.excessCount[nIdx];
    }
  }

  console.log(`  nutrientCapacity mod = [${mods.join(', ')}]`);
  console.log(`  ticks with any per-pool excess: ${ticksWithExcess}/${TICKS} ` +
    `(${((ticksWithExcess / TICKS) * 100).toFixed(1)}%)`);
  console.log(`  ticks with cells above the FLAT cap: ${ticksAboveFlat}/${TICKS}`);
  console.log(`  ${pad('pool', 5)} ${pad('mod', 6)} ${pad('peak cells', 12)} ` +
    `${pad('peak excess/cell', 18)} ${pad('cumulative excess mass', 24)}`);
  for (let nIdx = 0; nIdx < 3; nIdx++) {
    console.log(`  ${pad(POOL_NAME[nIdx], 5)} ${pad(mods[nIdx].toFixed(2), 6)} ` +
      `${pad(peakExcessCount[nIdx], 12)} ${pad(peakExcessMax[nIdx].toFixed(6), 18)} ` +
      `${pad(totalExcessMass[nIdx].toFixed(4), 24)}`);
  }

  // Machine-checked verdict for the DECISIVE arm. With diffusion off and every
  // writer silenced, no mechanism can move a pool past its clamp, so any
  // excess at all falsifies the diffusion attribution. This throws rather than
  // prints, because a falsified attribution printed quietly is exactly how a
  // wrong cause gets recorded as a right one.
  if (arm.label.startsWith('DECISIVE') && ticksWithExcess !== 0) {
    throw new Error(
      `ATTRIBUTION FALSIFIED: nutrientDiffusivity=0 still shows excess on ` +
      `${ticksWithExcess}/${TICKS} ticks. The diffusion explanation for the ` +
      `baseline is wrong; find the real cause before trusting any cap claim.`,
    );
  }
  console.log('');
}

console.log('Verdict on the diffusion attribution: ' +
  'the DECISIVE arm (diffusion off, all writers silenced) reported zero excess,');
console.log('  so the NEGATIVE CONTROL residual is diffusion. Attribution measured, not inferred.');

console.log('Interpretation:');
console.log('  - The NEGATIVE CONTROL is the baseline that makes every other arm readable.');
console.log('    With every nutrient writer silenced it still reports ~0.05-0.08 excess:');
console.log('    ScalarField.step() diffusion runs AFTER the regeneration clamp, so a');
console.log('    low-fertility cell beside a rich one is pushed past its own per-pool cap');
console.log('    every tick. The per-pool cap is a soft target, not a maintained invariant.');
console.log('  - Any excess materially ABOVE that baseline was the flat-cap defect: return');
console.log('    paths clamping to nutrientPerCell*fertility with the per-pool multiplier');
console.log('    omitted. Pool A is unaffected either way (its multiplier is 1.0, so its');
console.log('    per-pool cap EQUALS the flat cap), which makes it a built-in control.');
console.log('  - Compare each arm against the NEGATIVE CONTROL row, not against zero.');
