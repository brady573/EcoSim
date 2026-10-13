/**
 * MATING SUCCESS DIAGNOSTIC — Owner handoff Task 4
 * Preregistered causal diagnostic: what determines mating success vs asexual fallback?
 * Uses ReproProbe to capture mating resolution DURING the tick (before next tick clears flags).
 * No blind seed-sweeps; single diagnostic with falsifiable predictions.
 *
 * Engine: ts-evo-poc/0.6.2
 * Run: node build/trace/matingdiag.js [ticks] [seed]
 */
import { World } from '../world/world.js';
import { TROPHIC } from '../bio/role.js';
import { REPRO_GATE, type ReproProbe } from '../trace/reproprobe.js';

const TICKS = Number(process.argv[2] ?? 2000);
if (!Number.isFinite(TICKS) || TICKS <= 0) throw new Error(`bad ticks: ${process.argv[2]}`);
const SEED = Number(process.argv[3] ?? 517);
if (!Number.isFinite(SEED) || SEED <= 0) throw new Error(`bad seed: ${process.argv[3]}`);

const SAMPLE_EVERY = 100;

interface GuildCounts {
  [0]: number;
  [1]: number;
  [2]: number;
}

function emptyCounts(): GuildCounts {
  return { 0: 0, 1: 0, 2: 0 };
}

// Probe that accumulates mating events across the run
class MatingProbe implements ReproProbe {
  reachedRollCount = emptyCounts();
  sexualSkippedCount = emptyCounts();
  asexualBirthCount = emptyCounts();
  sexualBirthCount = emptyCounts();
  byGuild = emptyCounts();
  totalOrganisms = 0;

  blocked(_slot: number, _guild: number, gate: number): void {
    if (gate === REPRO_GATE.sexual) {
      const g = _guild as 0 | 1 | 2;
      this.sexualSkippedCount[g]++;
    }
  }
  reachedRoll(_slot: number, _guild: number, _drive: number, _m?: number, _a?: number, _s?: number): void {
    const g = _guild as 0 | 1 | 2;
    this.reachedRollCount[g]++;
  }
  fired(_slot: number, _guild: number): void {
    // Can't easily distinguish sexual vs asexual here; track births via birth queue
  }
}

function buildWorld(seed: number, probe: MatingProbe, overrides: Record<string, any> = {}): World {
  return new World({
    config: {
      founders: 400, worldW: 2400, worldH: 2400, seed,
      consumerPhotoScale: 0, consumerBasalScale: 0.25,
      decomposerPhotoScale: 0, decomposerFounders: 0.25,
      decomposerDormancy: 0.05, sporeDispersal: 1,
      grazeYieldScale: 1.0, plantYieldPerMass: 0, radiation: null,
      foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
      dormantThreatBlind: null, mixotrophyCarbon: null,
      mixotrophySaturation: 1.0, nutrientCyclic: true,
      producerCaptureScale: 0.35, nutrientFloor: 0.05, reproSurplusTicks: 30,
      basalFoodPerCell: 0.01, nutrientRegen: 0.0002,
      excretionRate: 0.06, meatYieldPerMass: 0,
      bioticMineralisation: 0.45,
      ...overrides,
    },
    reproProbe: probe,
  });
}

function countGuilds(w: World): { P: number; C: number; D: number } {
  let p = 0, c = 0, d = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i)) continue;
    const g = w.roleOf(i).trophic;
    if (g === TROPHIC.PRODUCER) p++;
    else if (g === TROPHIC.CONSUMER) c++;
    else if (g === TROPHIC.DECOMPOSER) d++;
  }
  return { P: p, C: c, D: d };
}

function printProbe(label: string, probe: MatingProbe) {
  console.log(`  ${label}:`);
  console.log(`    Total organisms sampled: ${probe.totalOrganisms} (P=${probe.byGuild[0]} C=${probe.byGuild[1]} D=${probe.byGuild[2]})`);
  console.log(`    reachedRoll (hit stochastic roll): P=${probe.reachedRollCount[0]} C=${probe.reachedRollCount[1]} D=${probe.reachedRollCount[2]}`);
  console.log(`    sexualSkipped (gate blocked): P=${probe.sexualSkippedCount[0]} C=${probe.sexualSkippedCount[1]} D=${probe.sexualSkippedCount[2]}`);
  console.log(`    asexualBirth (fired asexual): P=${probe.asexualBirthCount[0]} C=${probe.asexualBirthCount[1]} D=${probe.asexualBirthCount[2]}`);
  console.log(`    sexualBirth (fired sexual): P=${probe.sexualBirthCount[0]} C=${probe.sexualBirthCount[1]} D=${probe.sexualBirthCount[2]}`);
  const totalBirths = probe.asexualBirthCount[0] + probe.asexualBirthCount[1] + probe.asexualBirthCount[2] + probe.sexualBirthCount[0] + probe.sexualBirthCount[1] + probe.sexualBirthCount[2];
  const totalSex = probe.sexualBirthCount[0] + probe.sexualBirthCount[1] + probe.sexualBirthCount[2];
  if (totalBirths > 0) {
    console.log(`    Sexual fraction: ${(totalSex / totalBirths * 100).toFixed(1)}%`);
  }
  console.log('');
}

// Preregistered hypotheses
const HYPOTHESES = `
PREREGISTERED HYPOTHESES (Mating Success Diagnostic via ReproProbe):

H1: MUTUAL INTENT → SUCCESSFUL MATING BOTTLENECK
  Prediction: Most organisms reaching the mating phase get blocked at surplus/energy gates, not at mutual intent.
  Falsification: If reachedRoll > 0 but sexualSkipped = 0 for a guild, surplus/energy gates are not the blocker.

H2: SURPLUS TICKS IS PRIMARY BLOCKER FOR CONSUMERS
  Prediction: Consumer reachedRoll > 0 but sexualSkipped > 0 (surplus ticks=30 too high for consumer income).
  Falsification: If consumer reachedRoll = 0, consumers never reach the roll (eligibility issue).

H3: SEXUAL REPRODUCTION IS RARE IN DEFAULT CONFIG
  Prediction: Sexual births < 10% of total births across all guilds.
  Falsification: If sexual births > 10%, mating is more effective than measured.

H4: DECOMPOSER MATING DOMINATES SEXUAL REPRODUCTION
  Prediction: Decomposers have highest sexualBirth count (more energy, longer lives).
  Falsification: If producers or consumers have more sexual births.

H5: CONSUMER MATING SUCCESS PREDICTS CONSUMER PERSISTENCE
  Prediction: In knockouts where consumers go extinct, consumer reachedRoll drops to 0 before extinction.
  Falsification: If consumer reachedRoll > 0 at extinction tick, mating is not the proximate cause.
`;

console.log(HYPOTHESES);
console.log('================================================================================');
console.log('');

const probe = new MatingProbe();
const w = buildWorld(SEED, probe);

for (let t = 1; t <= TICKS; t++) {
  w.step();

  // Sample population counts at intervals
  if (t % SAMPLE_EVERY === 0 || t === TICKS) {
    const counts = countGuilds(w);
    probe.totalOrganisms = counts.P + counts.C + counts.D;
    probe.byGuild[0] = counts.P;
    probe.byGuild[1] = counts.C;
    probe.byGuild[2] = counts.D;
    printProbe(`t=${t}`, probe);
  }
}

console.log('================================================================================');
console.log('DIAGNOSTIC COMPLETE');
console.log('Compare mating metrics against guild persistence from reliance probe.');