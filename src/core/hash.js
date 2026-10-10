/**
 * Deterministic state hashing for the experimental evolution engine.
 *
 * Used by the repeatability gate: two runs of the same (version, config, seed)
 * must produce an identical hash after the same number of ticks.
 *
 * Two properties matter and they are different:
 *  - SENSITIVITY: a change anywhere in the authoritative state must change the
 *    hash. Every field that can influence future evolution is folded in.
 *  - STABILITY: the hash must not depend on anything incidental — wall-clock
 *    time, memory addresses, iteration order of a hash map, or the identity of
 *    the process. Organisms are hashed in slot order with their stable ids
 *    included, so slot recycling is visible but vacant-slot bookkeeping is not.
 *
 * Floats are folded in via their IEEE-754 bit patterns rather than their
 * numeric value, so -0 vs +0 and NaN payloads cannot alias.
 */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
export class StateHasher {
    h = FNV_OFFSET;
    reset() {
        this.h = FNV_OFFSET;
    }
    u32(v) {
        let x = v >>> 0;
        for (let i = 0; i < 4; i++) {
            this.h ^= x & 0xff;
            this.h = Math.imul(this.h, FNV_PRIME) >>> 0;
            x >>>= 8;
        }
    }
    /** Fold a float by its bit pattern, so exact bit equality is what is tested. */
    f32(v) {
        this.u32(floatToBits(v));
    }
    f64(v) {
        // Split into two 32-bit halves; good enough for change detection.
        const buf = new DataView(new ArrayBuffer(8));
        buf.setFloat64(0, v);
        this.u32(buf.getUint32(0));
        this.u32(buf.getUint32(4));
    }
    int(v) {
        this.u32(v | 0);
    }
    /** Fold a typed array's live prefix. */
    arrI32(a, n) {
        for (let i = 0; i < n; i++)
            this.int(a[i]);
    }
    arrU32(a, n) {
        for (let i = 0; i < n; i++)
            this.u32(a[i]);
    }
    arrF32(a, n) {
        for (let i = 0; i < n; i++)
            this.f32(a[i]);
    }
    digest() {
        return (this.h >>> 0).toString(16).padStart(8, '0');
    }
}
/** IEEE-754 bit pattern of a float32 value, as an unsigned 32-bit int. */
export function floatToBits(v) {
    F32.setFloat32(0, v);
    return F32.getUint32(0);
}
const F32 = new DataView(new ArrayBuffer(4));
/**
 * A rolling digest that can be sampled cheaply at intervals.
 * Cheap enough to run every tick at production population sizes.
 */
export class RollingDigest {
    h = FNV_OFFSET;
    reset() {
        this.h = FNV_OFFSET;
    }
    mixInt(v) {
        this.h = mix32(this.h, v | 0) >>> 0;
    }
    mixU32(v) {
        this.h = mix32(this.h, v >>> 0) >>> 0;
    }
    mixF32(v) {
        this.h = mix32(this.h, floatToBits(v)) >>> 0;
    }
    /** Fold a whole float array, or a subarray view of one. */
    mixF32Array(a) {
        let h = this.h;
        for (let i = 0; i < a.length; i++)
            h = mix32(h, floatToBits(a[i]));
        this.h = h >>> 0;
    }
    /** Fold a whole byte array, or a subarray view of one. */
    mixBytes(a) {
        let h = this.h;
        for (let i = 0; i < a.length; i++) {
            h = (h ^ a[i]) >>> 0;
            h = Math.imul(h, FNV_PRIME) >>> 0;
        }
        this.h = h >>> 0;
    }
    /** Mix one organism's identity-bearing state. */
    mix(id, lineage, generation, energy, damage, age, x, y, genome, base, traitCount) {
        let h = this.h;
        h = mix32(h, id | 0);
        h = mix32(h, lineage | 0);
        h = mix32(h, generation | 0);
        h = mix32(h, floatToBits(energy));
        h = mix32(h, floatToBits(damage));
        h = mix32(h, age | 0);
        h = mix32(h, floatToBits(x));
        h = mix32(h, floatToBits(y));
        for (let i = 0; i < traitCount; i++) {
            h = mix32(h, floatToBits(genome[base + i]));
        }
        this.h = h >>> 0;
    }
    digest() {
        return (this.h >>> 0).toString(16).padStart(8, '0');
    }
}
function mix32(h, v) {
    h = (h ^ (v & 0xff)) >>> 0;
    h = Math.imul(h, FNV_PRIME) >>> 0;
    h = (h ^ ((v >>> 8) & 0xff)) >>> 0;
    h = Math.imul(h, FNV_PRIME) >>> 0;
    h = (h ^ ((v >>> 16) & 0xff)) >>> 0;
    h = Math.imul(h, FNV_PRIME) >>> 0;
    h = (h ^ ((v >>> 24) & 0xff)) >>> 0;
    h = Math.imul(h, FNV_PRIME) >>> 0;
    return h >>> 0;
}
