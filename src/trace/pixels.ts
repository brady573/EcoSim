/**
 * WORLD-TO-PIXELS — shared by the CLI renderer and the browser app POC.
 *
 * Pure TypeScript, no Node imports: safe to bundle for browsers. Given a live
 * World, fills an RGB buffer at 600x600 (4x4 world units per pixel).
 * Dominant guild per pixel wins; brightness scales with density; dormant
 * decomposers render slate instead of purple. Reads engine state only.
 */
import type { World } from '../world/world.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';

export const PIXEL_SIZE = 600;
export const PIXEL_CELL = 2400 / PIXEL_SIZE;


const COLORS: Array<[number, number, number]> = [
  [0, 200, 0], // producer green
  [255, 140, 0], // consumer orange
  [180, 80, 255], // decomposer purple
];
const DORMANT: [number, number, number] = [90, 90, 140];

export function renderWorld(w: World): Uint8Array {
  const SIZE = PIXEL_SIZE;
  const CELL = PIXEL_CELL;
  // Per-pixel guild tallies: [pixel][guild].
  const counts = new Int32Array(SIZE * SIZE * TROPHIC_COUNT);
  const dormant = new Int32Array(SIZE * SIZE);
  const s = w.store;
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const g = w.roleOf(sl).trophic;
    if (g < 0 || g >= TROPHIC_COUNT) continue;
    const px = Math.min(SIZE - 1, Math.max(0, Math.floor(s.x[sl] / CELL)));
    const py = Math.min(SIZE - 1, Math.max(0, Math.floor(s.y[sl] / CELL)));
    const idx = py * SIZE + px;
    counts[idx * TROPHIC_COUNT + g]++;
    if (g === TROPHIC.DECOMPOSER && w.isDormant(sl)) dormant[idx]++;
  }
  const rgb = new Uint8Array(SIZE * SIZE * 3);
  for (let i = 0; i < SIZE * SIZE; i++) {
    let best = -1, bestN = 0, total = 0;
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      const n = counts[i * TROPHIC_COUNT + g];
      total += n;
      if (n > bestN) { bestN = n; best = g; }
    }
    if (best < 0) continue; // black
    const bright = Math.min(1, 0.25 + (total / 5) * 0.75);
    let c = COLORS[best];
    // Dormant-majority decomposer pixel renders slate instead of purple.
    if (best === TROPHIC.DECOMPOSER && dormant[i] * 2 >= bestN) c = DORMANT;
    rgb[i * 3] = Math.round(c[0] * bright);
    rgb[i * 3 + 1] = Math.round(c[1] * bright);
    rgb[i * 3 + 2] = Math.round(c[2] * bright);
  }
  return rgb;
}

