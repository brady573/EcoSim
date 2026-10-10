/**
 * APP POC ENTRY — minimal browser API over the simulation engine.
 *
 * Pure TypeScript, no Node imports (direct or transitive): safe to bundle
 * with tsc --module amd for file:// execution. The HTML shell provides the
 * AMD loader, Canvas renderer, and controls; this module exposes only:
 *   createRun(seed, baseline) — new World with app defaults
 *   stepRun(run, n)           — advance n ticks
 *   readRun(run)              — tick/pop/guild counts for the HUD
 *   renderRun(run)            — RGB pixel buffer (via shared pixels.ts)
 *
 * Configuration mirrors the combined winner measured in REPORT.md. Baseline
 * flag gives declared behavior. Both paths are digest-identical to their CLI
 * equivalents (verified: same seed+config => same hashState).
 */
import { World } from '../world/world.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { renderWorld, PIXEL_SIZE } from '../trace/pixels.js';

export interface RunConfig {
  seed: number;
  baseline: boolean;
}

export interface RunHandle {
  world: World;
  seed: number;
}

export interface RunReadout {
  tick: number;
  pop: number;
  producers: number;
  consumers: number;
  decomposers: number;
  dormant: number;
}

export function createRun(seed: number, baseline: boolean): RunHandle {
  const world = new World({
    config: baseline
      ? { founders: 400, worldW: 2400, worldH: 2400, seed }
      : {
          founders: 400, worldW: 2400, worldH: 2400, seed,
          consumerPhotoScale: 4, decomposerFounders: 0.25,
          decomposerDormancy: 0.05, sporeDispersal: 1,
        },
  });
  return { world, seed };
}

export function stepRun(handle: RunHandle, n: number): void {
  for (let i = 0; i < n; i++) handle.world.step();
}

export function readRun(handle: RunHandle): RunReadout {
  const w = handle.world;
  const s = w.store;
  const counts = [0, 0, 0];
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const g = w.roleOf(sl).trophic;
    if (g >= 0 && g < TROPHIC_COUNT) counts[g]++;
  }
  const [dormant] = w.dormantCounts();
  return {
    tick: w.tick,
    pop: s.population,
    producers: counts[TROPHIC.PRODUCER],
    consumers: counts[TROPHIC.CONSUMER],
    decomposers: counts[TROPHIC.DECOMPOSER],
    dormant,
  };
}

export interface RunDump {
  seed: number;
  baseline: boolean;
  tick: number;
  pop: number;
  producers: number;
  consumers: number;
  decomposers: number;
  dormant: number;
  births: number[][];
  deaths: number[][];
  transitions: number[][];
}

/** Full state dump for export: counts, births/deaths, guild transitions. */
export function dumpRun(handle: RunHandle, baseline: boolean): RunDump {
  const w = handle.world;
  const r = readRun(handle);
  const d = w.demographics();
  return {
    seed: handle.seed,
    baseline,
    tick: r.tick,
    pop: r.pop,
    producers: r.producers,
    consumers: r.consumers,
    decomposers: r.decomposers,
    dormant: r.dormant,
    births: d.births.map((row) => Array.from(row)),
    deaths: d.deaths.map((row) => Array.from(row)),
    transitions: w.transitionMatrix(),
  };
}

export function renderRun(handle: RunHandle): Uint8Array {
  return renderWorld(handle.world);
}

/* ---- Interpolated rendering (60fps display over a slower sim) ----
 *
 * The display lags the sim by at most one batch: commitPositions() snapshots
 * agent positions after each completed sim batch (prev <- curr, curr <- live),
 * and renderLerp() draws between the two snapshots by alpha in [0,1].
 * Newborns (not live in prev) snap; deaths vanish. Guild colors are discrete
 * and never blend. Dormant agents are skipped by the caller drawing them from
 * curr directly (they do not move, so lerp is identity for them anyway).
 * Buffers live here, never in the engine: determinism untouched.
 */
let prevX = new Float32Array(0);
let prevY = new Float32Array(0);
let prevLive = new Uint8Array(0);
let currX = new Float32Array(0);
let currY = new Float32Array(0);
let currLive = new Uint8Array(0);

function ensureCap(n: number): void {
  if (prevX.length >= n) return;
  const m = Math.max(1024, n * 2);
  // Grow preserving history: a resize mid-run keeps prev/curr so motion
  // continues instead of snapping. New slots start dead (zeroed).
  const npx = new Float32Array(m);
  const npy = new Float32Array(m);
  const npl = new Uint8Array(m);
  const ncx = new Float32Array(m);
  const ncy = new Float32Array(m);
  const ncl = new Uint8Array(m);
  npx.set(prevX.subarray(0, prevX.length));
  npy.set(prevY.subarray(0, prevY.length));
  npl.set(prevLive.subarray(0, prevLive.length));
  ncx.set(currX.subarray(0, currX.length));
  ncy.set(currY.subarray(0, currY.length));
  ncl.set(currLive.subarray(0, currLive.length));
  prevX = npx;
  prevY = npy;
  prevLive = npl;
  currX = ncx;
  currY = ncy;
  currLive = ncl;
}

/** Snapshot live positions after a completed sim batch. Call before render. */
export function commitPositions(handle: RunHandle): void {
  const s = handle.world.store;
  ensureCap(s.count);
  const x = s.x as Float32Array;
  const y = s.y as Float32Array;
  const alive = (handle.world as unknown as { live: Uint8Array }).live;
  // NOTE: reads engine internals (live bitset) without mutating them. If the
  // engine renames this field, fall back to aliveAt() per slot (slower).
  for (let sl = 0; sl < s.count; sl++) {
    prevX[sl] = currX[sl];
    prevY[sl] = currY[sl];
    prevLive[sl] = currLive[sl];
    const live = alive ? alive[sl] === 1 : handle.world.aliveAt(sl);
    currLive[sl] = live ? 1 : 0;
    currX[sl] = live ? x[sl] : 0;
    currY[sl] = live ? y[sl] : 0;
  }
}

/** Pixel compositing with position lerp. Writes RGB into out (SIZE*SIZE*3). */
let lerpCounts = new Int32Array(0);
let lerpDormant = new Int32Array(0);
export function renderLerp(handle: RunHandle, alpha: number, out: Uint8Array): void {
  const w = handle.world;
  const s = w.store;
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  // Reused across frames: avoids ~6MB of GC churn per 60fps frame.
  const need = PIXEL_SIZE * PIXEL_SIZE;
  if (lerpCounts.length < need * TROPHIC_COUNT) {
    lerpCounts = new Int32Array(need * TROPHIC_COUNT);
    lerpDormant = new Int32Array(need);
  } else {
    lerpCounts.fill(0);
    lerpDormant.fill(0);
  }
  const counts = lerpCounts;
  const dormant = lerpDormant;
  const CELL = 2400 / PIXEL_SIZE;
  for (let sl = 0; sl < s.count; sl++) {
    if (currLive[sl] !== 1) continue;
    const g = w.roleOf(sl).trophic;
    if (g < 0 || g >= TROPHIC_COUNT) continue;
    // Newborns (dead in prev) snap to current; otherwise glide.
    const x = prevLive[sl] === 1 ? prevX[sl] + (currX[sl] - prevX[sl]) * a : currX[sl];
    const y = prevLive[sl] === 1 ? prevY[sl] + (currY[sl] - prevY[sl]) * a : currY[sl];
    const px = Math.min(PIXEL_SIZE - 1, Math.max(0, Math.floor(x / CELL)));
    const py = Math.min(PIXEL_SIZE - 1, Math.max(0, Math.floor(y / CELL)));
    const idx = py * PIXEL_SIZE + px;
    counts[idx * TROPHIC_COUNT + g]++;
    if (g === TROPHIC.DECOMPOSER && w.isDormant(sl)) dormant[idx]++;
  }
  const COLORS: Array<[number, number, number]> = [
    [0, 200, 0],
    [255, 140, 0],
    [180, 80, 255],
  ];
  for (let i = 0; i < PIXEL_SIZE * PIXEL_SIZE; i++) {
    const o = i * 3;
    out[o] = 0; out[o + 1] = 0; out[o + 2] = 0;
    let best = -1, bestN = 0, total = 0;
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      const n = counts[i * TROPHIC_COUNT + g];
      total += n;
      if (n > bestN) { bestN = n; best = g; }
    }
    if (best < 0) continue;
    const bright = Math.min(1, 0.25 + (total / 5) * 0.75);
    let c = COLORS[best];
    if (best === TROPHIC.DECOMPOSER && dormant[i] * 2 >= bestN) c = [90, 90, 140];
    out[o] = Math.round(c[0] * bright);
    out[o + 1] = Math.round(c[1] * bright);
    out[o + 2] = Math.round(c[2] * bright);
  }
}

export function pixelSize(): number {
  return PIXEL_SIZE;
}
