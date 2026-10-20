/** Read-only cell observations; no stepping, RNG, or phenotype reassignment. */
import type { World } from '../world/world.js';
import { WORLD_ENGINE_VERSION } from '../world/version.js';
import { TRAIT } from '../bio/genome.js';
import { classifyMineralPheno } from '../bio/role.js';

export function cellAt(w: World, x: number, y: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Non-finite world coordinate');
  const { cols, rows } = w.nutrients[0];
  const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / w.config.worldW * cols)));
  const cy = Math.max(0, Math.min(rows - 1, Math.floor(y / w.config.worldH * rows)));
  return cy * cols + cx;
}

export function inspectCell(w: World, cell: number) {
  const { cols, rows } = w.nutrients[0];
  if (!Number.isInteger(cell) || cell < 0 || cell >= cols * rows) throw new Error('Invalid cell');
  const guilds = [0, 0, 0];
  const capabilities = [0, 0, 0, 0];
  for (let slot = 0; slot < w.store.count; slot++) {
    if (!w.aliveAt(slot) || cellAt(w, w.store.x[slot], w.store.y[slot]) !== cell) continue;
    guilds[w.roleOf(slot).trophic]++;
    const t = (trait: number) => w.store.trait(slot, trait);
    capabilities[classifyMineralPheno(t(TRAIT.PHOTOSYNTHETIC_RATE),
      t(TRAIT.CARRION_AFFINITY), t(TRAIT.RECALCITRANT_DIGESTION), t(TRAIT.SPEED))]++;
  }
  return {
    engine: WORLD_ENGINE_VERSION, seed: w.config.seed,
    resolvedConfig: JSON.parse(JSON.stringify(w.config)) as typeof w.config,
    tick: w.tick, cell, column: cell % cols, row: Math.floor(cell / cols),
    worldBounds: { x: cell % cols * w.config.worldW / cols,
      y: Math.floor(cell / cols) * w.config.worldH / rows,
      width: w.config.worldW / cols, height: w.config.worldH / rows },
    nutrients: ['A', 'B', 'C'].map((pool, p) => ({ pool,
      amount: w.nutrients[p].data[cell], capacity: w.nutrientCapAt(p, cell) })),
    displayedGuilds: { producers: guilds[0], consumers: guilds[1], decomposers: guilds[2] },
    expressedCapabilities: { carrionOnly: capabilities[0], recalcOnly: capabilities[1],
      dual: capabilities[2], neither: capabilities[3] },
    photosynthesisLimitation: { evidence: 'not_observed', reason: 'No event-local observer in this engine' },
    evidence: { nutrients: 'observed', capacities: 'derived', displayedGuilds: 'observed',
      expressedCapabilities: 'derived', commandHistory: 'not_observed' },
  };
}
