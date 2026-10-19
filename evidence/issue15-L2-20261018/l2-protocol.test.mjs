import assert from 'node:assert/strict';
import { afterR2 } from './l2-protocol.mjs';
let calls = 0;
const rescue = () => { calls++; };
for (const lost of [0, 0.999, NaN, Infinity]) {
  assert.equal(afterR2({ 517: { met: true } }, { 517: lost }, rescue).met, false);
}
assert.equal(afterR2({ 517: { met: false } }, { 517: 10 }, rescue).met, false);
assert.equal(calls, 0, 'failed/unmeasurable R2 must never construct C');
assert.equal(afterR2({ 517: { met: true } }, { 517: 1 }, rescue).met, true);
assert.equal(calls, 1);
console.log('PASS: STOP-B blocks rescue; exact 1.0 threshold permits it.');
