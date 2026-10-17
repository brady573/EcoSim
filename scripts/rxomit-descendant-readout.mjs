/** Actual producing/primary-parent lineage; never reads generationDepth. */
import assert from 'node:assert/strict';

const proposalStages = new Set(['dormancy', 'cooldown', 'energyFraction', 'matter:nutrient',
  'matter:carbon', 'maturity', 'damage', 'surplus', 'drive', 'lottery', 'sexualRoute']);

export class DescendantReadout {
  constructor() {
    this.births = [];
    this.depths = new Map();
    this.parentOf = new Map();
    this.reached = { founders: {}, offspring: {}, unknown: {} };
    this.failed = { founders: {}, offspring: {}, unknown: {} };
    this.gaps = [];
    this.unknownProposalDecisions = 0;
  }
  observe(event) {
    const known = Number.isSafeInteger(event.id) && event.id >= 0
      && Number.isSafeInteger(event.parentId) && event.parentId >= -1
      && Number.isSafeInteger(event.age) && event.age >= 0;
    const cohort = !known ? 'unknown' : event.parentId < 0 ? 'founders' : 'offspring';
    if (proposalStages.has(event.stage)) {
      if (!known) this.unknownProposalDecisions++;
      const passed = event.passedGates.filter((g) => !g.endsWith(':notApplicable'));
      const terminal = event.stage.startsWith('matter:') ? 'matter' : event.stage;
      for (const gate of new Set([...passed, terminal])) {
        this.reached[cohort][gate] = (this.reached[cohort][gate] ?? 0) + 1;
      }
      if (event.outcome === 'blocked') this.failed[cohort][event.stage] = (this.failed[cohort][event.stage] ?? 0) + 1;
    }
    if (event.stage !== 'placement' || event.outcome !== 'placed') return;
    let depth = null;
    if (!known) this.gaps.push({ tick: event.tick, id: event.id, gap: 'placing parent ancestry unavailable' });
    else if (event.parentId < 0) {
      assert.ok(!this.parentOf.has(event.id), 'a recorded offspring cannot later be classified as a founder');
      this.depths.set(event.id, 0); depth = 1;
    }
    else {
      if (!this.parentOf.has(event.id)) this.gaps.push({ tick: event.tick, id: event.id, gap: 'nonfounder producer birth absent from archive' });
      else assert.equal(this.parentOf.get(event.id), event.parentId, 'producer parent identity must agree with its own birth');
      const parentDepth = this.depths.get(event.id);
      if (parentDepth !== undefined && parentDepth !== null) depth = parentDepth + 1;
    }
    if (!Number.isSafeInteger(event.childId) || event.childId < 0) {
      this.gaps.push({ tick: event.tick, id: event.id, gap: 'placed childId unavailable' });
    } else if (known) {
      assert.ok(!this.parentOf.has(event.childId), 'a child must have exactly one recorded birth');
      this.parentOf.set(event.childId, event.id);
      this.depths.set(event.childId, depth);
    }
    this.births.push({ tick: event.tick, producerId: event.id, producerParentId: event.parentId,
      childId: event.childId ?? null, cohort, childDepth: depth });
  }
  finish(expectedBirths) {
    assert.equal(this.births.length, expectedBirths, 'placed ancestry must reconcile to all births');
    const gaps = [...this.gaps];
    if (this.unknownProposalDecisions) gaps.push({ gap: 'proposal cohort unavailable', records: this.unknownProposalDecisions });
    const complete = gaps.length === 0;
    const founder = this.births.filter((b) => b.cohort === 'founders');
    const descendant = this.births.filter((b) => b.cohort === 'offspring');
    const first = descendant.length ? descendant.reduce((t, b) => Math.min(t, b.tick), Infinity) : null;
    return {
      status: complete ? 'COMPLETE' : 'INCOMPLETE', dataGaps: gaps,
      totalBirths: this.births.length,
      founderProducedChildren: complete ? founder.length : null,
      offspringProducedChildren: complete ? descendant.length : null,
      exactGrandchildren: complete ? this.births.filter((b) => b.childDepth === 2).length : null,
      laterDescendantBirths: complete ? this.births.filter((b) => b.childDepth > 2).length : null,
      uniqueReproducingNonfounders: complete ? new Set(descendant.map((b) => b.producerId)).size : null,
      firstGrandchildOrLaterTick: complete ? first : null,
      births: this.births, reachedProposalGates: this.reached, firstFailedProposalGates: this.failed,
    };
  }
}

export function validateTrialDemographics(record, founders) {
  assert.ok(Number.isSafeInteger(founders) && founders >= 0, 'invalid founder count');
  for (const key of ['population', 'births', 'deaths']) {
    assert.ok(Number.isSafeInteger(record[key]) && record[key] >= 0, `invalid demographic ${key}`);
  }
  assert.ok(Number.isSafeInteger(founders + record.births), 'unsafe demographic arithmetic');
  assert.equal(record.population, founders + record.births - record.deaths, 'founders + births - deaths must equal population');
}
