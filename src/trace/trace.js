/**
 * Event trace: a bounded, deterministic record of what actually happened.
 *
 * WHY THIS EXISTS
 * Snapshot history (`WorldHistory`) and cumulative counters (`demographics()`)
 * answer "what was true at tick N" and "how many died of X overall". Neither
 * answers the questions that actually come up during investigation:
 *
 *   - Why did THIS organism die? (cause, damage split, energy, hunger at death)
 *   - What happened to this lineage between two ticks?
 *   - Did that contest actually change anything, or was it noise?
 *   - Which immigrants actually crossed patches, and did they survive?
 *
 * Those questions were repeatedly unanswerable during development, which forced
 * indirect inference from aggregate numbers and produced several wrong
 * diagnoses. This module makes the causal chain directly observable.
 *
 * DESIGN CONSTRAINTS
 *
 * - Read-only: tracing never changes simulation state. No RNG draws, no writes
 *   to store/ledger/fields, no branches the engine depends on. Enabling it must
 *   not alter any outcome (verified by G1 seeded-repeatability across a run with
 *   tracing on and off).
 * - Bounded: a fixed-size ring buffer, so a long run cannot grow unbounded and
 *   cannot exhaust memory. Oldest events are overwritten, never resized.
 * - Deterministic: events are appended in the engine's existing deterministic
 *   order (slot order in death, id order in contest resolution), so a traced run
 *   and an untraced run produce identical event sequences for the same seed.
 * - Opt-in: disabled by default; see `TraceOptions.enabled`.
 */
/** Event kinds. Kept numeric and stable so they survive serialization. */
export const TRACE = {
    BIRTH: 0,
    DEATH: 1,
    CONTEST: 2,
    /** A long-range disperser landed in a patch other than its parent's. */
    IMMIGRATION: 3,
};
export const TRACE_NAME = {
    0: 'birth',
    1: 'death',
    2: 'contest',
    3: 'immigration',
    4: 'lineageExtinct',
    5: 'collapse',
};
/** Proximate cause of death. Mirrors the ledger's death-reason classification. */
export const DEATH_CAUSE = {
    STARVE: 0,
    AGE: 1,
    DAMAGE: 2,
};
export const DEATH_CAUSE_NAME = {
    0: 'starve',
    1: 'age',
    2: 'damage',
};
/** Interaction kind, matching INTERACTION in bio/interactions.ts. */
export const TRACE_INTERACTION_NAME = {
    0: 'predate',
    1: 'territorial',
    2: 'mate',
    3: 'scavenge',
    4: 'graze',
};
/**
 * Fixed-capacity ring buffer of trace events.
 *
 * Deliberately NOT a growing array: a multi-thousand-tick run produces
 * O(births + deaths + contests) events, which at high population is tens of
 * thousands. A ring keeps memory flat and makes the cost per event constant.
 */
export class TraceLog {
    buf;
    head = 0;
    filled = 0;
    capacity;
    /** Total events ever recorded, including those since overwritten. */
    total = 0;
    constructor(capacity = 20000) {
        this.capacity = Math.max(1, capacity);
        this.buf = new Array(this.capacity);
    }
    record(e) {
        this.buf[this.head] = e;
        this.head = (this.head + 1) % this.capacity;
        if (this.filled < this.capacity)
            this.filled++;
        this.total++;
    }
    /** Total events recorded over the run, including overwritten ones. */
    get eventCount() {
        return this.total;
    }
    /**
     * Events in chronological order. Only the last `capacity` are retained, so a
     * short slice of a long run is a suffix of the true event sequence.
     */
    events() {
        const out = [];
        const start = this.filled < this.capacity ? 0 : this.head;
        for (let i = 0; i < this.filled; i++) {
            out.push(this.buf[(start + i) % this.capacity]);
        }
        return out;
    }
    /** Events within [from, to], chronological. */
    between(from, to) {
        return this.events().filter((e) => e.tick >= from && e.tick <= to);
    }
    /** All events of one kind, chronological. */
    ofKind(kind) {
        return this.events().filter((e) => e.kind === kind);
    }
    /** Events referencing an organism id in either the a or b slot. */
    forOrganism(id) {
        // KIND-AWARE, not `a === id || b === id`. That naive form was a real bug:
        // `b` carries a small dense LINEAGE index for DEATH and a small PATCH index
        // for IMMIGRATION, both low integers that collide with organism ids, so
        // forOrganism(1) could return an unrelated lineage's death. Reproduced and
        // measured before this fix (1 false positive on forOrganism(1), seed 42).
        // Only BIRTH and CONTEST put a genuine participant id in `b`.
        return this.events().filter((e) => {
            if (e.a === id)
                return true;
            if (e.kind === TRACE.BIRTH || e.kind === TRACE.CONTEST)
                return e.b === id;
            return false;
        });
    }
    /**
     * Full history of one lineage: every event whose organism ids belong to that
     * lineage requires an id->lineage map, which the engine holds. This helper
     * takes that map so the trace module stays free of engine internals.
     */
    forLineage(lineage, idToLineage) {
        return this.events().filter((e) => idToLineage.get(e.a) === lineage || idToLineage.get(e.b) === lineage);
    }
    reset() {
        this.head = 0;
        this.filled = 0;
        this.total = 0;
    }
}
/**
 * Human-readable one-line rendering of an event. Shared by any CLI/report so
 * the same event reads identically everywhere.
 */
export function formatEvent(e, guildName) {
    const gname = guildName ?? ((g) => String(g));
    switch (e.kind) {
        case TRACE.BIRTH:
            return `t${e.tick} BIRTH id=${e.a} parent=${e.b} guild=${gname(e.x)} energy=${e.v.toFixed(1)} pathway=${e.w === 1 ? 'sexual' : 'asexual'}`;
        case TRACE.DEATH:
            return `t${e.tick} DEATH id=${e.a} age=${e.w} cause=${DEATH_CAUSE_NAME[e.v] ?? e.v} damage=${e.x.toFixed(1)} starveDmg=${e.y.toFixed(1)} guild=${gname(e.z)}`;
        case TRACE.CONTEST:
            return `t${e.tick} CONTEST ${TRACE_INTERACTION_NAME[e.x] ?? e.x} att=${e.a} def=${e.b} outcome=${e.w} delta=${e.v.toFixed(2)} attDmg=${e.y.toFixed(1)} defDmg=${e.z.toFixed(1)}`;
        case TRACE.IMMIGRATION:
            return `t${e.tick} IMMIGRATION id=${e.a} fromPatch=${e.b} toPatch=${e.x} guild=${gname(e.v)}`;
        default:
            return `t${e.tick} kind=${e.kind} a=${e.a} b=${e.b} v=${e.v}`;
    }
}
