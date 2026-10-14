/**
 * MATING SUCCESS DIAGNOSTIC — Owner handoff Task 4
 * Preregistered causal diagnostic: what determines mating success vs asexual fallback?
 * Uses ReproProbe to capture mating resolution DURING the tick (before next tick clears flags).
 * No blind seed-sweeps; single diagnostic with falsifiable predictions.
 *
 * Engine: ts-evo-poc/0.6.3
 * Run: node build/trace/matingdiag.js [ticks] [seed]
 */
import { World } from '../world/world.js';
import { WORLD_ENGINE_VERSION } from '../world/version.js';
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
  // Per-gate "blocked" counts, accumulated per guild.
  cooldownBlocked = emptyCounts();
  fractionBlocked = emptyCounts();
  maturityBlocked = emptyCounts();
  damageBlocked = emptyCounts();
  surplusBlocked = emptyCounts();
  sexualDeferred = emptyCounts();
  reachedRollCount = emptyCounts();
  asexualBirthCount = emptyCounts();
  sexualBirthCount = emptyCounts();
  queuedAsexual = emptyCounts();
  queuedSexual = emptyCounts();
  placedAsexual = emptyCounts();
  placedSexual = emptyCounts();
  byGuild: GuildCounts = emptyCounts();
  totalOrganisms = 0;

  // Single per-diagnostic-event logs too (cheap, helps re-evaluation).
  mutating = true;
  private gateCount(gate: number, _guild: number): GuildCounts {
    switch (gate) {
      case REPRO_GATE.cooldown: return this.cooldownBlocked;
      case REPRO_GATE.fraction: return this.fractionBlocked;
      case REPRO_GATE.maturity: return this.maturityBlocked;
      case REPRO_GATE.damage: return this.damageBlocked;
      case REPRO_GATE.surplus: return this.surplusBlocked;
      case REPRO_GATE.sexual: return this.sexualDeferred;
      default: return this.reachedRollCount;
    }
  }

  blocked(_slot: number, guild: number, gate: number): void {
    const g = guild as 0 | 1 | 2;
    this.gateCount(gate, g)[g]++;
  }
  reachedRoll(_slot: number, _guild: number, _drive: number, _m?: number, _a?: number, _s?: number): void {
    const g = _guild as 0 | 1 | 2;
    this.reachedRollCount[g]++;
  }
  fired(_slot: number, _guild: number, sexual: boolean = false): void {
    const g = _guild as 0 | 1 | 2;
    if (sexual) this.sexualBirthCount[g]++;
    else this.asexualBirthCount[g]++;
  }
  queued(guild: number, sexual: boolean, count: number): void {
    (sexual ? this.queuedSexual : this.queuedAsexual)[guild as 0 | 1 | 2] += count;
  }
  placed(guild: number, sexual: boolean): void {
    (sexual ? this.placedSexual : this.placedAsexual)[guild as 0 | 1 | 2]++;
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
  const blocks = (c: GuildCounts) => `P=${c[0]} C=${c[1]} D=${c[2]}`;
  console.log(`  ${label}:`);
  console.log(`    Population: P=${probe.byGuild[0]} C=${probe.byGuild[1]} D=${probe.byGuild[2]}`);
  console.log(`    reachedRoll: P=${probe.reachedRollCount[0]} C=${probe.reachedRollCount[1]} D=${probe.reachedRollCount[2]}`);
  console.log(`    blocked cooldown:   ${blocks(probe.cooldownBlocked)}`);
  console.log(`    blocked fraction:   ${blocks(probe.fractionBlocked)}`);
  console.log(`    blocked maturity:   ${blocks(probe.maturityBlocked)}`);
  console.log(`    blocked damage:     ${blocks(probe.damageBlocked)}`);
  console.log(`    blocked surplus:    ${blocks(probe.surplusBlocked)}`);
  console.log(`    deferred sexual:    ${blocks(probe.sexualDeferred)}`);
  console.log(`    asexual clutches (fired asexual pass): P=${probe.asexualBirthCount[0]} C=${probe.asexualBirthCount[1]} D=${probe.asexualBirthCount[2]}`);
  console.log(`    sexual births (fired via MATE):      P=${probe.sexualBirthCount[0]} C=${probe.sexualBirthCount[1]} D=${probe.sexualBirthCount[2]}`);
  console.log(`    queued offspring by parent guild: asexual ${blocks(probe.queuedAsexual)}; sexual ${blocks(probe.queuedSexual)}`);
  console.log(`    placed offspring by newborn guild: asexual ${blocks(probe.placedAsexual)}; sexual ${blocks(probe.placedSexual)}`);
  const totalAsex = probe.placedAsexual[0] + probe.placedAsexual[1] + probe.placedAsexual[2];
  const totalSex = probe.placedSexual[0] + probe.placedSexual[1] + probe.placedSexual[2];
  const queued = Object.values(probe.queuedAsexual).reduce((a, b) => a + b, 0)
    + Object.values(probe.queuedSexual).reduce((a, b) => a + b, 0);
  console.log(`    queued minus placed offspring: ${queued - totalAsex - totalSex} (placement cause not measured)`);
  if (totalAsex + totalSex > 0) {
    console.log(`    Sexual fraction of placed offspring: ${(totalSex / (totalAsex + totalSex) * 100).toFixed(1)}%`);
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
console.log(`engine=${WORLD_ENGINE_VERSION} seed=${SEED} ticks=${TICKS}`);
console.log(`resolvedConfig=${JSON.stringify(w.config)}`);

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
