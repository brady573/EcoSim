/** Passive, bounded per-kind ring records. Never receives engine objects. */
export interface ChemBoundaryEvent {
  kind: 'chemistry' | 'offspringGate' | 'death';
  tick: number;
  id: number;
  parentId: number;
  age: number;
  guild: number;
  maturityAge: number;
  cell?: number;
  poolsBefore?: number[];
  remainingBefore?: number[];
  remainingAfterReactions?: number[];
  reactionExtents?: number[];
  /** Per-reaction, per-pool GROSS reservation, reconstructed from actual extent. */
  reactionGross?: number[][];
  storesBefore?: number[];
  uptake?: number[];
  uptakeIncludesSubsidy?: boolean;
  storesAfter?: number[];
  biomassAfter?: number[];
  storesAtDeath?: number[];
  biomassAtDeath?: number[];
  capMask?: number;
  energy?: number;
  cooldown?: number;
  energyFraction?: number;
  threshold?: number;
  damage?: number;
  lacking?: string;
  cause?: string;
}

export class ChemBoundaryLog {
  private readonly events: Record<ChemBoundaryEvent['kind'], ChemBoundaryEvent[]> = {
    chemistry: [], offspringGate: [], death: [],
  };
  private readonly counts = { chemistry: 0, offspringGate: 0, death: 0 };
  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('chemBoundary capacity must be a positive safe integer');
  }
  record(event: ChemBoundaryEvent): void {
    this.counts[event.kind]++;
    const rows = this.events[event.kind];
    const at = (this.counts[event.kind] - 1) % this.capacity;
    rows[at] = event;
  }
  snapshot() {
    const total = this.counts.chemistry + this.counts.offspringGate + this.counts.death;
    const events = (Object.keys(this.events) as Array<ChemBoundaryEvent['kind']>).flatMap((kind) => {
      const rows = this.events[kind];
      const start = this.counts[kind] > this.capacity ? this.counts[kind] % this.capacity : 0;
      return [...rows.slice(start), ...rows.slice(0, start)];
    });
    return { policy: 'per-kind-ring' as const, capacityPerKind: this.capacity, total,
      dropped: total - events.length, counts: { ...this.counts },
      events: structuredClone(events) };
  }
}
