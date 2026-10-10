/**
 * Deterministic seeded RNG for the experimental evolution engine.
 *
 * Why this exists: every ecological outcome in this POC must be reproducible
 * from (engineVersion + config + seed). `Math.random()` is forbidden.
 *
 * Design constraints for determinism:
 *  - Integer-only state and integer-only mixing. No float accumulation, so no
 *    drift and no engine-dependent rounding in the state itself.
 *  - xoshiro128** (Blackman & Vigna). Small state (16 bytes), excellent
 *    statistical quality for the price of a handful of integer ops per draw.
 *  - 32-bit ops are exact in JS via `|0` / `>>>0`, so the stream is bit-exact
 *    on every conformant JS engine.
 *
 * LIMITATION (disclosed): `nextFloat()` derives a double from a 32-bit integer
 * via / 2^32, which is exact. Helpers that use Math.exp/Math.sin/Math.log are
 * NOT guaranteed bit-identical across engines, so this engine's determinism
 * claim is scoped to "same engine version + same seed". See REPORT.md.
 */
/** xoshiro128** PRNG. 128-bit state held in a Uint32Array(4). */
export class Rng {
    s = new Uint32Array(4);
    constructor(seed) {
        this.reseed(seed);
    }
    /** Reseed from a number or a string (string hashed via FNV-1a). */
    reseed(seed) {
        let h = typeof seed === 'number' ? (seed >>> 0) || 0x9e3779b9 : fnv1a(seed);
        // splitmix32 expansion: decorrelate a single word into 128 bits of state.
        for (let i = 0; i < 4; i++) {
            h = (h + 0x9e3779b9) >>> 0;
            let z = h;
            z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
            z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
            this.s[i] = (z ^ (z >>> 15)) >>> 0;
        }
        // A degenerate all-zero state makes xoshiro output stay zero forever.
        if ((this.s[0] | this.s[1] | this.s[2] | this.s[3]) === 0)
            this.s[0] = 0x9e3779b9;
        return this;
    }
    /** Uniform uint32. The single primitive all other draws are built on. */
    nextU32() {
        const s = this.s;
        const result = (Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0) >>> 0;
        const t = (s[1] << 9) >>> 0;
        s[2] = (s[2] ^ s[0]) >>> 0;
        s[3] = (s[3] ^ s[1]) >>> 0;
        s[1] = (s[1] ^ s[2]) >>> 0;
        s[0] = (s[0] ^ s[3]) >>> 0;
        s[2] = (s[2] ^ t) >>> 0;
        s[3] = rotl(s[3], 11);
        return result;
    }
    /** Uniform double in [0,1). Exact: u32 / 2^32 is a power-of-two scaling. */
    nextFloat() {
        return this.nextU32() / 4294967296;
    }
    /** Uniform double in [lo,hi). */
    range(lo, hi) {
        return lo + this.nextFloat() * (hi - lo);
    }
    /** Uniform integer in [0,n). Rejection-sampled to avoid modulo bias. */
    int(n) {
        if (n <= 1)
            return 0;
        // Largest multiple of n that fits in 32 bits; values at or above it are
        // rejected so the surviving residues are exactly uniform.
        const limit = 4294967296 - (4294967296 % n);
        let u = this.nextU32();
        while (u >= limit)
            u = this.nextU32();
        return u % n;
    }
    /** True with probability p. */
    chance(p) {
        return this.nextFloat() < p;
    }
    /** Standard normal via Box-Muller. Deterministic for a fixed engine. */
    gaussian(mean = 0, sd = 1) {
        let u = this.nextFloat();
        if (u < 1e-12)
            u = 1e-12;
        const v = this.nextFloat();
        return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    /** Pick an index from `weights` proportional to weight. */
    weightedPick(weights, total) {
        let sum = total;
        if (sum === undefined) {
            sum = 0;
            for (let i = 0; i < weights.length; i++)
                sum += weights[i];
        }
        if (sum <= 0)
            return -1;
        let r = this.nextFloat() * sum;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0)
                return i;
        }
        return weights.length - 1;
    }
    /** Current state words, for snapshot/hash purposes. */
    state() {
        return this.s;
    }
    /** Restore state words, for deterministic replay/rollback. */
    setState(words) {
        this.s.set(words);
    }
}
function rotl(x, k) {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
}
/** FNV-1a 32-bit string hash, used to turn seed strings into seed words. */
export function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}
