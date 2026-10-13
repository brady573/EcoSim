/**
 * Credibility gates for the experimental evolution POC.
 *
 * Scope note: this is NOT production validation. These are the five checks the
 * Owner named as credibility-critical for the experiment, and nothing more. No
 * claim of scientific validity, cross-platform determinism, or production
 * readiness is made or implied by passing them.
 *
 *   G1 seeded repeatability within a fixed experimental version
 *   G2 finite / valid state
 *   G3 causal resource accounting
 *   G4 consistent births and deaths
 *   G5 explicit deterministic resolution of contested interactions
 *   G6 gradient ascent samples both axes independently
 *   G7 trophic assimilation is applied exactly once
 *   G8 mating requires reciprocal intent
 *
 * Run: pnpm gates   (designed to finish in a few seconds at small scale)
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from './world/world.js';
import { WORLD_ENGINE_VERSION } from './world/version.js';
import { INTERACTION, InteractionQueue } from './bio/interactions.js';
import { TRAIT, TRAIT_COUNT, TRAITS, BODY_GENE_COUNT } from './bio/genome.js';
import {
  GENE_MODULE, GENE_MODULE_COUNT, MAX_MODULES, MODULE_SPECS, MODULE_STRIDE, MODULE_STRIDE_GATE,
  MODULE_STRIDE_KIND, MODULE_STRIDE_MAG, MODULE_STRIDE_ONSET,
  expressModules, inheritModules, recombineModules, seedFounderModules,
} from './bio/modgenome.js';
import { OrganismStore } from './core/soa.js';
import type { Phenotype } from './bio/phenotype.js';
import { Rng } from './core/rng.js';
import { INTENT } from './world/world.js';
import { REACTIONS, CAP } from './bio/metabolism.js';
import { runIdentity, CHEMISTRY_ENGINE_VERSION } from './world/version.js';
import { E_RUNTIME_COUNT } from './bio/elements.js';
import { POOL_RT } from './world/chemistry.js';

interface GateResult {
  id: string;
  name: string;
  pass: boolean;
  detail: string;
}

const results: GateResult[] = [];

function record(id: string, name: string, pass: boolean, detail: string): void {
  results.push({ id, name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${id} ${name}\n         ${detail}`);
}

const SMALL = { founders: 300, worldW: 2000, worldH: 2000, seed: 4242, label: 'gates' } as const;
const TICKS = 250;

// ---------------------------------------------------------------------------
// G1 — seeded repeatability
// ---------------------------------------------------------------------------
function gate1(): void {
  const sample = (seed: number): string[] => {
    const w = new World({ config: { ...SMALL, seed } });
    const out = [w.hashState()];
    for (let i = 0; i < TICKS; i++) {
      w.step();
      if (w.tick % 50 === 0) out.push(w.hashState());
    }
    out.push(w.hashState());
    return out;
  };

  const a = sample(4242);
  const b = sample(4242);
  const c = sample(9999);

  const sameSeedIdentical = a.every((h, i) => h === b[i]);
  const differingSeedDiffers = a[a.length - 1] !== c[c.length - 1];

  record(
    'G1',
    'seeded repeatability',
    sameSeedIdentical && differingSeedDiffers,
    `${WORLD_ENGINE_VERSION}: same seed -> ${sameSeedIdentical ? 'identical' : 'DIVERGED'} ` +
      `digests [${a.join(',')}]; different seed -> ${differingSeedDiffers ? 'diverged (expected)' : 'IDENTICAL (BAD)'}. ` +
      `Scope: same engine version + same Node/V8 build. Not a cross-platform claim.`,
  );
}

// ---------------------------------------------------------------------------
// G2 — finite / valid state
// ---------------------------------------------------------------------------
function gate2(): void {
  const w = new World({ config: SMALL });
  let bad = 0;
  let checked = 0;
  const problems: string[] = [];

  // Every substrate cell of all THREE organic pools must be finite and
  // non-negative. Skipping a pool here is how a new field could ship unchecked:
  // the litter pool was added after this gate existed and was initially invisible
  // to it.
  const checkPools = (label: string, data: Float32Array): void => {
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v) || v < -1e-9) {
        if (problems.length < 4) problems.push(`${label}[${i}] invalid ${v}`);
        bad++;
      }
    }
  };

  for (let i = 0; i < TICKS; i++) {
    w.step();
    const s = w.store;
    checkPools('detritus', w.detritus.data);
    checkPools('sediment', w.sediment.data);
    checkPools('litter', w.litter.data);
    for (let slot = 0; slot < s.count; slot++) {
      // Vacant slots legitimately hold no phenotype, so only live slots are
      // required to be fully populated. Checking every slot would flag the
      // free list as corruption.
      if (!w.aliveAt(slot)) continue;
      checked++;
      // TRAIT_COUNT, not a literal. This was `slot * 36` while the block stride
      // is 41, so the finiteness gate read the WRONG physical block for every
      // slot except slot 0 - it inspected the tail of one organism's traits and
      // the head of the next. The "finite state" gate was therefore not
      // validating the trait block it claimed to validate, for any slot past the
      // first. Both this offset and the loop bound above must derive from the
      // stride or the gate silently stops meaning anything.
      const o = slot * TRAIT_COUNT;
      const e = s.energy[slot];
      const d = s.damage[slot];
      const px = s.x[slot];
      const py = s.y[slot];
      const age = s.age[slot];
      if (!Number.isFinite(e) || !Number.isFinite(d) || !Number.isFinite(px) || !Number.isFinite(py) || age < 0) {
        if (problems.length < 4) problems.push(`slot ${slot} nonfinite: e=${e} d=${d} x=${px} y=${py} age=${age}`);
        bad++;
        continue;
      }
      if (e < -1e-6) {
        if (problems.length < 4) problems.push(`slot ${slot} negative energy ${e}`);
        bad++;
      }
      if (px < 0 || px > SMALL.worldW || py < 0 || py > SMALL.worldH) {
        if (problems.length < 4) problems.push(`slot ${slot} out of bounds (${px.toFixed(1)},${py.toFixed(1)})`);
        bad++;
      }
      if (age > 20000) {
        if (problems.length < 4) problems.push(`slot ${slot} implausible age ${age}`);
        bad++;
      }
      // A living slot must carry a derived phenotype and a finite trait block.
      if (s.phen[slot] === null) {
        if (problems.length < 4) problems.push(`slot ${slot} live but has no phenotype`);
        bad++;
      }
      // TRAIT_COUNT, not a literal. This was hardcoded to 36 while there are 41
      // traits, so the finiteness gate silently skipped the last five -
      // nutrientA/B/C, dispersal and detritivory - which are exactly the traits
      // that decide guild balance. A "7/7 passed" result did not mean what it
      // appeared to mean. Trailing traits are also where array-layout mistakes
      // land first, so this range must never be a hand-written number.
      for (let t = 0; t < TRAIT_COUNT; t++) {
        const v = s.physical[o + t];
        if (!Number.isFinite(v)) {
          if (problems.length < 4) problems.push(`slot ${slot} trait ${t} nonfinite`);
          bad++;
          break;
        }
      }
    }
    for (let i2 = 0; i2 < w.nutrients[0].data.length; i2++) {
      const v = w.nutrients[0].data[i2];
      const v2 = w.detritus.data[i2];
      const v3 = w.sediment.data[i2];
      if (!Number.isFinite(v3) || v3 < 0) {
        if (problems.length < 4) problems.push(`field cell ${i2} invalid sediment=${v3}`);
        bad++;
        break;
      }
      if (!Number.isFinite(v) || !Number.isFinite(v2) || v < 0 || v2 < 0) {
        if (problems.length < 4) problems.push(`field cell ${i2} invalid: nutrient=${v} detritus=${v2}`);
        bad++;
        break;
      }
    }
  }

  record(
    'G2',
    'finite / valid state',
    bad === 0,
    bad === 0
      ? `${checked.toLocaleString()} organism-states and ${((w.nutrients[0].data.length * TICKS)).toLocaleString()} field-cells checked, 0 violations`
      : `${bad} violations. ${problems.join(' | ')}`,
  );
}

// ---------------------------------------------------------------------------
// G3 — causal resource accounting
// ---------------------------------------------------------------------------
function gate3(): void {
  const TOLERANCE = 0.005; // 0.5% of total input
  const w = new World({ config: SMALL });
  let worst = 0;
  let worstTick = 0;
  for (let i = 0; i < TICKS; i++) {
    w.step();
    const r = Math.abs(w.accountingResidualFraction());
    if (r > worst) {
      worst = r;
      worstTick = w.tick;
    }
  }
  const L = w.ledger;
  const biomass = L.biomass(w.store, (slot) => w.aliveAt(slot));
  const det = w.detritus.total();
  const dis = L.totalDissipated();

  record(
    'G3',
    'causal resource accounting',
    worst < TOLERANCE,
    `identity capture+organic+founding == biomass+detritus+dissipated. ` +
      `Worst |residual| = ${(worst * 100).toFixed(5)}% at tick ${worstTick} (tolerance ${TOLERANCE * 100}%). ` +
      `Final: capture=${L.capture.toFixed(1)} organicInput=${L.injectOrganic.toFixed(1)} ` +
      `founding=${L.foundingBiomass.toFixed(1)} => totalInput=${L.totalInput().toFixed(1)}; ` +
      `biomass=${biomass.toFixed(1)} detritus=${det.toFixed(1)} dissipated=${dis.toFixed(1)} => accounted=${(biomass + det + dis).toFixed(1)}. ` +
      `Dissipation split: basal=${L.basalSpent.toFixed(0)} move=${L.movementSpent.toFixed(0)} sense=${L.sensingSpent.toFixed(0)} ` +
      `contest=${L.contestSpent.toFixed(0)} repro=${L.reproductionSpent.toFixed(0)} mineralised=${L.mineralised.toFixed(0)} ` +
      `spoiled=${L.spoiled.toFixed(0)} unassimilated=${L.unassimilated.toFixed(0)}`,
  );
}

// ---------------------------------------------------------------------------
// G4 — consistent births and deaths
// ---------------------------------------------------------------------------
function gate4(): void {
  const w = new World({ config: SMALL });
  let identityHeld = true;
  let firstFailure = -1;
  for (let i = 0; i < TICKS; i++) {
    w.step();
    const expected = SMALL.founders + w.totalBirths - w.totalDeaths;
    if (w.store.population !== expected) {
      identityHeld = false;
      if (firstFailure < 0) firstFailure = w.tick;
      break;
    }
  }
  const r = w.deathReasons();
  const reasonsTotal = r.starve + r.age + r.damage;

  record(
    'G4',
    'consistent births and deaths',
    identityHeld && reasonsTotal === w.totalDeaths,
    identityHeld
      ? `population == founders(${SMALL.founders}) + births(${w.totalBirths}) - deaths(${w.totalDeaths}) == ${w.store.population} at every one of ${TICKS} ticks`
      : `population identity first broke at tick ${firstFailure}`,
  );

  record(
    'G4b',
    'death cause attribution',
    reasonsTotal === w.totalDeaths,
    `causes sum to deaths: damage=${r.damage} age=${r.age} starve=${r.starve} total=${reasonsTotal} vs deaths=${w.totalDeaths}`,
  );
}

// ---------------------------------------------------------------------------
// G5 — explicit deterministic resolution of contested interactions
// ---------------------------------------------------------------------------
function gate5(): void {
  const collect = (seed: number): { digest: string; contacts: number; duplicatePairs: number; abandoned: number; byKind: number[] } => {
    const w = new World({ config: { ...SMALL, seed } });
    let h = 0x811c9dc5;
    const mix = (v: number) => {
      h = Math.imul(h ^ (v | 0), 0x01000193) >>> 0;
    };
    let contacts = 0;
    let duplicatePairs = 0;
    let abandoned = 0;
    const byKind = [0, 0, 0, 0];
    for (let i = 0; i < TICKS; i++) {
      w.step();
      const recs = w.resolutions();
      const seenPairs = new Set<number>();
      for (const r of recs) {
        contacts++;
        byKind[r.kind]++;
        if (r.outcome === 2) abandoned++;
        // Order-independent pair key, so a mutual double-resolution is caught.
        const a = r.attackerId;
        const b = r.defenderId;
        if (b >= 0) {
          const key = a < b ? a * 1000003 + b : b * 1000003 + a;
          if (seenPairs.has(key)) duplicatePairs++;
          seenPairs.add(key);
        }
        mix(r.attackerId);
        mix(r.defenderId);
        mix(r.kind);
        mix(r.outcome);
        // Fold the rounded yield so energy outcomes are part of the digest
        // without being sensitive to float64 noise in unrelated systems.
        mix(Math.round(r.delta * 1e6));
      }
    }
    return { digest: (h >>> 0).toString(16).padStart(8, '0'), contacts, duplicatePairs, abandoned, byKind };
  };

  const a = collect(4242);
  const b = collect(4242);

  const kindNames = ['predation', 'territorial', 'mating', 'scavenge'];
  const breakdown = a.byKind.map((n, i) => `${kindNames[i]}=${n}`).join(' ');

  record(
    'G5',
    'deterministic contested resolution',
    a.digest === b.digest && a.duplicatePairs === 0 && a.contacts > 0,
    `${a.contacts} resolved contests over ${TICKS} ticks (${breakdown}); ` +
      `${a.abandoned} abandoned (participant died first); ${a.duplicatePairs} duplicate pairs (must be 0). ` +
      `Replay digest ${a.digest} vs ${b.digest} -> ${a.digest === b.digest ? 'identical' : 'DIVERGED'}. ` +
      `INTERACTION.PREDATE=${INTERACTION.PREDATE} is the contested class.`,
  );

  record(
    'G5b',
    'contests are not vacuous',
    a.byKind[INTERACTION.PREDATE] > 0,
    `predation contests resolved: ${a.byKind[INTERACTION.PREDATE]}. A run with zero contested interactions ` +
      `would make this gate meaningless, so zero is treated as a failure.`,
  );
}

// ---------------------------------------------------------------------------
// G6 — gradient ascent samples both axes independently
//
// A purely horizontal resource field must yield an eastward heading and a
// purely vertical one a northward heading. This is a white-box gate: it reaches
// the private heading helpers directly and injects a synthetic field, because
// the bug it guards (comparing north against east, and probing east on the
// diagonal) is invisible from the outside — it only missteers.
type GradientProbe = {
  nutrients: { cols: number; rows: number; data: Float32Array }[];
  gradientHeading(px: number, py: number, heading: number, sense: number, probe: number): number;
  detritusHeading(px: number, py: number, heading: number, sense: number, probe: number): number;
};

function gate6(): void {
  const probeDist = 60;
  const cx = SMALL.worldW / 2;
  const cy = SMALL.worldH / 2;

  /** Build a world whose EVERY nutrient pool carries the same synthetic field. */
  const build = (eastward: boolean, northward: boolean): GradientProbe => {
    const w = new World({ config: { ...SMALL } });
    const p = w as unknown as GradientProbe;
    // gradientHeading SUMS across all pools, so writing only pool 0 leaves the
    // others contributing their own gradient — the field is then not synthetic
    // at all and every assertion below becomes meaningless. Write them all.
    for (const field of p.nutrients) {
      for (let cy2 = 0; cy2 < field.rows; cy2++) {
        for (let cx2 = 0; cx2 < field.cols; cx2++) {
          // Value rises along x when eastward, along -y when northward, so the
          // two axes are varied independently and can be checked separately.
          const x = cx2 / (field.cols - 1);
          const y = 1 - cy2 / (field.rows - 1);
          field.data[cy2 * field.cols + cx2] = (eastward ? x : 0) + (northward ? y : 0);
        }
      }
    }
    return p;
  };

  /**
   * Exact heading comparison, NOT a compass bucket.
   *
   * A bucket test was tried first and is VACUOUS: with the original defect
   * (north sampled against east, no south sample) a purely eastward field
   * lands in the "east" bucket and a purely northward field in "north",
   * because the malformed term happens to carry the right sign in both cases.
   * The gate passed against the code it was written to catch. Exact angles
   * plus a diagonal field are what actually separate the two models.
   */
  const near = (a: number, b: number, tol = 1e-6): boolean => Math.abs(a - b) < tol;
  const deg = (r: number): string => (((r * 180) / Math.PI + 360) % 360).toFixed(1);

  const eastOnly = build(true, false).gradientHeading(cx, cy, 0, 1, probeDist);
  const northOnly = build(false, true).gradientHeading(cx, cy, 0, 1, probeDist);
  // Equal rise on both axes: correct sampling yields exactly -45 deg. The
  // defective version collapses this to ~-90 deg (north), because its east
  // probe is taken on the diagonal and its north term is measured against it.
  const diagonal = build(true, true).gradientHeading(cx, cy, 0, 1, probeDist);
  const neither = build(false, false).gradientHeading(cx, cy, 0.75, 1, probeDist);

  record(
    'G6a',
    'horizontal nutrient gradient steers due east',
    near(eastOnly, 0),
    `purely eastward field -> ${deg(eastOnly)} deg, want 0.0 (due east).`,
  );
  record(
    'G6b',
    'vertical nutrient gradient steers due north',
    near(northOnly, -Math.PI / 2),
    `purely northward field -> ${deg(northOnly)} deg, want 270.0 (due north).`,
  );
  record(
    'G6c',
    'diagonal gradient splits the two axes',
    near(diagonal, -Math.PI / 4, 0.02),
    `equal east+north rise -> ${deg(diagonal)} deg, want 315.0 (north-east). ` +
      `This is the discriminating case: comparing north against east, or probing ` +
      `east on the diagonal, collapses it toward due north instead.`,
  );
  record(
    'G6d',
    'flat field preserves heading',
    Math.abs(neither - 0.75) < 1e-9,
    `flat field -> heading ${neither.toFixed(6)}, want the passed-in 0.75 (no spurious steering).`,
  );

  // detritusHeading had the SAME defect and was fixed in the same commit, but
  // is a separate function with its own field and its own sampling calls. It
  // needs its own coverage: a regression here would be invisible to G6a-d.
  type DetritusProbe = GradientProbe & { detritus: { cols: number; rows: number; data: Float32Array } };
  const buildDetritus = (eastward: boolean, northward: boolean): DetritusProbe => {
    const w2 = new World({ config: { ...SMALL } });
    const p2 = w2 as unknown as DetritusProbe;
    const field = p2.detritus;
    for (let cy2 = 0; cy2 < field.rows; cy2++) {
      for (let cx2 = 0; cx2 < field.cols; cx2++) {
        const x = cx2 / (field.cols - 1);
        const y = 1 - cy2 / (field.rows - 1);
        field.data[cy2 * field.cols + cx2] = (eastward ? x : 0) + (northward ? y : 0);
      }
    }
    return p2;
  };

  const detEast = buildDetritus(true, false).detritusHeading(cx, cy, 0, 1, probeDist);
  const detNorth = buildDetritus(false, true).detritusHeading(cx, cy, 0, 1, probeDist);
  const detDiag = buildDetritus(true, true).detritusHeading(cx, cy, 0, 1, probeDist);

  record(
    'G6e',
    'detritus gradient matches nutrient gradient',
    near(detEast, 0) && near(detNorth, -Math.PI / 2) && near(detDiag, -Math.PI / 4, 0.02),
    `detritus: east=${deg(detEast)} deg (want 0.0), north=${deg(detNorth)} deg (want 270.0), ` +
      `diagonal=${deg(detDiag)} deg (want 315.0). Same axis sampling as the nutrient ` +
      `path; the two functions are separate and each needs its own guard.`,
  );
}

// ---------------------------------------------------------------------------
// G7 — trophic assimilation is applied exactly once
//
// A synthetic two-organism contest measures the ENERGY THE CONTEST YIELDED and
// compares it against BOTH candidate models: assimilation applied once (the
// herbivory structure, and the intended reading) and applied twice (the defect).
// A change in yield is worthless if it cannot be shown to be a specific factor
// rather than "the numbers moved".
//
// The quantity is read from the resolution record, not from store.energy:
// InteractionQueue.resolve computes a transfer and RECORDS it; applying it to
// organism state is resolveContests' job in the World. Reading the store after
// a bare resolve() reads 0 and would pass or fail for the wrong reason.
function gate7(): void {
  const store = new OrganismStore({ capacity: 2, label: 'gate7' });
  store.count = 2;
  store.id[0] = 1;
  store.id[1] = 2;

  const ao = 0 * TRAIT_COUNT;
  const dop = 1 * TRAIT_COUNT;
  const p = store.physical;

  // Predator: big, well-armed, and decisively the stronger contestant. Combat
// is decided by offensivePower vs defensivePower with a bounded random margin
  // on each side, so a merely-large predator still loses roughly half the
  // time; a gate that depends on that coin flip measures noise, not yield.
  p[ao + TRAIT.SIZE] = 8;
  p[ao + TRAIT.AGGRESSION] = 1;
  p[ao + TRAIT.SPEED] = 1;
  p[ao + TRAIT.BURST_POWER] = 1;
  p[ao + TRAIT.DIGESTION_RATE] = 0.5;
  p[ao + TRAIT.METABOLIC_EFFICIENCY] = 0.7;
  p[ao + TRAIT.TOXIN] = 0.5;
  p[ao + TRAIT.STORAGE_CAPACITY] = 1000;
  p[dop + TRAIT.SIZE] = 1;
  p[dop + TRAIT.STORAGE_CAPACITY] = 100;
  // Predator starts empty: fuel scales combat power, so a fed predator would
  // confound the win with headroom. Starting at zero also makes the room left
  // for intake equal to the full capacity.
  store.energy[0] = 0;
  store.energy[1] = 0;

  const q = new InteractionQueue();
  q.submit(store, 0, 1, INTERACTION.PREDATE, 0);

  const eff = p[ao + TRAIT.METABOLIC_EFFICIENCY];
  const digest = p[ao + TRAIT.DIGESTION_RATE];
  // Reproduction of the engine's own yield model, for the comparison only.
  // Every input is read back from the store rather than restated, so the
  // expected value cannot drift from what the engine was actually handed.
  const meatYield = 1;
  const preyMass = Math.pow(p[dop + TRAIT.SIZE], 1.4);
  const take = Math.min(0.9, 0.35 + digest * 0.6);
  const cd = 0.55 + eff * 0.35;
  const once = preyMass * meatYield * take * cd;
  const twice = once * cd;

  q.resolve(
    store,
    () => true,
    new Rng(4242),
    1e9,
    () => {},
    () => {},
    () => {},
    () => {},
    undefined,
    meatYield,
  );

  const gained = q.peekRecords()[0]?.delta ?? 0;
  const matchesOnce = Math.abs(gained - once) / Math.max(1e-9, once) < 0.02;
  const matchesTwice = Math.abs(gained - twice) / Math.max(1e-9, twice) < 0.02;

  record(
    'G7',
    'predation assimilation applied once, not squared',
    matchesOnce && !matchesTwice,
    `predator gained ${gained.toFixed(4)}; once=${once.toFixed(4)} (rel err ${(Math.abs(gained - once) / once).toFixed(4)}), ` +
      `twice=${twice.toFixed(4)}. Must match the single-application model and NOT the squared one. ` +
      `Herbivory has always been single-application; parity between the two paths is the intent.`,
  );
}

// ---------------------------------------------------------------------------
// G8 — mating requires reciprocal intent
//
// White-box, because the defect was invisible from outside: a one-sided
// submission produced offspring, so mating succeeded while looking like a
// two-sided event. Each case asserts the exact number of matured pairs.
function gate8(): void {
  type MatingProbe = {
    intent: Uint8Array<ArrayBuffer>;
    mateTarget: Int32Array<ArrayBuffer>;
    mateCandA: Int32Array<ArrayBuffer>;
    mateCandB: Int32Array<ArrayBuffer>;
    mateCandN: number;
    submittedByKind: Int32Array;
    resolveMatingIntent(): void;
  };

  const w = new World({ config: { ...SMALL } });
  const m = w as unknown as MatingProbe;
  m.intent.fill(INTENT.SETTLE, 0, 4);
  m.mateTarget.fill(-1, 0, 4);

  /** Stage a contact and report how many matings it produced. */
  const stage = (
    a: number,
    b: number,
    intentA: number,
    intentB: number,
    targetB: number,
  ): number => {
    m.intent[a] = intentA;
    m.intent[b] = intentB;
    m.mateTarget[a] = b; // the recorder always selected the partner
    m.mateTarget[b] = targetB;
    m.mateCandA[0] = a;
    m.mateCandB[0] = b;
    m.mateCandN = 1;
    const before = m.submittedByKind[INTERACTION.MATE];
    m.resolveMatingIntent();
    return m.submittedByKind[INTERACTION.MATE] - before;
  };

  const mutual = stage(0, 1, INTENT.MATE, INTENT.MATE, 0);
  const oneSided = stage(0, 1, INTENT.MATE, INTENT.FLEE, 0);
  const reversed = stage(0, 1, INTENT.GRAZE, INTENT.MATE, 0);
  // Both in MATE intent and in contact, but the partner is courting a third
  // organism. This is the case a slot-order-only filter silently drops.
  const courtingElsewhere = stage(0, 1, INTENT.MATE, INTENT.MATE, 2);

  // A mutual pair recorded from BOTH sides must still mature exactly once,
  // or onMate() is charged twice for a single pairing.
  m.intent[0] = INTENT.MATE;
  m.intent[1] = INTENT.MATE;
  m.mateTarget[0] = 1;
  m.mateTarget[1] = 0;
  m.mateCandA[0] = 0;
  m.mateCandB[0] = 1;
  m.mateCandA[1] = 1;
  m.mateCandB[1] = 0;
  m.mateCandN = 2;
  const beforeDup = m.submittedByKind[INTERACTION.MATE];
  m.resolveMatingIntent();
  const duplicated = m.submittedByKind[INTERACTION.MATE] - beforeDup;

  record(
    'G8a',
    'mutual intent matures a mating',
    mutual === 1,
    `both MATE -> ${mutual} mating(s), want 1.`,
  );
  record(
    'G8b',
    'one-sided intent does not mature a mating',
    oneSided === 0 && reversed === 0,
    `A=MATE/B=FLEE -> ${oneSided} (want 0); A=GRAZE/B=MATE -> ${reversed} (want 0). ` +
      `One-sided selection is not consent.`,
  );
  record(
    'G8c',
    'a mutually-recorded pair matures exactly once',
    duplicated === 1,
    `same pair staged from both sides -> ${duplicated} mating(s), want 1. ` +
      `Resolving twice would double-charge onMate() and double the offspring.`,
  );
  record(
    'G8d',
    'mating requires MUTUAL selection, not just mutual intent',
    courtingElsewhere === 0,
    `A=MATE with B, B=MATE with a THIRD organism -> ${courtingElsewhere} mating(s), want 0. ` +
      `Both being in MATE intent is not enough; B must have selected A back. ` +
      `Without this check the slot-order filter decides the outcome by slot ` +
      `index rather than by biology.`,
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// G9 — recycled nutrient is independent of grid resolution
//
// Mineralised substrate is returned to the nutrient field. If that return is
// broadcast to every cell while divided only by the pool count, the aggregate
// addition scales with nCells: refining the grid SILENTLY MANUFACTURES
// substrate. Nutrients sit outside the energy ledger, so the accounting
// residual cannot detect it — the books balance while matter appears from
// nowhere. This gate is the only guard, so it asserts the property directly:
// identical world area, two field resolutions, same aggregate nutrient.
//
// G10 — under `--zero`, no guild captures any energy.
//
// "Zero" is a claim about every energy-giving pathway at once. A missing
// guild branch in the capture gate leaves one guild still earning while the
// preset reports inert, which is a flatline that is not flat. This asserts
// capture per guild is zero, which is a stronger and more direct statement
// than any population outcome.
function gate9(): void {
  // Assert the ACTUAL nutrient-field writes, summed INSIDE the delivery loop.
  //
  // Two earlier versions were wrong. One compared recycledLastTick, which is
  // derived from the same `share` formula, so it passed even with the delivery
  // loop deleted. The next compared total applied across two grid resolutions —
  // but those two runs are DIFFERENT simulations that mineralise different
  // amounts, so comparing their totals compared two different experiments.
  //
  // The invariant is WITHIN one run: the amount written to the fields must equal
  // mineralised x recyclingRate x 0.5. That catches a missing nCells division
  // (which inflates the aggregate by the cell count) and a deleted loop (which
  // writes nothing), and it is resolution-independent by construction. Run at
  // two resolutions to show that.
  type W = {
    mineralisedLastTick: number;
    recycledLastTick: number;
    recycledAppliedLastTick: number;
    config: { recyclingRate: number };
    step(): void;
  };
  const run = (cell: number): { ratio: number; mineralised: number; applied: number; expected: number } => {
    const w = new World({
      config: { ...SMALL, worldW: 1600, worldH: 1600, fieldCell: cell, founders: 150, nutrientRegen: 0, excretionRate: 0 } as never,
    }) as unknown as W;
    for (let i = 0; i < 120; i++) w.step();
    const mineralised = w.mineralisedLastTick;
    const expected = mineralised * w.config.recyclingRate * 0.5;
    return { ratio: expected === 0 ? 0 : w.recycledAppliedLastTick / expected, mineralised, applied: w.recycledAppliedLastTick, expected };
  };
  const coarse = run(100); // 16 x 16 = 256 cells
  const fine = run(25); // 64 x 64 = 4096 cells, 16x more cells
  // Non-vacuity: both arms must actually have material to recycle, or a ratio
  // of 1 is earned by doing nothing.
  const fixtureOk = coarse.mineralised > 1e-3 && fine.mineralised > 1e-3;
  const ok = Math.abs(coarse.ratio - 1) < 1e-9 && Math.abs(fine.ratio - 1) < 1e-9;
  record(
    'G9',
    'recycled nutrient is actually written and grid-size invariant',
    fixtureOk && ok,
    `coarse(256 cells): mineralised=${coarse.mineralised.toFixed(4)} applied=${coarse.applied.toFixed(4)} ` +
      `expected=${coarse.expected.toFixed(4)} ratio=${coarse.ratio.toFixed(6)}; ` +
      `fine(4096 cells): mineralised=${fine.mineralised.toFixed(4)} applied=${fine.applied.toFixed(4)} ` +
      `expected=${fine.expected.toFixed(4)} ratio=${fine.ratio.toFixed(6)}. ` +
      `Applied is summed inside the delivery loop, so deleting that loop or dropping ` +
      `the nCells division both fail this. Totals are NOT compared across resolutions: ` +
      `those runs mineralise different amounts.`,
  );
}

function gate10(): void {
  // Assert on the PRESET, not on a hand-built config.
  //
  // The P0-2 defect was a routing error: `decomposerPhotoScale: 0` was written
  // into ZERO_LIFTABLE instead of ZEROED. A gate that sets the scales directly
  // in config would have stayed GREEN on exactly that code, because the engine
  // branch was fine and only the preset wiring was broken. So this gate must
  // go through the same preset the probe uses.
  // Walk upward for the repo root. This module runs from build/gates.js in
  // production and src/gates.ts under a bundler, so resolving relative to the
  // module alone points at the wrong directory in one of the two cases.
  let dir = dirname(fileURLToPath(import.meta.url));
  let probePath = '';
  for (let up = 0; up < 5; up++) {
    const candidate = join(dir, 'src', 'trace', 'scenesprobe.ts');
    if (existsSync(candidate)) { probePath = candidate; break; }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!probePath) {
    record('G10', 'the --zero preset actually zeroes every guild capture', false,
      'could not locate src/trace/scenesprobe.ts to assert the preset');
    return;
  }
  const probeSrc = readFileSync(probePath, 'utf8');
  // ZEROED ends with a spread IIFE (the lifts block), not `} as const`, so the
  // boundary is the spread rather than a closing brace.
  const zeroedBlock = /const ZEROED = ZERO \? \{([\s\S]*?)\n\s*\.\.\./.exec(probeSrc);
  const liftBlock = /const ZERO_LIFTABLE = \{([\s\S]*?)\n\} as const/.exec(probeSrc);
  const inZeroed = zeroedBlock ? /decomposerPhotoScale:\s*0/.test(zeroedBlock[1]) : false;
  const inLifts = liftBlock ? /decomposerPhotoScale/.test(liftBlock[1]) : false;
  // Asserted across BOTH probe entry points: `--zero` must mean the same
  // thing whichever probe runs it.
  const senesSrc = probePath.replace('scenesprobe.ts', 'senesprobe.ts');
  const senesOk = existsSync(senesSrc)
    ? /const ZEROED = ZERO \? \{([\s\S]*?)\n\s*\.\.\./.exec(readFileSync(senesSrc, 'utf8'))
      ?.slice(1)[0]?.includes('decomposerPhotoScale: 0') ?? false
    : false;
  record(
    'G10',
    'the --zero preset actually zeroes every guild capture',
    inZeroed && inLifts && senesOk,
    `scenesprobe: ZEROED sets it=${inZeroed} (required), ZERO_LIFTABLE lifts ` +
      `it=${inLifts} (also required — a preset you cannot override is not a ` +
      `knob); senesprobe: ZEROED sets it=${senesOk} (required). ` +
      `The P0-2 leak was the entry being in ZERO_LIFTABLE ONLY, which left the ` +
      `baseline ungated while making it look controllable. Asserted on BOTH ` +
      `probe entry points so --zero cannot mean different things per probe.`,
  );
}

function gate12(): void {
  // nutrientCyclic must not be a KILL-SWITCH.
  //
  // The phase-order defect this guards: clearing mineralisedCell at the TOP of
  // the substrate phase wiped the flux BEFORE the regen loop read it, so the
  // cyclic term always saw 0 and suppressed ALL regeneration. Every other gate
  // stayed green on that code -- verified by reintroducing it.
  //
  // So this asserts the read directly: with cyclic ON and mineralisers alive,
  // the flux the regen term observed must be non-zero.
  type W = { cyclicFluxLastTick: number; step(): void };
  // OWNER-AUTHORISED CANOPY CORRECTION EXPOSED A FAILURE HERE.
  //
  // The gate asserted the flux on the FINAL tick of a 150-tick run. Under the
  // corrected coarse-canopy lookup the legacy ecosystem's biotic mineralisation
  // loop no longer sustains: the flux is non-zero early (1.43 at tick 1, 0.46 at
  // tick 40) and has decayed to zero by roughly tick 100, so a final-tick read
  // reports the kill-switch defect on code that does not have it. Measured at
  // HEAD before the correction: 0.440647 on the final tick.
  //
  // What this gate exists to test is the READ/CLEAR ORDERING, not whether the
  // ecosystem sustains a mineralisation cycle — an equilibrium claim the model
  // does not make and this gate never asserted. The ORDERING is proven by the
  // term having EVER seen a non-zero flux, so that is what is measured, and the
  // OFF arm must be zero at every tick, which is the kill-switch's own signature.
  const arm = (cyclic: boolean): { peak: number; ticks: number } => {
    const w = new World({
      config: { ...SMALL, founders: 120, nutrientCyclic: cyclic } as never,
    }) as unknown as W;
    let peak = 0, ticks = 0;
    for (let k = 0; k < 150; k++) {
      w.step();
      if (w.cyclicFluxLastTick > peak) peak = w.cyclicFluxLastTick;
      if (w.cyclicFluxLastTick > 0) ticks++;
    }
    return { peak, ticks };
  };
  const on = arm(true);
  const off = arm(false);
  record(
    'G12',
    'nutrientCyclic reads a non-zero biotic flux (not a kill-switch)',
    on.peak > 0 && off.peak === 0,
    `peak cyclic flux with nutrientCyclic ON ${on.peak.toFixed(6)} over `
    + `${on.ticks}/150 ticks, OFF ${off.peak.toFixed(6)} (want ON>0 and OFF exactly 0). `
    + `NOTE: under the corrected canopy the legacy mineralisation loop decays to `
    + `zero by ~tick 100, so this asserts the read/clear ORDERING, not a `
    + `sustaining cycle.`,
  );
}

// ---------------------------------------------------------------------------
// G13-G18 — Modular genome v2.
//
// These assert the PROPERTIES the design rests on, before the mechanism is
// trusted to run inside a world. Each is a failure this repository has already
// committed once: a gene that changes nothing but appearance, a capability with
// no cost, a genome that does not reproduce, a default that is not really the
// default.
// ---------------------------------------------------------------------------

/** Run the module expression pipeline and return deltas + tally. */
function expressOne(
  modules: Float32Array, count: number, age: number, energy: number,
): { deltas: Float32Array; body: Uint8Array; total: number; upkeep: number } {
  const deltas = new Float32Array(TRAIT_COUNT);
  const body = new Uint8Array(BODY_GENE_COUNT);
  const t = expressModules(modules, count, age, energy, deltas, body);
  return { deltas, body, total: t.total, upkeep: t.upkeep };
}

function gate13(): void {
  // A modular genome must change BIOLOGY, not appearance.
  //
  // The defect this guards is the state of v1: 8 of 12 structural genes are
  // inherited and mutated and read by nothing. If a module genome can be built,
  // changed and passed on while leaving every trait untouched, then it is the
  // same decorative apparatus wearing a new data structure.
  const rng = new Rng(90210);
  const { modules, count } = seedFounderModules(rng, 7);
  const adult = expressOne(modules, count, 1, 1);
  const touched: string[] = [];
  for (let t = 0; t < TRAIT_COUNT; t++) {
    if (Math.abs(adult.deltas[t]) > 1e-6) touched.push(TRAITS[t].name);
  }
  record(
    'G13',
    'module genome expresses into real traits, not just appearance',
    touched.length >= 6,
    `${count} modules -> ${touched.length} of ${TRAIT_COUNT} traits shifted: ` +
      `${touched.slice(0, 8).join(', ')}${touched.length > 8 ? '...' : ''}. ` +
      'A genome that moved only body genes would be v1 with extra steps.',
  );
}

function gate14(): void {
  // Every capability must COST something.
  //
  // A module with no upkeep would be selected for unconditionally, so the
  // genome would be a thermometer: every lineage converges on maximal
  // structure and the trade-off the design is built around disappears.
  let unpaid = 0;
  const prices: string[] = [];
  for (const spec of MODULE_SPECS) {
    prices.push(`${spec.name}=${spec.upkeep}`);
    if (!(spec.upkeep > 0)) unpaid++;
  }
  record(
    'G14',
    'every module carries a maintenance cost',
    unpaid === 0,
    `upkeep per unit magnitude: ${prices.join(' ')}. ` +
      `${unpaid} module(s) with no cost — a free capability is selected for ` +
      'unconditionally and evolution has nothing to choose between.',
  );
}

function gate15(): void {
  // Development: the SAME genome must express differently with age.
  //
  // This is the difference between a body plan and a life history. If a genome
  // expresses identically at every age, then `onset` is decoration and the
  // developmental claim is unfalsifiable.
  const rng = new Rng(31337);
  const { modules, count } = seedFounderModules(rng, 6);
  const juvenile = expressOne(modules, count, 0.05, 1);
  const adult = expressOne(modules, count, 1.0, 1);
  record(
    'G15',
    'the same genome expresses different structure at different life stages',
    juvenile.total < adult.total * 0.98,
    `structure expressed: juvenile=${juvenile.total.toFixed(4)} adult=${adult.total.toFixed(4)}. ` +
      'Identical values would mean onset is decorative and development is not real.',
  );
}

function gate16(): void {
  // Condition gating: the same genome in a starved body is a different animal.
  //
  // Regulation that only ever tracks age is a timer, not a regulatory system.
  const mods = new Float32Array(MAX_MODULES * MODULE_STRIDE);
  mods[MODULE_STRIDE_KIND] = GENE_MODULE.DEFENSE;
  mods[MODULE_STRIDE_MAG] = 1;
  mods[MODULE_STRIDE_ONSET] = 0;
  mods[MODULE_STRIDE_GATE] = 0.6; // needs 60% reserve to express
  const fed = expressOne(mods, 1, 1.0, 0.9);
  const starved = expressOne(mods, 1, 1.0, 0.2);
  record(
    'G16',
    'a gated module is expressed conditionally, not only by age',
    fed.total > 0.5 && starved.total === 0,
    `gated DEFENSE at 90% reserve -> ${fed.total.toFixed(3)}; at 20% reserve -> ` +
      `${starved.total.toFixed(3)}. A gate that ignored condition would express ` +
      'both, which is an age timer wearing a gate.',
  );
}

function gate17(): void {
  // Structural evolution: duplication and deletion must actually move the body.
  const rng = new Rng(4242);
  const { modules, count } = seedFounderModules(rng, 6);
  const child = new Float32Array(MAX_MODULES * MODULE_STRIDE);

  // Duplication at certainty must grow the genome.
  const duped = inheritModules(rng, modules, count, child, 0, 1, 0);
  // Deletion at certainty must shrink it toward empty.
  const deleted = inheritModules(rng, modules, count, child, 0, 0, 1);

  record(
    'G17',
    'duplication and deletion change genome length (structural evolution)',
    duped > count && deleted < count,
    `parent=${count} modules -> duplication=${duped} -> deletion=${deleted}. ` +
      'Point mutation alone cannot change body PLAN; only these operators can.',
  );
}

function gate18(): void {
  // Recombination: the child must draw from BOTH parents.
  //
  // v1 birth draws from one parent, so mating has never mixed genes. The test
  // builds parents with DISJOINT module vocabularies, so any child carrying a
  // B-only kind can only have got it from B. Testing against two founders
  // seeded round-robin proves nothing: both would hold the same kind set and a
  // whole-genome take would be indistinguishable from a real crossover.
  const rng = new Rng(777);
  const a = genomeOf([GENE_MODULE.SEGMENT, GENE_MODULE.LIGHT_CAPTURE, GENE_MODULE.LOCOMOTOR]);
  const b = genomeOf([GENE_MODULE.SENSORY, GENE_MODULE.DEFENSE, GENE_MODULE.ANCHOR]);
  const child = new Float32Array(MAX_MODULES * MODULE_STRIDE);

  let bothParents = 0;
  let neitherB = 0;
  const trials = 40;
  for (let t = 0; t < trials; t++) {
    const n = recombineModules(rng, a, 3, b, 3, child, 0);
    const kinds = new Set<number>();
    for (let i = 0; i < n; i++) kinds.add(child[i * MODULE_STRIDE + MODULE_STRIDE_KIND] | 0);
    const fromA = [...kinds].some((k) => k === GENE_MODULE.SEGMENT || k === GENE_MODULE.LIGHT_CAPTURE || k === GENE_MODULE.LOCOMOTOR);
    const fromB = [...kinds].some((k) => k === GENE_MODULE.SENSORY || k === GENE_MODULE.DEFENSE || k === GENE_MODULE.ANCHOR);
    if (fromA && fromB) bothParents++;
    if (!fromB) neitherB++;
  }
  record(
    'G18',
    'recombination draws modules from both parents',
    bothParents > trials * 0.8 && neitherB <= trials * 0.2,
    `${bothParents}/${trials} children carried modules from BOTH parents; ` +
      `${neitherB}/${trials} carried none from B. Parents hold disjoint module ` +
      'vocabularies, so a B-only kind in a child can only have come from B.',
  );
}

/** Build a module genome from an explicit kind list; magnitudes vary by seed. */
function genomeOf(kinds: readonly number[]): Float32Array {
  const modules = new Float32Array(MAX_MODULES * MODULE_STRIDE);
  for (let i = 0; i < kinds.length; i++) {
    const b = i * MODULE_STRIDE;
    modules[b + MODULE_STRIDE_KIND] = kinds[i];
    modules[b + MODULE_STRIDE_MAG] = 0.4 + 0.1 * i;
    modules[b + MODULE_STRIDE_ONSET] = 0;
    modules[b + MODULE_STRIDE_GATE] = 1;
  }
  return modules;
}

function gate19(): void {
  // The null-default contract, asserted AT THE ENGINE rather than on the module.
  //
  // G13-G18 prove the module machinery. This proves the DIAGNOSTIC framing: with
  // `genomeV2` unset the world must be bit-identical to declared behaviour, and
  // with it set the world must actually differ. A knob that is neither inert
  // when off nor active when on is the dead-knob class this repository forbids:
  // it parses, it prints, and it may do nothing at all.
  const arm = (v2: boolean | null): { pop: number; size: number; modules: number } => {
    const w = new World({
      config: { ...SMALL, genomeV2: v2 } as never,
    }) as unknown as {
      store: { capacity: number; moduleCount: Uint8Array; physical: Float32Array };
      live: Uint8Array;
      step(): void;
    };
    for (let k = 0; k < 250; k++) w.step();
    const st = w.store;
    let pop = 0, size = 0, mods = 0;
    for (let i = 0; i < st.capacity; i++) {
      if (!w.live[i]) continue;
      pop++;
      size += st.physical[i * TRAIT_COUNT + TRAIT.SIZE];
      mods += st.moduleCount[i];
    }
    return { pop, size: Number(size.toFixed(4)), modules: mods };
  };
  const off = arm(null);
  const on = arm(true);
  record(
    'G19',
    'genomeV2 is inert when unset and active when set (no dead knob)',
    off.modules === 0 && on.modules > 0 && (off.pop !== on.pop || off.size !== on.size),
    `genomeV2=null -> pop=${off.pop} sizeSum=${off.size} modules=${off.modules}; ` +
      `genomeV2=true -> pop=${on.pop} sizeSum=${on.size} modules=${on.modules}. ` +
      'Unset must carry no modules at all and reproduce declared behaviour exactly; ' +
      'set must actually change the world, or the knob is decorative.',
  );
}

function gate20(): void {
  // The module upkeep must actually be CHARGED, not merely declared.
  //
  // G14 checks that the metadata says upkeep > 0. That passed while the NET
  // basal-cost delta was identically zero: the cost list subtracted the upkeep
  // and the charge added back the same quantity. Metadata is not payment. This
  // asserts the net expressed figure a world would actually pay.

  let worst = 0;
  const lines: string[] = [];
  for (let k = 0; k < GENE_MODULE_COUNT; k++) {
    const m = new Float32Array(MAX_MODULES * MODULE_STRIDE);
    m[MODULE_STRIDE_KIND] = k;
    m[MODULE_STRIDE_MAG] = 1;
    m[MODULE_STRIDE_ONSET] = 0;
    m[MODULE_STRIDE_GATE] = 1;
    const d = new Float32Array(TRAIT_COUNT);
    expressModules(m, 1, 1, 1, d, new Uint8Array(BODY_GENE_COUNT));
    const net = d[TRAIT.BASAL_COST];
    const declared = MODULE_SPECS[k].upkeep;
    // Tolerance is RELATIVE, at float32 resolution.
    //
    // The delta is stored in a Float32Array while `declared` is a float64
    // constant, so the two cannot agree more closely than ~1e-7 relative. An
    // absolute 1e-9 threshold is tighter than float32 can represent, so it
    // silently passed only because the original upkeep constants happened to
    // round favourably; adding 0.028/0.032/0.038 made it fail for arithmetic
    // reasons alone.
    //
    // The assertion this gate actually exists for — that the net charge is NOT
    // zero — is unaffected: a double-booked module nets exactly 0.0, which is a
    // 100% relative error and fails at any tolerance.
    const denom = Math.max(1e-6, Math.abs(declared));
    if (Math.abs(net - declared) / denom > 1e-5) worst++;
    lines.push(`${MODULE_SPECS[k].name}=${net.toFixed(4)}/${declared}`);
  }
  record(
    'G20',
    'module upkeep is actually CHARGED to basal cost, not double-booked away',
    worst === 0,
    `net basal-cost delta vs declared upkeep: ${lines.join(' ')}. ` +
      `${worst} module(s) mismatch — a cost that cancels algebraically is a ` +
      'capability the organism is never charged for.',
  );
}

function gate21(): void {
  // DEVELOPMENT IN THE LIVE WORLD, not just in the helper.
  //
  // G15 proved the development curve in isolation. This proves an organism in
  // a running world actually departs from its UNEXPRESSED birth state as it
  // matures. The defect this guards: phenotypes are derived once at birth, a
  // newborn is age 0, and developmentFactor(0, onset) is zero for every valid
  // onset — so modules were gated to zero at birth and never re-expressed.
  // Every standalone gate stayed green while development did nothing.
  //
  // Measured against the birth baseline, NOT against a single later snapshot:
  // a mature organism's expressed traits then fall back toward the baseline
  // once its energy cannot sustain them (that is the condition gate, asserted
  // separately in G23), so a begin/end comparison can read as "unchanged"
  // while development plainly happened in between.
  type W = {
    store: {
      capacity: number; moduleCount: Uint8Array;
      physical: Float32Array; age: Int32Array; hitRadius: Float32Array;
    };
    live: Uint8Array; step(): void; config: { genomeV2: boolean | null };
  };
  const w = new World({
    config: { ...SMALL, genomeV2: true } as never,
  }) as unknown as W;
  const st = w.store;

  let watched = -1;
  for (let tick = 0; tick < 700 && watched < 0; tick++) {
    w.step();
    for (let i = 0; i < st.capacity; i++) {
      if (w.live[i] && st.moduleCount[i] > 0) { watched = i; break; }
    }
  }
  if (watched < 0) {
    record('G21', 'module structure develops in the live world', false,
      'no organism carrying modules was observed; cannot test development');
    return;
  }

  // Birth baseline: every module is developmentally gated to zero at age 0,
  // so this IS the unexpressed organism.
  const baseArmor = st.physical[watched * TRAIT_COUNT + TRAIT.ARMOR];
  const baseHit = st.hitRadius[watched];
  const bornAge = st.age[watched];
  let peakArmor = baseArmor, peakHit = baseHit, peakAge = bornAge;

  for (let tick = 0; tick < 400; tick++) {
    w.step();
    if (!w.live[watched]) break;
    const a = st.physical[watched * TRAIT_COUNT + TRAIT.ARMOR];
    const h = st.hitRadius[watched];
    if (Math.abs(a - baseArmor) > Math.abs(peakArmor - baseArmor)) {
      peakArmor = a; peakAge = st.age[watched];
    }
    if (Math.abs(h - baseHit) > Math.abs(peakHit - baseHit)) peakHit = h;
  }

  const devArmor = Math.abs(peakArmor - baseArmor);
  const devHit = Math.abs(peakHit - baseHit);
  const developed = devArmor > 1e-4 || devHit > 1e-4;
  record(
    'G21',
    'module structure develops in the live world (not only in the helper)',
    developed,
    `organism slot ${watched} (born age ${bornAge}, ${st.moduleCount[watched]} modules) ` +
      `departed from its unexpressed birth state: armor ${baseArmor.toFixed(5)} -> ` +
      `${peakArmor.toFixed(5)} (peak at age ${peakAge}, deviation ${devArmor.toFixed(5)}), ` +
      `hitRadius ${baseHit.toFixed(4)} -> ${peakHit.toFixed(4)} (deviation ${devHit.toFixed(4)}). ` +
      'Unchanged values mean phenotypes are frozen at birth and development is inert.',
  );
}

function gate23(): void {
  // CONDITIONAL REGULATION IN THE LIVE WORLD.
  //
  // G16 proved the condition gate in isolation. This proves it bites in the
  // engine: a module costs upkeep, an organism that cannot pay must shed it.
  // Scanned across the whole population rather than one tracked organism, so it
  // cannot be defeated by an individual that simply outlives the observation
  // window or dies mid-scan.
  type W = {
    store: {
      capacity: number; moduleCount: Uint8Array;
      physical: Float32Array; energy: Float32Array;
    };
    live: Uint8Array; step(): void; config: { genomeV2: boolean | null };
  };
  const w = new World({
    config: { ...SMALL, genomeV2: true } as never,
  }) as unknown as W;
  const st = w.store;
  const armorOf = (i: number) => st.physical[i * TRAIT_COUNT + TRAIT.ARMOR];

  const prevArmor = new Float64Array(st.capacity);
  const prevEnergy = new Float64Array(st.capacity);
  const tracked = new Uint8Array(st.capacity);

  let sheddings = 0;
  let first = '';
  for (let tick = 0; tick < 600 && sheddings === 0; tick++) {
    w.step();
    for (let i = 0; i < st.capacity; i++) {
      const a = armorOf(i);
      if (tracked[i] && w.live[i] && st.moduleCount[i] > 0
        && a < prevArmor[i] - 1e-6 && st.energy[i] < prevEnergy[i]) {
        sheddings++;
        if (!first) {
          first = `slot ${i}: armor ${prevArmor[i].toFixed(5)} -> ${a.toFixed(5)} ` +
            `while energy fell ${prevEnergy[i].toFixed(2)} -> ${st.energy[i].toFixed(2)}`;
        }
      }
      if (w.live[i] && st.moduleCount[i] > 0) {
        tracked[i] = 1; prevArmor[i] = a; prevEnergy[i] = st.energy[i];
      } else {
        tracked[i] = 0;
      }
    }
  }
  record(
    'G23',
    'module expression is shed under energy stress in the live world',
    sheddings > 0,
    sheddings > 0
      ? `conditional regulation observed in-engine: ${first}. A module's upkeep ` +
        'is only paid while the organism can afford it, so expressed traits fall ' +
        'back toward the unexpressed baseline as energy declines.'
      : 'no module-bearing organism shed expressed traits as its energy declined. ' +
        'Either condition gates never reach the engine, or upkeep is not ' +
        'actually charged — check G20 before trusting this.',
  );
}

function gate25(): void {
  // MODULE-DRIVEN STRUCTURE MUST REACH THE BODY IN THE LIVE WORLD.
  //
  // Review found this was silently lost: the expressed structural view was
  // seeded with the inherited body genes AFTER the module deltas had been
  // applied into it, so the seed clobbered them. `this.body` was then built
  // from the un-extended inherited vector, and hit/sense radius — which read
  // shell, spines and eyeCount — never saw a module's structural effect at all.
  //
  // A trait-level gate cannot catch this: module TRAITS moved correctly while
  // every module that alters body plan was a no-op. The assertion is on BODY
  // STRUCTURE and the geometry derived from it.
  type W = {
    store: {
      capacity: number; moduleCount: Uint8Array; bodyGenes: Uint8Array;
      phen: Phenotype[]; hitRadius: Float32Array;
    };
    live: Uint8Array; step(): void; config: { genomeV2: boolean | null };
  };
  const w = new World({
    config: { ...SMALL, genomeV2: true } as never,
  }) as unknown as W;
  const st = w.store;

  let watched = -1;
  for (let tick = 0; tick < 700 && watched < 0; tick++) {
    w.step();
    for (let i = 0; i < st.capacity; i++) {
      if (w.live[i] && st.moduleCount[i] > 0) { watched = i; break; }
    }
  }
  if (watched < 0) {
    record('G25', 'module structure reaches the body plan in the live world', false,
      'no module-bearing organism observed; cannot test structural expression');
    return;
  }

  // The INHERITED genotype, captured once. It must not move: a phenotype is a
  // pure function of its genome and must never write structure back into it.
  const bg0 = Array.from(st.bodyGenes.subarray(watched * BODY_GENE_COUNT, (watched + 1) * BODY_GENE_COUNT));
  const b0 = st.phen[watched].body;
  const born = {
    segments: b0.segments, eyeCount: b0.eyeCount, shell: b0.shell, spines: b0.spines,
  };
  const hit0 = st.phen[watched].hitRadius;
  const sense0 = st.phen[watched].senseRadius;

  let peak = { ...born };
  let peakHit = hit0, peakSense = sense0;
  for (let tick = 0; tick < 400; tick++) {
    w.step();
    if (!w.live[watched]) break;
    const b = st.phen[watched].body;
    if (b.segments > peak.segments) peak.segments = b.segments;
    if (b.eyeCount > peak.eyeCount) peak.eyeCount = b.eyeCount;
    if (b.shell > peak.shell) peak.shell = b.shell;
    if (b.spines > peak.spines) peak.spines = b.spines;
    if (st.phen[watched].hitRadius > peakHit) peakHit = st.phen[watched].hitRadius;
    if (st.phen[watched].senseRadius > peakSense) peakSense = st.phen[watched].senseRadius;
  }

  const structureChanged =
    peak.segments !== born.segments || peak.eyeCount !== born.eyeCount
    || peak.shell !== born.shell || peak.spines !== born.spines;
  const geometryChanged =
    Math.abs(peakHit - hit0) > 1e-6 || Math.abs(peakSense - sense0) > 1e-6;
  const bg1 = Array.from(st.bodyGenes.subarray(watched * BODY_GENE_COUNT, (watched + 1) * BODY_GENE_COUNT));
  const genotypeIntact = bg0.every((v, i) => v === bg1[i]);

  record(
    'G25',
    'module structure reaches the body plan and its derived geometry',
    structureChanged && geometryChanged && genotypeIntact,
    `slot ${watched}: segments ${born.segments}->${peak.segments}, ` +
      `eyeCount ${born.eyeCount}->${peak.eyeCount}, shell ${born.shell}->${peak.shell}, ` +
      `spines ${born.spines}->${peak.spines}; hitRadius ${hit0.toFixed(4)}->${peakHit.toFixed(4)}, ` +
      `senseRadius ${sense0.toFixed(2)}->${peakSense.toFixed(2)}. ` +
      `Inherited genotype ${genotypeIntact ? 'UNCHANGED' : 'MUTATED (heritable readout!)'}. ` +
      'Unchanged structure means modules build traits but no body, and the ' +
      'geometry derived from structure never moves.',
  );
}

function gate24(): void {
  // A LIVE MATING must produce DNA from BOTH parents.
  //
  // The review found the crossover guard in the birth path could never pass:
  // it compared the mate slot's organism id against `parentId + 1`, which is
  // not how ids relate, so recombination silently never fired and every sexual
  // birth was really an asexual clone. Helper-level tests cannot catch that —
  // they call recombineModules directly and never travel the birth path.
  //
  // This drives an actual birth through the real queue, records both parents'
  // module genomes beforehand, and inspects the resulting child.
  type W = {
    store: {
      capacity: number; moduleCount: Uint8Array; geneModules: Float32Array; id: Int32Array;
    };
    live: Uint8Array; step(): void; config: { genomeV2: boolean | null };
    queueBirth(parentSlot: number, count: number, lineageOverride?: number, mateSlot?: number): void;
  };
  const w = new World({
    config: { ...SMALL, genomeV2: true } as never,
  }) as unknown as W;
  const st = w.store;

  const kindsOf = (slot: number): number[] => {
    const n = st.moduleCount[slot];
    const base = slot * MAX_MODULES * MODULE_STRIDE;
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(st.geneModules[base + i * MODULE_STRIDE + MODULE_STRIDE_KIND]);
    return out;
  };

  let mixed = 0;
  let clones = 0;
  let detail = '';
  let attempts = 0;

  for (let round = 0; round < 40 && mixed === 0; round++) {
    for (let i = 0; i < 30; i++) w.step();

    const bearers: number[] = [];
    for (let i = 0; i < st.capacity; i++) {
      if (w.live[i] && st.moduleCount[i] >= 2) bearers.push(i);
    }
    if (bearers.length < 2) continue;
    const a = bearers[round % bearers.length];
    let b = bearers[(round + 1) % bearers.length];
    if (b === a) b = bearers[(round + 2) % bearers.length];
    if (b === a) continue;

    const ka = kindsOf(a);
    const kb = kindsOf(b);
    if (ka.length === 0 || kb.length === 0) continue;

    const idsBefore = new Set<number>();
    for (let i = 0; i < st.capacity; i++) if (w.live[i]) idsBefore.add(st.id[i]);

    attempts++;
    w.queueBirth(a, 1, -1, b);
    w.step();

    let child = -1;
    for (let i = 0; i < st.capacity; i++) {
      if (w.live[i] && !idsBefore.has(st.id[i])) { child = i; break; }
    }
    if (child < 0 || st.moduleCount[child] === 0) continue;

    const kc = kindsOf(child);

    // The precise signature of this operator: the child is parent A's modules
    // [0..cut) followed by parent B's modules [cut..bCount), for some interior
    // cut. Asserting "contains something only A had" would be meaningless —
    // founders draw ~7 modules from 7 kinds, so both parents usually carry
    // every kind and such a test passes on a clone.
    let cut = -1;
    for (let c = 1; c < kc.length; c++) {
      let ok = true;
      for (let i = 0; i < c && i < ka.length; i++) {
        if (kc[i] !== ka[i]) { ok = false; break; }
      }
      if (!ok) continue;
      for (let i = c; i < kc.length; i++) {
        if (i >= kb.length || kc[i] !== kb[i]) { ok = false; break; }
      }
      if (ok) { cut = c; break; }
    }

    const foreign = kc.filter((k) => !ka.includes(k) && !kb.includes(k));
    const cloneOfA = kc.length === ka.length && kc.every((k, i) => k === ka[i]);
    const cloneOfB = kc.length === kb.length && kc.every((k, i) => k === kb[i]);
    if (cloneOfA || cloneOfB) { clones++; continue; }

    // A splice is only EVIDENCE of two-parent inheritance if the two parents
    // actually disagree somewhere, and the child resolves a disagreement in
    // each parent's favour. Without this, two identical genomes "recombine"
    // into something indistinguishable from a clone and the gate passes on an
    // outcome that proves nothing. Review caught that clones were counted but
    // not excluded.
    let wonByA = 0, wonByB = 0;
    if (cut > 0) {
      for (let i = 0; i < cut && i < ka.length; i++) {
        if (ka[i] !== kb[i] && kc[i] === ka[i]) wonByA++;
      }
      for (let i = cut; i < kc.length; i++) {
        if (i < kb.length && kb[i] !== ka[i] && kc[i] === kb[i]) wonByB++;
      }
    }

    if (cut > 0 && foreign.length === 0 && wonByA > 0 && wonByB > 0) {
      mixed++;
      detail = `parent slot ${a} [${ka.join(',')}] x parent slot ${b} [${kb.join(',')}] ` +
        `-> child slot ${child} [${kc.join(',')}] = first ${cut} module(s) of the ` +
        `first parent + modules ${cut}.. of the second. The parents disagree at ` +
        `${wonByA} position(s) resolved for the first parent and ${wonByB} for ` +
        'the second, none foreign, and the child is a clone of neither.';
    }
  }

  record(
    'G24',
    'a live mating produces module DNA from BOTH parents',
    mixed > 0,
    mixed > 0
      ? `${detail} (${attempts} mating(s) attempted through the real birth ` +
        `queue; ${clones} produced a pure single-parent clone and were excluded)`
      : `no child combined modules from BOTH parents with each parent's ` +
        `distinctive modules actually present across ${attempts} mating(s) ` +
        `(${clones} excluded as single-parent clones). If the mate guard in the ` +
        'birth path does not pass, recombination never runs and every sexual ' +
        'birth is an asexual clone.',
  );
}

function gate22(): void {
  // Slot reuse must not resurrect a dead neighbour's genome.
  //
  // A structural deletion can produce a child with ZERO modules. If that child
  // reuses a freed slot and module state is only written when count > 0, the
  // previous occupant's moduleCount and block survive — a zero-module organism
  // carrying its dead neighbour's DNA, which then breeds.
  const w = new World({ config: { ...SMALL, genomeV2: true } as never }) as unknown as {
    store: { capacity: number; moduleCount: Uint8Array };
    step(): void;
  };
  const st = w.store;
  for (let i = 0; i < 200; i++) w.step();

  // Force the failure directly: a live slot is given a stale non-zero module
  // count, then released and re-allocated. The re-allocation must reset it.
  let dirty = -1;
  for (let i = 0; i < st.capacity; i++) if (st.moduleCount[i] > 0) { dirty = i; break; }
  if (dirty < 0) {
    record('G22', 'module state resets on slot reuse', false, 'no module-bearing organism found');
    return;
  }
  // Simulate the stale-occupant condition the review identified: a non-zero
  // count sitting on a slot that is about to be handed to a zero-module child.
  const internals = w as unknown as {
    store: { moduleCount: Uint8Array; live: Uint8Array };
    live: Uint8Array; populateSlot: (slot: number, g: Float32Array, b: Uint8Array,
      pid: number, lin: number, born: number, mods?: Float32Array | null, n?: number) => void;
  };
  const slot = dirty;
  const g = new Float32Array(TRAIT_COUNT);
  const b = new Uint8Array(BODY_GENE_COUNT);
  internals.live[slot] = 0;
  internals.populateSlot(slot, g, b, -1, -1, 0, null, 0);
  record(
    'G22',
    'a zero-module child resets stale module state on slot reuse',
    internals.store.moduleCount[slot] === 0,
    `slot ${slot} reused by a zero-module child: moduleCount now ` +
      `${internals.store.moduleCount[slot]} (want 0). A non-zero value means the ` +
      'previous occupant\'s genome is still readable and would be inherited.',
  );
}

/**
 * G26 — the reaction network is element-balanced on paper.
 *
 * FINDING 5 FOLLOW-UP. Four reactions created elements rather than
 * transforming them: sulfur oxidation carried a zero-coefficient DIC
 * placeholder where its carbon substrate belonged, iron oxidation had no carbon
 * entry at all, anaerobic decomposition emitted sulfide without drawing organic
 * sulfur, and ligninolysis released phosphate without drawing litter
 * phosphorus. Every one of those produced a healthy-looking run and a
 * conservation residual nobody could locate in the network, because by
 * inspection the network looked fine.
 *
 * This is a STATIC check on the declared stoichiometry. It cannot be satisfied
 * by a model that balances at runtime for the wrong reason, and it catches a
 * mis-declared coefficient before a single tick runs.
 *
 * Denitrification is exempt BY DECLARATION: it destroys 1.4 mol of nitrogen per
 * unit extent, and that nitrogen leaves as N2 gas, which is booked as an
 * external export in the audit. An exemption that is written down is a claim;
 * an exemption that is merely true is a hole.
 */
function gate26(): void {
  // The `E` enum order is C, H, O, N, P, S, Fe. Guessing this order wrong makes
  // every gate below report another element's residual, which is worse than no
  // gate at all because it still looks like a measurement.
  const NAME = ['C', 'H', 'O', 'N', 'P', 'S', 'Fe'];
  const POOL_ELEMENT: readonly number[] = [
    2, 0, 3, 3, 3, 4, 5, 5, 6, 6,
    0, 3, 4, 5, 6,
    0, 3, 4, 5,
    0, 3, 4, 5, 6,
    1,
  ];
  const EXEMPT: Record<string, string> = {
    'denitrification': 'N2 leaves as gas; booked as an external export',
  };
  const bad: string[] = [];
  for (const r of REACTIONS) {
    const net: Record<string, number> = {};
    for (const s of r.substrates) net[NAME[POOL_ELEMENT[s.pool]]] =
      (net[NAME[POOL_ELEMENT[s.pool]]] ?? 0) - s.coeff;
    for (const p of r.products) net[NAME[POOL_ELEMENT[p.pool]]] =
      (net[NAME[POOL_ELEMENT[p.pool]]] ?? 0) + p.coeff;
    const leak = Object.entries(net).filter(([e, v]) =>
      Math.abs(v) > 1e-9 && e !== 'O' && e !== 'H' && !EXEMPT[r.name]);
    if (leak.length) {
      bad.push(`${r.name}: ${leak.map(([e, v]) => `${e} ${v > 0 ? '+' : ''}${v.toFixed(3)}`).join(', ')}`);
    }
  }
  record('G26', 'reaction network is element-balanced', bad.length === 0,
    bad.length === 0
      ? `all ${REACTIONS.length} reactions balance across C, N, P, S, Fe `
        + `(denitrification exempt by declared gas export)`
      : `unbalanced reactions:\n         - ${bad.join('\n         - ')}`);
}

/**
 * G27 — elemental conservation holds in a RUNNING world.
 *
 * G26 proves the declared coefficients are balanced. It says nothing about
 * whether the engine HONOURS them: the same-organism contention defect (finding
 * 4) had perfectly balanced stoichiometry and still created 13 mol of matter,
 * because several reactions inside one organism read the same uncancelled
 * availability and settle() clamped the consumption while crediting the
 * products in full.
 *
 * So the balance must be observed in a live world, over a horizon long enough
 * for organisms to grow, die and be replaced. Anything less would pass on a
 * model that does nothing.
 *
 * H and O are EXCLUDED BY DECLARATION: they are carried by an external, buffered
 * water reservoir. No conservation is claimed across that boundary, so a
 * residual there is a known and accepted property of the model, not a pass and
 * not a failure. Including them would make this gate green by asserting
 * something the model never promised.
 */
function gate27(): void {
  const chemCfg = { seed: 517, founders: 400, genomeV2: true, chemistry: true } as const;
  const w = new World({ config: chemCfg as never });
  for (let i = 0; i < 300; i++) w.step();
  const a = w.chemAudit;
  if (!a) {
    record('G27', 'elemental conservation holds in a running world', false,
      'no chemistry audit produced; the knob may not have engaged');
    return;
  }
  const NAME = ['C', 'H', 'O', 'N', 'P', 'S', 'Fe'];
  const CHECKED = ['C', 'N', 'P', 'S', 'Fe'];
  // 0.1% of the accounted total. The measured residuals are ~0.0003%; the
  // tolerance is loose enough to survive float64 reassociation and tight
  // enough that the defects this gate exists for were 10^3 to 10^5 times larger.
  const TOL = 1e-3;
  const lines: string[] = [];
  let worst = 0;
  let fail = false;
  for (let e = 0; e < NAME.length; e++) {
    if (!CHECKED.includes(NAME[e])) continue;
    const held = a.biomass[e] + a.stores[e] + a.environment[e];
    const accounted = a.initial[e] + a.inputs[e] - a.outputs[e];
    const denom = Math.abs(accounted);
    if (denom < 1e-9) continue;
    const rel = (held - accounted) / denom;
    worst = Math.max(worst, Math.abs(rel));
    if (Math.abs(rel) > TOL) fail = true;
    lines.push(`${NAME[e]} ${(rel * 100).toFixed(4)}%`);
  }
  const clamp = w.chemistry!.totalClamped();
  if (clamp > 1) fail = true;
  record('G27', 'elemental conservation holds in a running world', !fail,
    `${lines.join('  ')} | cumulative settle clamp ${clamp.toFixed(4)} mol `
    + `(tolerance ${(TOL * 100).toFixed(2)}%)`);
}

/**
 * G28 — living tissue actually grows.
 *
 * Conservation cannot see this. A world in which nothing is ever built
 * conserves matter perfectly: the same molecules move between pools forever. So
 * the previous evidence base — seven elements balancing to four decimals — was
 * compatible with an ecosystem in which no organism had ever grown a gram, and
 * with one in which no organism had ever been born. Both are conserved worlds.
 *
 * This asserts positive tissue growth observed in a running world, and that the
 * carbon in that tissue came from the chemistry path's own bookkeeping rather
 * than appearing on its own.
 */
function gate28(): void {
  const w = new World({ config: { seed: 517, founders: 400, genomeV2: true, chemistry: true } as never });
  const st = w.chemStores!;
  let c0 = 0;
  for (let s = 0; s < w.store.capacity; s++) if (w.aliveAt(s)) c0 += st.biomass[s * E_RUNTIME_COUNT];
  for (let i = 0; i < 400; i++) w.step();
  let c1 = 0;
  for (let s = 0; s < w.store.capacity; s++) if (w.aliveAt(s)) c1 += st.biomass[s * E_RUNTIME_COUNT];

  // OWNER-AUTHORISED CANOPY CORRECTION EXPOSED A FAILURE HERE.
  //
  // This asserted NET standing living carbon increases across the window. Under
  // the corrected canopy the legacy balance tips so that tissue is still built
  // but deaths exceed growth inside 400 ticks, and net standing carbon falls.
  // A falling stock is not evidence that nothing grew: the gate's claim is that
  // tissue grows, so it now measures growth directly — the maximum single
  // increase any one organism's tissue undergoes — rather than the net of
  // growth against mortality, which is a population claim this gate never made.
  let maxGain = 0;
  // REVIEW FINDING 1 FIXED. This indexed the FLAT biomass buffer by raw slot:
  // `biomass[s]` is element `s % E_COUNT` of organism `floor(s / E_COUNT)`, not
  // organism s's carbon. It therefore measured cross-element noise for the
  // first seventh of the slots, and — because dead slots kept a stale `prev` —
  // a newborn reusing a slot read `newbornTissue - stalePrev > 0` with no
  // growth whatsoever. The gate's growth half could pass on births alone.
  // Only the `built2` conjunct kept it honest, and a conjunct that rescues a
  // broken measurement is not a measurement.
  //
  // Now strides correctly and ONLY compares slots that were alive on the
  // previous tick, so a slot reuse cannot be mistaken for tissue growth.
  const bi = w.chemStores!.biomass;
  const store = w.store;
  const prev = new Float64Array(w.store.capacity).fill(NaN);
  const prevId = new Float64Array(w.store.capacity).fill(-1);
  for (let s = 0; s < w.store.capacity; s++) {
    if (w.aliveAt(s)) { prev[s] = bi[s * E_RUNTIME_COUNT]; prevId[s] = store.id[s]; }
  }
  for (let i = 0; i < 400; i++) {
    w.step();
    for (let s = 0; s < w.store.capacity; s++) {
      if (!w.aliveAt(s)) { prev[s] = NaN; prevId[s] = -1; continue; }
      const cur = bi[s * E_RUNTIME_COUNT];
      const id = store.id[s];
      if (id === prevId[s] && prev[s] === prev[s]) {          // same organism persisted
        const d = cur - prev[s];
        if (d > maxGain) maxGain = d;
      }
      prev[s] = cur;
      prevId[s] = id;
    }
  }
  let cEnd = 0;
  for (let s = 0; s < w.store.capacity; s++) if (w.aliveAt(s)) cEnd += bi[s * E_RUNTIME_COUNT];
  const built2 = w.chemistry!.flux.chemCarbonBuilt;
  const pass = maxGain > 0 && built2 > 0;
  record('G28', 'living tissue grows in a running world', pass,
    `max single-organism tissue gain ${maxGain.toFixed(4)} mol | chemistry-path `
    + `carbon built ${built2.toFixed(2)} mol | net standing carbon ${c0.toFixed(2)} `
    + `-> ${cEnd.toFixed(2)} mol (net may fall while growth occurs; that is a `
    + `population claim, not this gate's)`);
}

/**
 * G29 — reproduction is genuinely nutrient-limited.
 *
 * The strongest available statement about a nutrient gate, because it is a
 * COUNTERFACTUAL rather than an assertion: the same seed, the same everything,
 * with the mineral pools removed. Births must persist in one arm and stop in
 * the other.
 *
 * A single arm cannot make this claim. An ecosystem that never reproduces looks
 * identical under a nutrient gate to one whose gate does nothing, and the
 * counter that reports "blocked by nutrient" reads the same either way.
 */
function gate29(): void {
  const births = (w: World): number => w.demographics().births.flat().reduce((a, x) => a + x, 0);
  const mk = (starve: boolean) => new World({
    config: {
      seed: 517, founders: 400, genomeV2: true, chemistry: true,
      ...(starve ? { chemistryNoNutrients: true } : {}),
    } as never,
  });
  const a = mk(false); const b0 = births(a); for (let i = 0; i < 300; i++) a.step();
  const b = mk(true); const c0 = births(b); for (let i = 0; i < 300; i++) b.step();
  const fed = births(a) - b0;
  const starved = births(b) - c0;
  const pass = fed > 0 && starved === 0;
  record('G29', 'reproduction is genuinely nutrient-limited', pass,
    `nutrients present: ${fed} births | nutrients removed: ${starved} births`);
}

/**
 * G30 — metabolic capability is inherited.
 *
 * Per the lesson recorded against G24: a claim about inheritance cannot be
 * satisfied by organisms whose parents agree. The test therefore requires a
 * parent WITH a capability and a parent WITHOUT it, and requires the child to
 * resolve in the capable parent's favour. A clone between identical parents
 * would satisfy a weaker test and prove nothing.
 */
function gate30(): void {
  const w = new World({ config: { seed: 517, founders: 400, genomeV2: true, chemistry: true } as never });
  const st = w.chemStores!;
  const store = w.store;

  // FINDING 3 FIXED. The previous gate used `1 << CAP.FE_UPTAKE`. CAP.FE_UPTAKE
  // is already a bit VALUE (128 = 1 << 7), so `1 << 128` is `1 << 0` under JS
  // bitshift rules — the PHOTOSYNTHESIS bit. The gate counted photosynthesis
  // capability and labelled it iron uptake.
  //
  // Counting living positives and negatives is also not inheritance: it never
  // observes a transfer. This gate now follows ACTUAL parent -> child links
  // through `store.parentId`, which is stable across slot reuse.
  const bit = CAP.FE_UPTAKE;
  const capOf = (id: number): number | null => {
    for (let sl = 0; sl < store.capacity; sl++) {
      if (store.id[sl] === id && w.aliveAt(sl)) return st.capMask[sl];
    }
    return null;
  };

  // A child's capability is re-derived from its EXPRESSED modules, and modules
  // carry a developmental ONSET. Sampling a child at birth therefore measures
  // developmental timing, not inheritance: the first reading of this gate gave
  // 0 inherited and 11 "lost" purely because capability is not expressed on the
  // tick of birth. Each child is instead tracked until it dies and judged on
  // whether it EVER expresses the bit.
  const pairs = new Map<number, { parentHad: boolean; childId: number; childEverHad: boolean; resolved: boolean }>();
  for (let i = 0; i < 800; i++) {
    w.step();
    for (let sl = 0; sl < store.capacity; sl++) {
      if (!w.aliveAt(sl)) continue;
      const cid = store.id[sl];
      const rec = pairs.get(cid);
      if (rec && (st.capMask[sl] & bit) !== 0) rec.childEverHad = true;
      const pid = store.parentId[sl];
      if (pid < 0 || pid === cid || pairs.has(cid)) continue;
      const parentCap = capOf(pid);
      if (parentCap === null) continue;
      pairs.set(cid, {
        parentHad: (parentCap & bit) !== 0,
        childId: cid,
        childEverHad: (st.capMask[sl] & bit) !== 0,
        resolved: false,
      });
    }
    // Age out pairs whose child has gone, so it cannot accumulate forever.
    for (const [cid, rec] of pairs) {
      if (rec.resolved) continue;
      let alive = false;
      for (let sl = 0; sl < store.capacity; sl++) {
        if (w.aliveAt(sl) && store.id[sl] === cid) { alive = true; break; }
      }
      if (!alive) rec.resolved = true;
    }
  }
  let matched = 0, inherited = 0, lost = 0, gained = 0;
  for (const rec of pairs.values()) {
    matched++;
    if (rec.parentHad && rec.childEverHad) inherited++;
    else if (rec.parentHad && !rec.childEverHad) lost++;
    else if (!rec.parentHad && rec.childEverHad) gained++;
  }

  // A claim about inheritance is only meaningful if the sample contains BOTH
  // outcomes. If every parent-child pair agreed, this cannot distinguish
  // inheritance from a constant, which is the G24 lesson applied here.
  const varied = inherited > 0 && (lost > 0 || gained > 0);
  const pass = matched >= 20 && inherited > 0 && varied;
  record('G30', 'metabolic capability is transmitted parent to child', pass,
    `${matched} parent->child pairs observed: ${inherited} inherited, `
    + `${lost} lost, ${gained} gained the iron-uptake bit `
    + `${varied ? '' : '(sample does not vary, so this cannot demonstrate transmission)'}`);
}

/**
 * G31 — death returns matter to the right pools.
 *
 * Conservation proves the total survives; it cannot prove the matter went
 * somewhere sensible. Routing dead iron into the sulfur pool, or labile tissue
 * into the refractory pool, conserves every element perfectly and is still
 * wrong. So this asserts the ROUTING: labile fractions to labile pools,
 * structural fractions to litter pools, element by element.
 */
function gate31(): void {
  const mk = () => new World({ config: { seed: 517, founders: 400, genomeV2: true, chemistry: true } as never });
  const st0 = mk(); const st1 = mk();
  for (let i = 0; i < 300; i++) { st0.step(); st1.step(); }
  const st = st1.chemStores!;
  const chem = st1.chemistry!;
  const P = POOL_RT;
  const before = (w: World, p: number) => w.chemistry!.fields[p].data.reduce((a, b) => a + b, 0);

  let victim = -1;
  for (let s = 0; s < st1.store.capacity; s++) {
    if (st1.aliveAt(s) && st.biomass[s * E_RUNTIME_COUNT] > 0.05) { victim = s; break; }
  }
  if (victim < 0) {
    record('G31', 'death recycles tissue to the correct pools', false,
      'no organism with measurable tissue found');
    return;
  }
  const tissue0 = st.biomass[victim * E_RUNTIME_COUNT];

  // CONTROLLED DIFFERENCE. Two worlds identical to the last tick; only one has
  // the victim aged past its lifespan. Everything else — every other organism's
  // uptake, every reaction, the whole step — is common to both, so the
  // difference is the death's contribution ALONE. Measuring a single world
  // cannot separate the corpse from the activity of everything still alive,
  // which is why the first version of this gate measured noise.
  const L = [P.ON, P.OP, P.OS];
  const T = [P.LN, P.LP, P.LS];
  const snap = (w: World) => ({
    labile: L.reduce((a, p) => a + before(w, p), 0),
    litter: T.reduce((a, p) => a + before(w, p), 0),
  });
  const a0 = snap(st0); const a1 = snap(st1);
  st1.store.age[victim] = st1.store.trait(victim, TRAIT.LIFESPAN) + 1;
  // TWO steps, not one. The death phase runs after the chemistry settle within
  // its tick, so the released matter is written to the delta buffer and applied
  // at the NEXT settle. A single step measures an empty buffer and reports a
  // perfectly correct death as returning nothing at all.
  st0.step(); st1.step();
  st0.step(); st1.step();
  const b0 = snap(st0); const b1 = snap(st1);
  const dLabile = (b1.labile - a1.labile) - (b0.labile - a0.labile);
  const dLitter = (b1.litter - a1.litter) - (b0.litter - a0.litter);
  const burial = chem.cfg.burial;
  const returned = dLabile + dLitter;

  // Burial decides the split. When burial is zero EVERYTHING is labile and a
  // zero litter return is the correct answer, not a failure; the gate asserts
  // the split the model declared rather than one it wishes for.
  const splitOk = burial > 0 ? (dLitter > 0 && dLabile > 0) : (dLitter === 0 && dLabile > 0);
  const pass = dLabile > 0 && splitOk && returned > 0;
  record('G31', 'death recycles tissue to the correct pools', pass,
    `tissue ${tissue0.toFixed(4)} mol -> labile +${dLabile.toFixed(4)}, `
    + `litter +${dLitter.toFixed(4)} (burial ${burial.toFixed(3)}), `
    + `total returned +${returned.toFixed(4)}`);
}

/**
 * G32 — the chemistry model has its own experimental identity.
 *
 * The chemistry subsystem is null-default precisely so it cannot perturb the
 * pinned parity figures, and that isolation meant one version string was
 * covering two different sets of simulation semantics. A chemistry run and a
 * knob-off run reported the same identity while differing in what a reaction
 * does and what "growth" means.
 *
 * This is the failure the pinned-version discipline exists to prevent, and
 * under 0.5.0 this repository published a badly wrong figure precisely because
 * the semantics changed without the name changing.
 */
function gate32(): void {
  const off = runIdentity(false);
  const on = runIdentity(true);
  const a = new World({ config: { seed: 517, founders: 200 } as never });
  const b = new World({ config: { seed: 517, founders: 200, chemistry: true } as never });
  for (let i = 0; i < 50; i++) { a.step(); b.step(); }
  const pass = off !== on
    && off === WORLD_ENGINE_VERSION
    && on.includes(CHEMISTRY_ENGINE_VERSION)
    && a.hashState() !== b.hashState();
  record('G32', 'chemistry runs under a distinct experimental identity', pass,
    `knob off "${off}" | knob on "${on}" | state digests `
    + `${a.hashState().slice(0, 8)} vs ${b.hashState().slice(0, 8)}`);
}

/**
 * G33 — the chemical/legacy energy boundary is MEASURED and DECLARED.
 *
 * The chemical subsystem credits reaction energy straight into `store.energy`
 * and charges growth cost straight out of it, without passing through the
 * legacy ledger's capture/spend books. That is a real integration gap and the
 * reviewer is right to name it: two energy books exist and only one of them is
 * the ledger.
 *
 * Rather than assert integration that does not exist, this gate states the
 * boundary as a MEASURED quantity. If chemical energy income ever becomes a
 * material share of total organism energy, the declared scope is wrong and this
 * gate fails — which is the point. A declared limit that cannot trip is a
 * comment.
 */
function gate33(): void {
  const w = new World({ config: { seed: 517, founders: 400, genomeV2: true, chemistry: true } as never });
  for (let i = 0; i < 600; i++) w.step();

  // FINDING A FIXED. This gate previously summed `store.energyIngested` over
  // alive slots at twelve sample points. That counter is CUMULATIVE for the
  // life of an organism (incremented at four gain sites, seeded once with the
  // founder reserve) and is NEVER RESET on slot reuse, so summing it across
  // samples counted each organism's entire lifetime intake many times over.
  // The denominator was inflated roughly six-fold and the published chemical
  // share of 0.73% was wrong by about that factor.
  //
  // `ledger.capture` records every joule of legacy income EXACTLY ONCE, which
  // is what a share-of-total measurement needs.
  const legacy = w.ledgerCaptureTotal();
  const chem = w.chemistry!.flux.chemEnergyIncome;
  const share = chem / Math.max(1e-9, legacy + chem);

  // Chemical growth is funded from a MIXED energy pool, so charging can exceed
  // chemical income legitimately. Asserting charged <= income was a false
  // invariant that could only fail in the wrong direction.
  const charged = w.chemistry!.flux.chemEnergySpent;
  const pass = Number.isFinite(share) && share >= 0 && share < 0.10 && charged >= 0;
  record('G33', 'chemical energy share is measured from a single-record ledger', pass,
    `chemical income ${chem.toFixed(1)} / (legacy ${legacy.toFixed(0)} + chemical) `
    + `= ${(share * 100).toFixed(3)}% | charged ${charged.toFixed(1)} `
    + `(declared scope: chemical energy is NOT reconciled through the legacy `
    + `ledger; ceiling 10%)`);
}

/**
 * G34 — the canopy lookup is spatially correct, and it actually reaches capture.
 *
 * OWNER-AUTHORISED CANOPY CORRECTION (2026-10-13). Four requirements, all of
 * which the previous code failed:
 *
 *  1. A producer under DENSER canopy receives less local usable light than a
 *     matched producer in the open, at equal global forcing, nutrients and
 *     habitat shade. This is the behaviour the correction is for.
 *  2. The canopy cell is looked up at the organism's OWN position, including
 *     edges and corners, where off-by-one and clamping bugs hide.
 *  3. Non-default `shadeGrain` and non-square, non-power-of-two grids behave —
 *     the coarse mapping is not hardcoded to the default 4 or to a square.
 *  4. LEGACY PHOTOSYNTHETIC CAPTURE responds, not merely the local-light
 *     helper. A gate that reads back the quantity it just wrote proves nothing.
 *
 * The world is built, producers are placed at chosen positions, the canopy is
 * injected at known cells, and capture is read from the LEDGER — the same
 * quantity the economics depend on.
 */
function gate34(): void {
  type W = {
    ledgerCaptureTotal(): number;
    aliveAt(slot: number): boolean;
    globalLight: number;
    step(): void;
  };
  // Non-default grain and a deliberately non-square, non-power-of-two world so
  // the coarse mapping is exercised against a grid the default code path never
  // produces.
  // Non-default grain AND a deliberately non-square, non-power-of-two world, so
  // the coarse mapping is exercised against geometry the default path never
  // produces. Grain 3 does not divide either dimension evenly, which is
  // exactly where an off-by-one or clamp bug shows.
  const GRAIN = 3;
  const w = new World({
    config: {
      seed: 4242, founders: 60, worldW: 1500, worldH: 900, label: 'canopy',
      shadeGrain: GRAIN,
    } as never,
  }) as unknown as W;

  // canopyAt is private engine state; reach it structurally rather than
  // widening the public API for a gate.
  const canopyAt = (px: number, py: number): number =>
    (w as unknown as { canopyAt(p: number, q: number): number }).canopyAt(px, py);

  // Fill ONE coarse cell with canopy and verify that only positions inside that
  // cell's footprint read it. Corners and edges are sampled explicitly because
  // a clamped or off-by-one mapping passes a centred probe and fails here.
  // Read the engine's ACTUAL coarse dimensions rather than recomputing them.
  // Recomputing re-implements the convention under test, which is how a gate can
  // agree with a broken engine; this version did exactly that and produced a
  // 1x1 grid.
  const geom = w as unknown as { shadeCols: number; shadeRows: number; shadeMass: Float32Array };
  const TC = geom.shadeCols, TR = geom.shadeRows;
  const cw = 1500 / TC, ch = 900 / TR;

  const midC = Math.floor(TC / 2), midR = Math.floor(TR / 2);
  // Inject into the mid coarse cell only.
  geom.shadeMass.fill(0);
  geom.shadeMass[midR * geom.shadeCols + midC] = 25;

  const inside = canopyAt((midC + 0.5) * cw, (midR + 0.5) * ch);
  const cornerLL = canopyAt(0, 0);
  const cornerUR = canopyAt(1500 - 1e-6, 900 - 1e-6);
  const edgeL = canopyAt(0, (midR + 0.5) * ch);
  const edgeT = canopyAt((midC + 0.5) * cw, 0);

  const spatialOk = inside === 25
    && cornerLL === 0 && cornerUR === 0 && edgeL === 0 && edgeT === 0;

  // CAPTURE RESPONDS TO REAL DENSITY.
  //
  // Injecting canopy mass directly does not work: `rebuildCanopy()` recomputes
  // shadeMass from living organisms every tick, so an injected value is wiped
  // before capture is computed. That is the right engine behaviour and it means
  // the only honest way to create canopy is to CREATE organisms in one place.
  //
  // Two worlds with the same seed; in one every phototrophic organism is moved
  // into a single coarse cell (dense canopy), in the other they are spread one
  // per coarse cell (open). Capture is then read from the LEDGER — the quantity
  // the economics depend on — not from the local-light helper.
  const captureOf = (clustered: boolean): number => {
    const v = new World({
      config: {
        seed: 4242, founders: 60, worldW: 1500, worldH: 900, label: 'canopy',
        shadeGrain: GRAIN,
      } as never,
    }) as unknown as W & { store: { x: Float32Array; y: Float32Array; capacity: number }; shadeCols: number; shadeRows: number };
    const before = v.ledgerCaptureTotal();
    for (let i = 0; i < 12; i++) v.step();
    const st = v.store;
    const positions: number[] = [];
    for (let sl = 0; sl < st.capacity; sl++) {
      if (!v.aliveAt(sl)) continue;
      positions.push(sl);
    }
    const cellW = 1500 / v.shadeCols, cellH = 900 / v.shadeRows;
    positions.forEach((sl, k) => {
      if (clustered) {
        // Everyone in ONE coarse cell: maximal local canopy.
        st.x[sl] = Math.min(1499, cellW * 0.5 + 1);
        st.y[sl] = Math.min(899, cellH * 0.5 + 1);
      } else {
        // One organism per coarse cell across the grid: minimal local canopy.
        const cx = k % v.shadeCols, cy = Math.floor(k / v.shadeCols) % v.shadeRows;
        st.x[sl] = Math.min(1499, (cx + 0.5) * cellW);
        st.y[sl] = Math.min(899, (cy + 0.5) * cellH);
      }
    });
    for (let i = 0; i < 150; i++) v.step();
    return v.ledgerCaptureTotal() - before;
  };
  const open = captureOf(false);
  const shaded = captureOf(true);
  // A THRESHOLD, not a sign test. The first version asserted merely
  // `shaded < open` and PASSED with the coarse-canopy defect reintroduced: the
  // broken lookup still shaved 3.5% off capture by accident, which a sign test
  // accepts. With the correction the clustered arm falls to ~11% of the open
  // arm. Requiring at least a 2x attenuation is what makes this a test of the
  // mechanism rather than of arithmetic noise.
  const MIN_ATTENUATION = 2;
  const ratio = open > 0 ? open / Math.max(1e-9, shaded) : 0;
  const captureResponds = ratio >= MIN_ATTENUATION;

  // INDEPENDENT CONTROLLED CHECK (review #5506898666).
  //
  // The clustered-vs-open comparison above repositions ALL organisms, so its
  // capture difference is confounded with habitat, nutrient and competition
  // context. Here the spatial layout, seed and forcing are held IDENTICAL and
  // only the local canopy MASS is varied: `rebuildShadeMass` is frozen so an
  // injected field persists, and the same biological population runs under a
  // high persistent canopy versus none. A difference here is attributable to
  // canopy mass alone, not to where the organisms were moved.
  const isolated = ((): { responds: boolean; high: number; none: number; ratio: number } => {
    const mk = (): any => new World({
      config: { seed: 4242, founders: 60, worldW: 1500, worldH: 900, label: 'canopy', shadeGrain: GRAIN } as never,
    });
    const run = (canopyMass: number): number => {
      const v: any = mk();
      // Freeze the coarse canopy rebuild so our injected mass is the only
      // shadeMass in force for the whole run. Positions/nutrients still evolve
      // identically because everything else in `step()` is untouched.
      v.rebuildShadeMass = function () {};
      const geom = v as { shadeCols: number; shadeRows: number; shadeMass: Float32Array };
      geom.shadeMass.fill(canopyMass);
      const before = v.ledgerCaptureTotal();
      for (let i = 0; i < 150; i++) v.step();
      return v.ledgerCaptureTotal() - before;
    };
    const high = run(25);
    const none = run(0);
    const r = none > 0 ? none / Math.max(1e-9, high) : 0;
    return { responds: r >= MIN_ATTENUATION, high, none, ratio: r };
  })();
  const isolatedResponds = isolated.responds;
  const pass = spatialOk && captureResponds && isolatedResponds;
  record('G34', 'canopy lookup is spatially correct and reaches capture', pass,
    `grid ${TC}x${TR} at shadeGrain ${GRAIN} | inside injected cell ${inside} `
    + `(want 25) | corners ${cornerLL}/${cornerUR} edges ${edgeL}/${edgeT} `
    + `(want 0/0/0/0) | legacy capture open ${open.toFixed(2)} shaded `
    + `${shaded.toFixed(2)} (${captureResponds ? 'responds' : 'DID NOT RESPOND'}) `
    + `| isolated canopy high ${isolated.high.toFixed(2)} none ${isolated.none.toFixed(2)} `
    + `ratio ${isolated.ratio.toFixed(2)} (${isolatedResponds ? 'responds' : 'DID NOT RESPOND'})`);
}

function main(): void {
  console.log(`=== credibility gates :: ${WORLD_ENGINE_VERSION} ===`);
  console.log(`scenario: founders=${SMALL.founders} world=${SMALL.worldW}x${SMALL.worldH} ticks=${TICKS} seed=${SMALL.seed}\n`);
  gate1();
  gate2();
  gate3();
  gate4();
  gate5();
  gate6();
  gate7();
  gate8();
  gate9();
  gate10();
  gate12();
  gate13();
  gate14();
  gate15();
  gate16();
  gate17();
  gate18();
  gate19();
  gate20();
  gate21();
  gate22();
  gate23();
  gate24();
  gate25();
  gate26();
  gate27();
  gate28();
  gate29();
  gate30();
  gate31();
  gate32();
  gate33();
  gate34();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map((f) => f.id).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('ALL GATES PASS');
  }
}

main();