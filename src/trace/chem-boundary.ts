/** Passive, bounded per-kind ring records. Never receives engine objects. */
export interface ChemBoundaryEvent {
  kind: 'chemistry' | 'offspringGate' | 'death' | 'birthTransfer' | 'reproduction';
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
  biomassBeforeGrowth?: number[];
  energyBeforeGrowth?: number;
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
  stage?: string;
  outcome?: string;
  passedGates?: string[];
  childId?: number;
  requestedChildren?: number;
  pathway?: string;
  gateValue?: number;
  gateLimit?: number;
  parentStoresBefore?: number[];
  parentStoresAfter?: number[];
  parentBiomassBefore?: number[];
  parentBiomassAfter?: number[];
  childStoresAtBirth?: number[];
  childBiomassAtBirth?: number[];
}

export class ChemBoundaryLog {
  private readonly events: Record<ChemBoundaryEvent['kind'], ChemBoundaryEvent[]> = {
    chemistry: [], offspringGate: [], death: [], birthTransfer: [], reproduction: [],
  };
  private readonly counts = { chemistry: 0, offspringGate: 0, death: 0, birthTransfer: 0, reproduction: 0 };
  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('chemBoundary capacity must be a positive safe integer');
  }
  record(event: ChemBoundaryEvent): void {
    this.counts[event.kind]++;
    const rows = this.events[event.kind];
    const at = (this.counts[event.kind] - 1) % this.capacity;
    rows[at] = event;
  }
  snapshot(selectedKind?: ChemBoundaryEvent['kind'], sinceCount?: number) {
    if (sinceCount !== undefined && (selectedKind === undefined || !Number.isSafeInteger(sinceCount)
      || sinceCount < 0 || sinceCount > this.counts[selectedKind])) throw new Error('invalid boundary sinceCount');
    const total = Object.values(this.counts).reduce((a, b) => a + b, 0);
    const kinds = Object.keys(this.events) as Array<ChemBoundaryEvent['kind']>;
    const retained = kinds.reduce((sum, kind) => sum + this.events[kind].length, 0);
    const events = kinds.filter((kind) => selectedKind === undefined || kind === selectedKind).flatMap((kind) => {
      const rows = this.events[kind];
      const start = this.counts[kind] > this.capacity ? this.counts[kind] % this.capacity : 0;
      const ordered = [...rows.slice(start), ...rows.slice(0, start)];
      if (sinceCount === undefined) return ordered;
      const fresh = this.counts[kind] - sinceCount;
      return fresh === 0 ? [] : ordered.slice(-Math.min(fresh, ordered.length));
    });
    return { policy: 'per-kind-ring' as const, capacityPerKind: this.capacity, total,
      // retained/dropped are GLOBAL ring totals even for a filtered snapshot.
      returned: events.length,
      unreadLost: sinceCount === undefined || selectedKind === undefined ? 0
        : Math.max(0, this.counts[selectedKind] - sinceCount - this.events[selectedKind].length),
      selectedKind: selectedKind ?? null, retained, dropped: total - retained, counts: { ...this.counts },
      events: structuredClone(events) };
  }
}
