/**
 * FROZEN 0.7.8 ATTRIBUTION CONVENTION — do not update.
 *
 * The C/H/O attribution panel `evidence/cho-attribution-20261017` was measured
 * under chemistry `chem/0.7.8`, whose declared books used a flat pool->element
 * map (water carried H and O 1:1; every other pool carried its primary element)
 * and a reaction defect table recorded in that panel's `protocol.json`.
 *
 * That engine no longer exists: `chem/0.8.0` replaced the flat map with the
 * multielement `POOL_COMPOSITION` contract and corrected eight reaction
 * stoichiometries. Re-deriving the old panel's explanations with the new
 * contract would be retroactive reinterpretation of immutable logs.
 *
 * So the old convention lives here as recorded DATA, not as a computation over
 * the live engine. It is used only to check that the archived panel's own
 * numbers decompose as they claimed when they were written. New panels use
 * `chem-residual-attribution.mjs`, which speaks the current contract.
 */
import assert from 'node:assert/strict';
import { POOL_COUNT, POOL_ELEMENT_RT, POOL_RT } from '../build/world/chemistry.js';

/**
 * The 0.7.8 primary-element map, pinned here as recorded data.
 *
 * It still matches the live `POOL_ELEMENT_RT` (which remains the primary-element
 * map used by ablations and diagnostics). The assertion is a tripwire: if the
 * live map ever changes, this frozen module must not silently follow it.
 */
const RECORDED_PRIMARY_ELEMENT = [
  2, 0, 3, 3, 3, 4, 5, 5, 6, // 0-8   inorganic (O2..Fe2)
  6,                         // 9     Fe3
  0, 3, 4, 5, 6,             // 10-14 labile organic
  0, 3, 4, 5,                // 15-18 litter
  0, 3, 4, 5, 6,             // 19-23 sediment
  1,                         // 24    water, primary element H
];

assert.equal(POOL_RT.H2O, 24, 'the frozen 0.7.8 convention indexes water at 24');
assert.equal(POOL_ELEMENT_RT.length, RECORDED_PRIMARY_ELEMENT.length);
RECORDED_PRIMARY_ELEMENT.forEach((e, p) => {
  assert.equal(POOL_ELEMENT_RT[p], e,
    `live POOL_ELEMENT_RT[${p}] no longer matches the recorded 0.7.8 map; do not rebase the frozen panel`);
});

/** 0.7.8 pool->element vector: water 1 H + 1 O, every other pool its primary element. */
export function poolElementVector078(pool) {
  assert.ok(Number.isSafeInteger(pool) && pool >= 0 && pool < POOL_COUNT);
  const vector = Array(7).fill(0);
  if (pool === POOL_RT.H2O) { vector[1] = 1; vector[2] = 1; } else vector[RECORDED_PRIMARY_ELEMENT[pool]] = 1;
  return vector;
}

/**
 * 0.7.8 residual attribution from RECORDED data.
 *
 * `reactionDefects` is the panel's own recorded table (each entry the declared
 * per-unit-extent element defect of one reaction under the old convention).
 * Clamp-created matter decomposes through the frozen primary-element vectors.
 */
export function attributeResidual078(reactionDefects, extents, clamped, residuals) {
  assert.equal(extents.length, reactionDefects.length);
  assert.equal(clamped.length, POOL_COUNT);
  assert.equal(residuals.length, 7);
  for (const n of [...extents, ...clamped, ...residuals]) assert.ok(Number.isFinite(n));
  for (const n of [...extents, ...clamped]) assert.ok(n >= 0);
  const reactionDefect = Array(7).fill(0), clampCreation = Array(7).fill(0);
  reactionDefects.forEach((rx, r) => rx.vector.forEach((n, e) => { reactionDefect[e] += n * extents[r]; }));
  clamped.forEach((n, p) => poolElementVector078(p).forEach((v, e) => { clampCreation[e] += n * v; }));
  return { reactionDefect, clampCreation,
    unexplained: residuals.map((n, e) => n - reactionDefect[e] - clampCreation[e]) };
}
