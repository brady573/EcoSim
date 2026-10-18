/** Read-only attribution under the engine's DECLARED elemental pool mapping.
 * Explains a strict residual; never subtracts it from the conservation audit.
 * Not molecular stoichiometry and not a repaired or closed ecosystem.
 */
import assert from 'node:assert/strict';
import { REACTIONS } from '../build/bio/metabolism.js';
import { POOL_COUNT, POOL_ELEMENT_RT, POOL_RT } from '../build/world/chemistry.js';

export function poolElementVector(pool) {
  assert.ok(Number.isSafeInteger(pool) && pool >= 0 && pool < POOL_COUNT);
  const vector = Array(7).fill(0);
  if (pool === POOL_RT.H2O) { vector[1] = 1; vector[2] = 1; }
  else vector[POOL_ELEMENT_RT[pool]] = 1;
  return vector;
}

export function reactionElementDefects() {
  return REACTIONS.map((rx) => {
    const vector = Array(7).fill(0);
    for (const [terms, sign] of [[rx.products, 1], [rx.substrates, -1]]) {
      for (const term of terms) poolElementVector(term.pool).forEach((n, e) => { vector[e] += sign * term.coeff * n; });
    }
    // Declared N export is already booked by the world, not an unexplained leak.
    if (rx.name === 'denitrification') vector[3] += 1.4;
    return { name: rx.name, vector };
  });
}

export function attributeResidual(extents, clamped, residuals) {
  assert.equal(extents.length, REACTIONS.length);
  assert.equal(clamped.length, POOL_COUNT);
  assert.equal(residuals.length, 7);
  for (const n of [...extents, ...clamped, ...residuals]) assert.ok(Number.isFinite(n));
  for (const n of [...extents, ...clamped]) assert.ok(n >= 0);
  const reactionDefect = Array(7).fill(0), clampCreation = Array(7).fill(0);
  reactionElementDefects().forEach((rx, r) => rx.vector.forEach((n, e) => { reactionDefect[e] += n * extents[r]; }));
  clamped.forEach((n, p) => poolElementVector(p).forEach((v, e) => { clampCreation[e] += n * v; }));
  return { reactionDefect, clampCreation,
    unexplained: residuals.map((n, e) => n - reactionDefect[e] - clampCreation[e]) };
}
