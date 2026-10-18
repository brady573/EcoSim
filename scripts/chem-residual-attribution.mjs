/**
 * Read-only residual attribution under the POOL_COMPOSITION contract.
 *
 * Explains a strict-audit residual by three DECLARED quantities and nothing
 * else: the pool compositions of `chem/0.8.0`, the reaction stoichiometry
 * (including each reaction's declared gas vent), and the matter created by
 * settle() clamps. It never subtracts anything from the conservation audit:
 * an unexplained remainder stays visible, and a panel that needs one is
 * reporting a defect, not a convention.
 *
 * Not molecular speciation. See CHEM-080-CONTRACT.md for the declared pool
 * abstraction (DIC as POC carbon, bulk organic C units carrying H and O at the
 * declared 1.8:0.5 ratio, and so on) and `scripts/chem-attribution-078.mjs` for
 * the frozen convention the retired chem/0.7.8 panel was measured under.
 */
import assert from 'node:assert/strict';
import { REACTIONS } from '../build/bio/metabolism.js';
import { POOL_COUNT, POOL_COMPOSITION } from '../build/world/chemistry.js';

const ELEMENTS = POOL_COMPOSITION.length / POOL_COUNT;

export function poolElementVector(pool) {
  assert.ok(Number.isSafeInteger(pool) && pool >= 0 && pool < POOL_COUNT);
  const vector = Array(ELEMENTS).fill(0);
  for (let e = 0; e < ELEMENTS; e++) vector[e] = POOL_COMPOSITION[pool * ELEMENTS + e];
  return vector;
}

/**
 * Declared element defect per unit extent, for every reaction.
 *
 * A gas vent is a PRODUCT of the reaction on the books: the live field sees the
 * exported quantity as a drop, and the audit books the same quantity as a
 * boundary output, so it belongs on the positive side of the closure equation
 * (G26 fixes this sign). Under the current contract every entry must compute to
 * zero within floating-point dust; a non-zero entry is a stoichiometry defect.
 */
export function reactionElementDefects() {
  return REACTIONS.map((rx) => {
    const vector = Array(ELEMENTS).fill(0);
    for (const [terms, sign] of [[rx.products, 1], [rx.substrates, -1]]) {
      for (const term of terms) poolElementVector(term.pool).forEach((n, e) => { vector[e] += sign * term.coeff * n; });
    }
    for (const gas of rx.gas ?? []) vector[gas.element] += gas.coeff;
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
