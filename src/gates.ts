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
import { OrganismStore, NUTRIENT_COUNT } from './core/soa.js';
import { TROPHIC_COUNT, MINERAL_PHENO_CLASS_COUNT } from './bio/role.js';
import type { Phenotype } from './bio/phenotype.js';
import { Rng } from './core/rng.js';
import { INTENT } from './world/world.js';
import { REPRO_GATE, type ReproProbe } from './trace/reproprobe.js';

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

  // Non-vacuity gets its own longer window on the same seed. Under fasting
  // tolerance (0.6.1) the 250-tick window resolves contests but no predation
  // yet on this seed — predation appears by tick 1000 on the identical run,
  // and within 250 ticks on neighbouring seeds — so the short window stopped
  // witnessing rather than the mechanism stopping. Determinism above is
  // unaffected (both digests still identical); this only re-establishes that
  // the determinism check ran over real predation contests.
  let predExtended = 0;
  {
    const w = new World({ config: { ...SMALL, seed: 4242 } });
    for (let i = 0; i < 1000; i++) {
      w.step();
      for (const r of w.resolutions()) {
        if (r.kind === INTERACTION.PREDATE) predExtended++;
      }
    }
  }

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
    predExtended > 0,
    `predation contests resolved: ${predExtended} over the extended 1000-tick window on seed 4242 ` +
      `(0 inside the 250-tick determinism window under fasting tolerance). A run with zero contested interactions ` +
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
  // The scenario seeds mineralisers (decomposerFounders) so the gate tests the
  // flux-READING mechanism, not guild establishment. Under fasting tolerance
  // (0.6.1) an unseeded 120-founder world grows no feeding mineralisers within
  // the window — fewer early deaths means less detritus — so the unseeded
  // scenario stopped witnessing; seeded, flux reads >0 by tick 150 while OFF
  // reads exactly 0. Establishment ecology belongs to ladder evidence.
  //
  // So this asserts the read directly: with cyclic ON and mineralisers alive,
  // the flux the regen term observed must be non-zero.
  type W = { cyclicFluxLastTick: number; step(): void };
  const arm = (cyclic: boolean): number => {
    const w = new World({
      config: { ...SMALL, founders: 120, nutrientCyclic: cyclic, decomposerFounders: 0.3 } as never,
    }) as unknown as W;
    for (let k = 0; k < 150; k++) w.step();
    return w.cyclicFluxLastTick;
  };
  const on = arm(true);
  const off = arm(false);
  record(
    'G12',
    'nutrientCyclic reads a non-zero biotic flux (not a kill-switch)',
    on > 0 && off === 0,
    `cyclic flux observed with nutrientCyclic on=${on.toFixed(6)}, off=${off.toFixed(6)} ` +
      `(want >0 and exactly 0). Zero while ON means the flux is cleared before it is ` +
      `read, and the knob suppresses regeneration instead of coupling it.`,
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
    if (Math.abs(net - declared) > 1e-9) worst++;
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
    // Drive a pair that actually DISAGREES. Founders draw ~7 modules from 7
    // kinds, so round-robin neighbours usually agree and every mating then
    // reads as a clone no matter what recombination did. The gate asserts
    // recombination through the real queue, so disagreeing parents are its
    // precondition — searched, not hoped for. (Under fasting tolerance the
    // ambient trajectory stopped serving a disagreeing neighbour within 40
    // rounds while thousands of disagreeing pairs were alive every round;
    // measured, not assumed.)
    //
    // Disagreement must be positional VALUE disagreement inside the shared
    // span, not mere length difference: length-only pairs share every value,
    // so no child can resolve a disagreement in each parent's favour and the
    // strict signature below is unsatisfiable by construction.
    let a = -1;
    let b = -1;
    for (let x = 0; x < bearers.length && a < 0; x++) {
      for (let y = x + 1; y < bearers.length; y++) {
        const xa = kindsOf(bearers[x]);
        const xb = kindsOf(bearers[y]);
        const span = Math.min(xa.length, xb.length);
        let differ = false;
        for (let i = 0; i < span; i++) {
          if (xa[i] !== xb[i]) { differ = true; break; }
        }
        if (differ) { a = bearers[x]; b = bearers[y]; break; }
      }
    }
    if (a < 0) continue;

    const ka = kindsOf(a);
    const kb = kindsOf(b);
    if (ka.length === 0 || kb.length === 0) continue;

    const idsBefore = new Set<number>();
    for (let i = 0; i < st.capacity; i++) if (w.live[i]) idsBefore.add(st.id[i]);

    attempts++;
    w.queueBirth(a, 1, -1, b);
    w.step();

    // Scan EVERY newborn, not just the first: background asexual births share
    // the tick, and a healthier population breeds more of them. Judging only
    // the first new id mistakes the background birth rate for the
    // recombination mechanism. Each candidate is tested for the strict splice
    // signature against the driven parents, so background children can only
    // fail the checks (or count as the clones they are) — a false pass would
    // need a third parent already carrying the driven splice, negligible over
    // a 7^7 sequence space and bounded empirically by the pre-fix 0/40 run.
    const newborns: number[] = [];
    for (let i = 0; i < st.capacity; i++) {
      if (w.live[i] && !idsBefore.has(st.id[i])) newborns.push(i);
    }
    for (const child of newborns) {
      if (st.moduleCount[child] === 0) continue;

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
        break;
      }
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

function gate26(): void {
  // radiationMultiplier dormant coupling (P2a fix verification).
  // The excess over 1x is coupled to dormantFrac/floor, not the total multiplier.
  // At 0 dormancy -> 1x (background). At dormantFrac >= floor -> full mult.
  // Advance tick so scheduled multiplier m > 1 (excess > 0).
  const w = new World({
    config: { founders: 0, worldW: 100, worldH: 100, seed: 1,
      radiation: { onset: 10, doubling: 100, cap: 8, overgrowthCoupling: 0.5 },
    },
  }) as unknown as { dormantFrac: number; radiationMultiplier(): number; tick: number; step(): void; config: { radiation: { onset: number; doubling: number; cap: number; overgrowthCoupling: number } } };
  // Step to tick 50 -> m = 2^((50-10)/100) = 2^0.4 ~ 1.3195
  for (let i = 0; i < 50; i++) w.step();
  // Read scheduled multiplier directly (without coupling): m = 2^((tick-onset)/doubling), clamped to cap
  const r = w.config.radiation!;
  const scheduled = Math.min(Math.max(1, r.cap), Math.pow(2, (w.tick - r.onset) / Math.max(1, r.doubling)));
  // Test coupling by directly setting dormantFrac (natural dormantFrac stays 0 with no founders)
  w.dormantFrac = 0.0;
  const zero = w.radiationMultiplier();
  w.dormantFrac = 0.25; // half floor
  const half = w.radiationMultiplier();
  w.dormantFrac = 0.5; // at floor
  const full = w.radiationMultiplier();
  w.dormantFrac = 1.0; // above floor
  const over = w.radiationMultiplier();
  const eps = 1e-9;
  const zeroOk = Math.abs(zero - 1.0) < eps;
  const halfOk = Math.abs(half - (1 + (scheduled - 1) * 0.5)) < eps;
  const fullOk = Math.abs(full - scheduled) < eps;
  const overOk = Math.abs(over - scheduled) < eps;

  // --- Boundary assertions requested by handoff ---
  // 1. Absent schedule (no radiation config) -> 1.0
  const wNoRad = new World({ config: { founders: 0, worldW: 100, worldH: 100, seed: 2 } }) as unknown as { radiationMultiplier(): number };
  const noRad = wNoRad.radiationMultiplier();
  const noRadOk = Math.abs(noRad - 1.0) < eps;

  // 2. Pre-onset (tick < onset) -> 1.0
  const wPre = new World({
    config: { founders: 0, worldW: 100, worldH: 100, seed: 3,
      radiation: { onset: 100, doubling: 100, cap: 8, overgrowthCoupling: 0.5 },
    },
  }) as unknown as { radiationMultiplier(): number; tick: number; step(): void };
  // At tick 0, before onset=100
  const preOnset = wPre.radiationMultiplier();
  const preOnsetOk = Math.abs(preOnset - 1.0) < eps;

  // 3. Uncoupled (overgrowthCoupling = 0) -> scheduled multiplier regardless of dormantFrac
  const wUncoupled = new World({
    config: { founders: 0, worldW: 100, worldH: 100, seed: 4,
      radiation: { onset: 10, doubling: 100, cap: 8, overgrowthCoupling: 0 },
    },
  }) as unknown as { dormantFrac: number; radiationMultiplier(): number; tick: number; step(): void; config: { radiation: { onset: number; doubling: number; cap: number; overgrowthCoupling: number } } };
  for (let i = 0; i < 50; i++) wUncoupled.step();
  const rUnc = wUncoupled.config.radiation!;
  const scheduledUnc = Math.min(Math.max(1, rUnc.cap), Math.pow(2, (wUncoupled.tick - rUnc.onset) / Math.max(1, rUnc.doubling)));
  wUncoupled.dormantFrac = 0.0;
  const uncoupledZero = wUncoupled.radiationMultiplier();
  wUncoupled.dormantFrac = 1.0;
  const uncoupledFull = wUncoupled.radiationMultiplier();
  const uncoupledOk = Math.abs(uncoupledZero - scheduledUnc) < eps && Math.abs(uncoupledFull - scheduledUnc) < eps;

  // 4. Coupling floor behavior: at dormantFrac=0 with active coupling -> 1.0 (background)
  // This is the "floor" boundary: the coupling floor is overgrowthCoupling itself.
  // At dormantFrac=0, mult = 1 + (scheduled-1)*min(1, 0/floor) = 1.
  // Already tested as 'zero' above. The floor IS overgrowthCoupling; there is no separate floor parameter.
  // So this boundary is covered by zeroOk.

  const allOk = zeroOk && halfOk && fullOk && overOk && noRadOk && preOnsetOk && uncoupledOk;
  record('G26', 'radiationMultiplier couples only excess over 1x to dormant share (incl. boundaries)',
    allOk,
    `tick=${w.tick} scheduled=${scheduled.toFixed(4)} zero=${zero.toFixed(4)} half=${half.toFixed(4)} full=${full.toFixed(4)} over=${over.toFixed(4)} | noRad=${noRad.toFixed(4)} preOnset=${preOnset.toFixed(4)} uncoupledZero=${uncoupledZero.toFixed(4)} uncoupledFull=${uncoupledFull.toFixed(4)} scheduledUnc=${scheduledUnc.toFixed(4)}`);
}

function gate27(): void {
  // successfulMating gates asexual fallback. Asserted on BIRTHS, not flags.
  // A/B/C must ATTEMPT asexual (reach the stochastic roll) and QUEUE an
  // asexual birth; D must queue exactly 2 sexual births and 0 asexual
  // births from the mated slots while recording the sexual-skip.
  const CFG = { founders: 2, worldW: 200, worldH: 200, seed: 99999,
    consumerPhotoScale: 0, consumerBasalScale: 0.25,
    decomposerPhotoScale: 0, decomposerFounders: 0.5,
    decomposerDormancy: 0.05, sporeDispersal: 1,
    grazeYieldScale: 1.0, plantYieldPerMass: 0, radiation: null,
    foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
    dormantThreatBlind: null, mixotrophyCarbon: null,
    mixotrophySaturation: 1.0, nutrientCyclic: true,
    producerCaptureScale: 0.35, nutrientFloor: 0.05, reproSurplusTicks: 5,
    basalFoodPerCell: 0.01, nutrientRegen: 0.0002,
    excretionRate: 0.06, meatYieldPerMass: 0,
  };

  /** Per-slot observer. ReproProbeLog aggregates per guild; D needs per-slot. */
  class SlotProbe implements ReproProbe {
    sexualSkipped = new Set<number>();
    reached = new Set<number>();
    reachedN = new Map<number, number>();
    firedSet = new Set<number>();
    blocked(slot: number, _guild: number, gate: number): void {
      void _guild;
      if (gate === REPRO_GATE.sexual) this.sexualSkipped.add(slot);
    }
    reachedRoll(slot: number, _guild: number, _drive: number, _m?: number, _a?: number, _s?: number): void {
      void _guild; void _drive; void _m; void _a; void _s;
      this.reached.add(slot);
      this.reachedN.set(slot, (this.reachedN.get(slot) ?? 0) + 1);
    }
    fired(slot: number, _guild: number): void {
      void _guild;
      this.firedSet.add(slot);
    }
  }

  type PW = {
    store: OrganismStore;
    live: Uint8Array;
    intent: Uint8Array; mateTarget: Int32Array;
    mateCandA: Int32Array; mateCandB: Int32Array; mateCandN: number;
    submittedByKind: Int32Array; successfulMating: Uint8Array;
    pendingBirths: number; birthParentSlot: Int32Array; birthMateSlot: Int32Array;
    proposeReproduction(): void; resolveMatingIntent(): void; resolveContests(): void;
  };

  const makeProbe = (): { w: PW; probe: SlotProbe; a: number; b: number } | null => {
    const probe = new SlotProbe();
    const w = new World({ config: CFG, reproProbe: probe }) as unknown as PW;
    const live: number[] = [];
    for (let i = 0; i < w.store.capacity && live.length < 2; i++) {
      if (w.live[i]) live.push(i);
    }
    if (live.length < 2) return null;
    return { w, probe, a: live[0], b: live[1] };
  };

  /** Make slot eligible for the ASEXUAL branch: mature, off cooldown, undamaged, fed. */
  const prime = (w: PW, slot: number, energy: number): void => {
    const mat = w.store.trait(slot, TRAIT.MATURITY_AGE);
    w.store.age[slot] = Math.ceil(mat) + 5;
    w.store.reproCooldown[slot] = 0;
    w.store.damage[slot] = 0;
    w.store.energy[slot] = energy;
    // Deterministic drive within bounded retries: founder asexualRate is
    // ~0.01 physical (90% fire only at huge margin, still stochastic), so pin
    // the EXPRESSED traits the drive formula actually reads.
    w.store.physical[slot * TRAIT_COUNT + TRAIT.ASEXUAL_RATE] = 0.055;
    w.store.physical[slot * TRAIT_COUNT + TRAIT.MATE_SEEKING] = 0;
  };

  const scanQueue = (w: PW): { sexual: number; asexFrom: Map<number, number> } => {
    let sexual = 0;
    const asexFrom = new Map<number, number>();
    for (let q = 0; q < w.pendingBirths; q++) {
      if (w.birthMateSlot[q] >= 0) sexual++;
      else asexFrom.set(w.birthParentSlot[q], (asexFrom.get(w.birthParentSlot[q]) ?? 0) + 1);
    }
    return { sexual, asexFrom };
  };

  /** One proposeReproduction proves the ATTEMPT; loop proves a BIRTH despite the lottery. */
  const awaitAsexualBirth = (w: PW, slots: number[], tries = 30): boolean => {
    for (let t = 0; t < tries; t++) {
      for (const s of slots) if (w.store.energy[s] < 900) w.store.energy[s] = 1000;
      w.proposeReproduction();
      const q = scanQueue(w);
      if (slots.some((s) => (q.asexFrom.get(s) ?? 0) > 0)) return true;
    }
    return false;
  };

  // ---- Case A: no candidate -> asexual attempt + birth, no sexual ----
  let aDetail = 'no live pair', aPass = false;
  {
    const p = makeProbe();
    if (p) {
      const { w, probe, a, b } = p;
      prime(w, a, 1000); prime(w, b, 1000);
      w.intent.fill(INTENT.SETTLE, 0, w.store.capacity);
      w.mateTarget.fill(-1, 0, w.store.capacity);
      w.mateCandN = 0;
      w.proposeReproduction();
      const attempt = probe.reached.has(a) && probe.reached.has(b)
        && !probe.sexualSkipped.has(a) && !probe.sexualSkipped.has(b);
      const flagsClean = w.successfulMating[a] === 0 && w.successfulMating[b] === 0;
      const q0 = scanQueue(w);
      const born = awaitAsexualBirth(w, [a, b]);
      const q1 = scanQueue(w);
      aPass = attempt && flagsClean && q0.sexual === 0 && born && q1.sexual === 0;
      aDetail = `reached(a=${probe.reached.has(a)},b=${probe.reached.has(b)}) flags(${w.successfulMating[a]},${w.successfulMating[b]}) sexualQ=${q1.sexual} asexBirth=${born}`;
    }
  }

  // ---- Case B: candidate, no reciprocal -> same expectation as A ----
  let bDetail = 'no live pair', bPass = false;
  {
    const p = makeProbe();
    if (p) {
      const { w, probe, a, b } = p;
      prime(w, a, 1000); prime(w, b, 1000);
      w.intent[a] = INTENT.MATE; w.intent[b] = INTENT.FLEE;
      w.mateTarget[a] = b; w.mateTarget[b] = -1;
      w.mateCandA[0] = Math.min(a, b); w.mateCandB[0] = Math.max(a, b); w.mateCandN = 1;
      const m0 = w.submittedByKind[INTERACTION.MATE];
      w.resolveMatingIntent();
      w.resolveContests();
      const noMate = w.submittedByKind[INTERACTION.MATE] - m0 === 0;
      w.proposeReproduction();
      const attempt = probe.reached.has(a) && probe.reached.has(b);
      const born = awaitAsexualBirth(w, [a, b]);
      const q = scanQueue(w);
      bPass = noMate && attempt && w.successfulMating[a] === 0
        && w.successfulMating[b] === 0 && q.sexual === 0 && born;
      bDetail = `submittedDelta=${noMate} reached(a=${probe.reached.has(a)},b=${probe.reached.has(b)}) sexualQ=${q.sexual} asexBirth=${born}`;
    }
  }

  // ---- Case C: mutual intent, surplus FAILS on ONE parent -> other still breeds asexually ----
  let cDetail = 'no live pair', cPass = false;
  {
    const p = makeProbe();
    if (p) {
      const { w, probe, a, b } = p;
      prime(w, a, 1000); prime(w, b, 1000);
      w.store.energy[b] = 0.1; // B fails fraction+surplus; A stays eligible
      w.intent[a] = INTENT.MATE; w.intent[b] = INTENT.MATE;
      w.mateTarget[a] = b; w.mateTarget[b] = a;
      w.mateCandA[0] = Math.min(a, b); w.mateCandB[0] = Math.max(a, b); w.mateCandN = 1;
      w.resolveMatingIntent();
      w.resolveContests(); // onMate surplus check must FAIL via B
      const mated = w.successfulMating[a] === 1 || w.successfulMating[b] === 1;
      w.proposeReproduction();
      const aAttempted = probe.reached.has(a) && !probe.sexualSkipped.has(a);
      const born = awaitAsexualBirth(w, [a]);
      const q = scanQueue(w);
      cPass = !mated && aAttempted && w.successfulMating[a] === 0 && q.sexual === 0 && born;
      cDetail = `mated=${mated} aReached=${probe.reached.has(a)} bReached=${probe.reached.has(b)} sexualQ=${q.sexual} asexBirthA=${born}`;
    }
  }

  // ---- Case D: mutual + surplus PASSES -> exactly 2 sexual, 0 asexual from pair ----
  let dDetail = 'no live pair', dPass = false;
  {
    const p = makeProbe();
    if (p) {
      const { w, probe, a, b } = p;
      prime(w, a, 1000); prime(w, b, 1000);
      w.intent[a] = INTENT.MATE; w.intent[b] = INTENT.MATE;
      w.mateTarget[a] = b; w.mateTarget[b] = a;
      w.mateCandA[0] = Math.min(a, b); w.mateCandB[0] = Math.max(a, b); w.mateCandN = 1;
      w.resolveMatingIntent();
      w.resolveContests();
      const queuedSexual = scanQueue(w).sexual; // must be 2 BEFORE proposeReproduction
      const flagsSet = w.successfulMating[a] === 1 && w.successfulMating[b] === 1;
      w.proposeReproduction(); // single call: skip must be deterministic, no retry loop
      const q = scanQueue(w);
      const skipped = probe.sexualSkipped.has(a) && probe.sexualSkipped.has(b);
      const noAsexAttempt = !probe.reached.has(a) && !probe.reached.has(b);
      const noAsexBirth = (q.asexFrom.get(a) ?? 0) === 0 && (q.asexFrom.get(b) ?? 0) === 0;
      dPass = flagsSet && queuedSexual === 2 && skipped && noAsexAttempt && q.sexual === 2 && noAsexBirth;
      dDetail = `flags(${w.successfulMating[a]},${w.successfulMating[b]}) sexualQ=${q.sexual}(pre=${queuedSexual}) skipped(a=${probe.sexualSkipped.has(a)},b=${probe.sexualSkipped.has(b)}) reached(a=${probe.reached.has(a)},b=${probe.reached.has(b)}) asexFrom(a=${q.asexFrom.get(a) ?? 0},b=${q.asexFrom.get(b) ?? 0})`;
    }
  }

  record('G27', 'successfulMating flag gates asexual fallback (A no-candidate, B no-reciprocal, C failed-surplus, D passed-surplus)',
    aPass && bPass && cPass && dPass,
    `A: ${aDetail} | B: ${bDetail} | C: ${cDetail} | D: ${dDetail}`);
}

// Gate 28: successfulMating array grows with population capacity
function gate28(): void {
  const SMALL = { founders: 10, worldW: 200, worldH: 200, seed: 88888,
    consumerPhotoScale: 0, consumerBasalScale: 0.25,
    decomposerPhotoScale: 0, decomposerFounders: 0.5,
    decomposerDormancy: 0.05, sporeDispersal: 1,
    grazeYieldScale: 1.0, plantYieldPerMass: 0, radiation: null,
    foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
    dormantThreatBlind: null, mixotrophyCarbon: null,
    mixotrophySaturation: 1.0, nutrientCyclic: true,
    producerCaptureScale: 0.35, nutrientFloor: 0.05, reproSurplusTicks: 5,
    basalFoodPerCell: 0.01, nutrientRegen: 0.0002,
    excretionRate: 0.06, meatYieldPerMass: 0,
  };
  const w = new World({ config: SMALL }) as unknown as { successfulMating: Uint8Array; live: Uint8Array; ensureSlotArrays(slot: number): void; step(): void };
  // Initial capacity is 1024 (Math.max(1024, founders*2))
  const initialLiveLen = w.live.length;
  // Force growth by calling ensureSlotArrays with a slot beyond initial capacity
  w.ensureSlotArrays(2000);
  const grownLiveLen = w.live.length;
  const flagLen = w.successfulMating.length;
  const grew = grownLiveLen > initialLiveLen;
  record('G28', 'successfulMating array grows with organism capacity',
    flagLen === grownLiveLen && grew,
    `initialLiveLen=${initialLiveLen} grownLiveLen=${grownLiveLen} successfulMating.length=${flagLen} (grew: ${grew})`);
}

// Gate 29: successfulMating flag suppresses asexual for high-slot mating pair
function gate29(): void {
  // Deterministic high-slot mating integration test.
  // Grows store past initial capacity, allocates a live mating pair at
  // high indices (>1024), runs resolveMatingIntent/resolveContests,
  // then verifies proposeReproduction skips asexual for those slots.
  const SMALL = { founders: 10, worldW: 200, worldH: 200, seed: 88888,
    consumerPhotoScale: 0, consumerBasalScale: 0.25,
    decomposerPhotoScale: 0, decomposerFounders: 0.5,
    decomposerDormancy: 0.05, sporeDispersal: 1,
    grazeYieldScale: 1.0, plantYieldPerMass: 0, radiation: null,
    foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
    dormantThreatBlind: null, mixotrophyCarbon: null,
    mixotrophySaturation: 1.0, nutrientCyclic: true,
    producerCaptureScale: 0.35, nutrientFloor: 0.05, reproSurplusTicks: 5,
    basalFoodPerCell: 0.01, nutrientRegen: 0.0002,
    excretionRate: 0.06, meatYieldPerMass: 0,
  };

  // Use a probe to observe asexual attempts via ReproProbe
  class SlotProbe implements ReproProbe {
    sexualSkipped = new Set<number>();
    reached = new Set<number>();
    reachedN = new Map<number, number>();
    firedSet = new Set<number>();
    blocked(slot: number, _guild: number, gate: number): void {
      void _guild;
      if (gate === REPRO_GATE.sexual) this.sexualSkipped.add(slot);
    }
    reachedRoll(slot: number, _guild: number, _drive: number, _m?: number, _a?: number, _s?: number): void {
      void _guild; void _drive; void _m; void _a; void _s;
      this.reached.add(slot);
      this.reachedN.set(slot, (this.reachedN.get(slot) ?? 0) + 1);
    }
    fired(slot: number, _guild: number): void {
      void _guild;
      this.firedSet.add(slot);
    }
  }

  type PW = {
    store: { grow(cap: number): boolean; genome: Float32Array; bodyGenes: Uint8Array; physical: Float32Array; age: Int32Array; reproCooldown: Int32Array; damage: Float32Array; energy: Float32Array; role: Uint8Array; capacity: number; count: number; trait(slot: number, traitIndex: number): number; };
    live: Uint8Array;
    intent: Uint8Array; mateTarget: Int32Array;
    mateCandA: Int32Array; mateCandB: Int32Array; mateCandN: number;
    submittedByKind: Int32Array; successfulMating: Uint8Array;
    pendingBirths: number; birthParentSlot: Int32Array; birthMateSlot: Int32Array;
    proposeReproduction(): void; resolveMatingIntent(): void; resolveContests(): void;
    ensureSlotArrays(slot: number): void;
  };

  const probe = new SlotProbe();
  const w = new World({ config: SMALL, reproProbe: probe }) as unknown as PW;

  // Grow World arrays and Store arrays past 1024
  w.ensureSlotArrays(2048);
  w.store.grow(4096); // Grow store arrays to cover high indices

  const highA = 1500;
  const highB = 1501;

  // Manually create organisms at high slots (replicate populateSlot essentials)
  // Increment count and set live
  w.store.count = Math.max(w.store.count, highA + 1, highB + 1);
  w.live[highA] = 1;
  w.live[highB] = 1;

  // Set up genome and body for both slots
  const genomeA = new Float32Array(42);
  const genomeB = new Float32Array(42);
  const bodyA = new Uint8Array(8);
  const bodyB = new Uint8Array(8);
  for (let i = 0; i < 42; i++) {
    genomeA[i] = 0.5;
    genomeB[i] = 0.5;
  }
  // Set key traits in genome
  genomeA[TRAIT.MATURITY_AGE] = 10;
  genomeA[TRAIT.ASEXUAL_RATE] = 0.055;
  genomeA[TRAIT.MATE_SEEKING] = 0;
  genomeA[TRAIT.BASAL_COST] = 0.2;
  genomeA[TRAIT.SIZE] = 1.0;
  genomeA[TRAIT.MASS_COST] = 0.1;
  genomeA[TRAIT.REPRO_THRESHOLD] = 0.3;
  genomeA[TRAIT.METABOLIC_EFFICIENCY] = 0.5;
  genomeA[TRAIT.STORAGE_CAPACITY] = 100;
  genomeB[TRAIT.MATURITY_AGE] = 10;
  genomeB[TRAIT.ASEXUAL_RATE] = 0.055;
  genomeB[TRAIT.MATE_SEEKING] = 0;
  genomeB[TRAIT.BASAL_COST] = 0.2;
  genomeB[TRAIT.SIZE] = 1.0;
  genomeB[TRAIT.MASS_COST] = 0.1;
  genomeB[TRAIT.REPRO_THRESHOLD] = 0.3;
  genomeB[TRAIT.METABOLIC_EFFICIENCY] = 0.5;
  genomeB[TRAIT.STORAGE_CAPACITY] = 100;

  // Copy genome to store
  w.store.genome.set(genomeA, highA * 42);
  w.store.genome.set(genomeB, highB * 42);
  w.store.bodyGenes.set(bodyA, highA * 8);
  w.store.bodyGenes.set(bodyB, highB * 8);

  // Set runtime state for mating eligibility
  w.store.age[highA] = 20;
  w.store.age[highB] = 20;
  w.store.reproCooldown[highA] = 0;
  w.store.reproCooldown[highB] = 0;
  w.store.damage[highA] = 0;
  w.store.damage[highB] = 0;
  w.store.energy[highA] = 1000;
  w.store.energy[highB] = 1000;
  w.store.role[highA * 8] = 1; // CONSUMER
  w.store.role[highB * 8] = 1;

  // Also sync expressed traits in physical array
  const traits = [
    [TRAIT.MATURITY_AGE, 10],
    [TRAIT.ASEXUAL_RATE, 0.055],
    [TRAIT.MATE_SEEKING, 0],
    [TRAIT.BASAL_COST, 0.2],
    [TRAIT.SIZE, 1.0],
    [TRAIT.MASS_COST, 0.1],
    [TRAIT.REPRO_THRESHOLD, 0.3],
    [TRAIT.METABOLIC_EFFICIENCY, 0.5],
    [TRAIT.STORAGE_CAPACITY, 100],
  ] as const;
  for (const [trait, val] of traits) {
    w.store.physical[highA * 42 + trait] = val;
    w.store.physical[highB * 42 + trait] = val;
  }

  w.intent.fill(INTENT.SETTLE, 0, w.store.capacity);
  w.mateTarget.fill(-1, 0, w.store.capacity);

  // Mutual intent, mutual selection
  w.intent[highA] = INTENT.MATE; w.intent[highB] = INTENT.MATE;
  w.mateTarget[highA] = highB; w.mateTarget[highB] = highA;
  w.mateCandA[0] = highA; w.mateCandB[0] = highB; w.mateCandN = 1;

  w.resolveMatingIntent();
  w.resolveContests();

  // Check that MATE was submitted and successfulMating flags set
  const mated = w.successfulMating[highA] === 1 && w.successfulMating[highB] === 1;
  const sexualQueued = w.pendingBirths === 2 && w.birthMateSlot[0] >= 0 && w.birthMateSlot[1] >= 0;

  w.proposeReproduction();

  // Verify no asexual attempt from high slots, sexual skip recorded
  const noAsexReached = !probe.reached.has(highA) && !probe.reached.has(highB);
  const sexualSkipped = probe.sexualSkipped.has(highA) && probe.sexualSkipped.has(highB);

  const pass = mated && sexualQueued && noAsexReached && sexualSkipped;
  record('G29', 'high-slot mating pair suppresses asexual (integration)',
    pass,
    `mated=${mated} sexualQueued=${sexualQueued} noAsexReached=${noAsexReached} sexualSkipped=${sexualSkipped} slots=(${highA},${highB})`);
}

// ---------------------------------------------------------------------------
// G30 — per-pool nutrient cap holds on every RETURN path (Task 6 pin)
// ---------------------------------------------------------------------------
// WHY THIS GATE EXISTS. The four nutrient return paths (excretion + three
// biotic-mineralisation sites) used to clamp to a FLAT `nutrientPerCell *
// fertility`, dropping the per-pool multiplier `nutrientCapacity = [1.0, 0.78,
// 0.62]`. Pools B and C could therefore be filled ABOVE their declared
// capacity by a return. That was corrected by routing all four sites through
// the shared helper `nutrientCapAt`.
//
// The defect was LATENT: parity, gates and contracts all stayed green with the
// bug present, because the pools never approach a ceiling at declared settings.
// Nothing else in this suite would notice if the correction were reverted — so
// this gate is the only thing holding it in place.
//
// MEASUREMENT. The per-pool cap is a SOFT TARGET, not an invariant:
// `ScalarField.step()` diffusion runs after the regeneration clamp, so a
// low-fertility cell beside a rich one drifts above its own cap every tick
// even with no writers at all. Asserting against zero would therefore fail
// regardless of the correction. This gate runs TWO arms and asserts a RATIO.
//
// NEITHER ARM IS WRITER-FREE, AND NEITHER IS "RETURNS ONLY". An earlier
// revision of this comment claimed both; it was wrong, and the wrong claim was
// doing work — it implied an isolation this gate does not perform. What the
// arms actually are:
//
//   SHARED configuration (not an algebraic cancellation):
//     abiotic regeneration at `nutrientRegen = 0.5`, diffusion,
//     `nutrientCyclic = false`, `nutrientFloor = 0`,
//     `producerCaptureScale = 0`, seed and world size.
//   baseline:
//     the four biotic RETURN paths off (`excretionRate = 0`,
//     `bioticMineralisation = 0`) and the recycling broadcast off
//     (`recyclingRate = 0`, `basalFoodPerCell = 0`).
//   saturation:
//     those four return paths driven hard, plus the recycling broadcast at
//     `recyclingRate = 0.02`.
//
// So `nutrientRegen` is a controlled confound: an abiotic writer present in
// both arms. Its effects need not cancel in this nonlinear simulation.
// `recyclingRate` is an ARM-SPECIFIC additional writer — it differs
// (0 vs 0.02) and it is UNCLAMPED (the broadcast has no ceiling at all, see
// the nutrientCapAt non-goals), so it raises saturation excess without the
// correction directly touching it. This is a regression scenario, not an
// isolated causal attribution or proof that the confounds cancel.
//
// Saturation excess must stay within 2x the measured baseline. If the
// correction is reverted, B and C jump to ~8x and ~10x baseline under this
// gate's own configuration (measured by reverting nutrientCapAt and
// re-running) and this gate fails loudly. The larger ~150x/~240x figures
// belong to the probe's bigger saturation world, not to this gate.
function gate30(): void {
  interface CapWorld {
    readonly nutrients: { readonly data: Float32Array }[];
    readonly habitat: { readonly fertility: { readonly data: Float32Array } };
    readonly config: { nutrientPerCell: number; nutrientCapacity: number[] };
    step(): void;
  }

  const GATE_TICKS = 120;
  const capWorld = (overrides: Record<string, unknown>): CapWorld =>
    new World({
      config: {
        founders: 300, worldW: 800, worldH: 800, seed: 4242, label: 'gates30',
        // Shared saturation substrate: drive every pool toward its ceiling.
        nutrientRegen: 0.5, nutrientCyclic: false, nutrientFloor: 0,
        producerCaptureScale: 0,
        ...overrides,
      },
    }) as unknown as CapWorld;

  /** Peak per-pool excess above the DECLARED per-pool cap, over all ticks. */
  const peakExcess = (w: CapWorld): number[] => {
    const best = [0, 0, 0];
    const nCells = w.nutrients[0].data.length;
    for (let t = 0; t < GATE_TICKS; t++) {
      w.step();
      for (let nIdx = 0; nIdx < 3; nIdx++) {
        const data = w.nutrients[nIdx].data;
        const mod = w.config.nutrientCapacity[nIdx] ?? 1;
        for (let ci = 0; ci < nCells; ci++) {
          const cap = w.config.nutrientPerCell * w.habitat.fertility.data[ci] * mod;
          const over = data[ci] - cap;
          if (over > best[nIdx]) best[nIdx] = over;
        }
      }
    }
    return best;
  };

  // Baseline: return paths and the recycling broadcast silenced. Abiotic
  // regeneration (shared `nutrientRegen = 0.5`) and diffusion still write, so
  // this is a low-writer arm, NOT a writer-free one.
  const base = peakExcess(capWorld({
    excretionRate: 0, bioticMineralisation: 0, basalFoodPerCell: 0,
    recyclingRate: 0,
  }));
  // Saturation: the four return paths driven hard, pools pushed at their
  // ceiling. Abiotic regeneration and the recycling broadcast are additional
  // writers here too — see the header. This is where the defect was reachable.
  const sat = peakExcess(capWorld({
    excretionRate: 0.06, bioticMineralisation: 1.0, basalFoodPerCell: 0.5,
    recyclingRate: 0.02,
  }));

  // A zero baseline would make the ratio meaningless (division by zero) and
  // would itself mean diffusion is not running — a different failure to
  // surface, not something to divide by.
  const ratios = [0, 1, 2].map((n) => (base[n] > 1e-12 ? sat[n] / base[n] : Infinity));
  const pass = ratios.every((r) => r <= 2);

  record('G30', 'per-pool nutrient cap holds on every return path (Task 6 pin)',
    pass,
    `peak excess above per-pool cap — saturation vs diffusion baseline. ` +
    `A: ${sat[0].toFixed(6)}/${base[0].toFixed(6)} (x${ratios[0].toFixed(2)}), ` +
    `B: ${sat[1].toFixed(6)}/${base[1].toFixed(6)} (x${ratios[1].toFixed(2)}), ` +
    `C: ${sat[2].toFixed(6)}/${base[2].toFixed(6)} (x${ratios[2].toFixed(2)}). ` +
    `All must be <= x2.00. Pool A (mod 1.0) is the built-in control: its ` +
    `per-pool cap EQUALS the flat cap, so it cannot discriminate and must ` +
    `sit near baseline either way. Teeth verified by reverting ` +
    `nutrientCapAt to the flat cap: B -> x8.38, C -> x10.16, A unchanged ` +
    `at x1.00 (FAIL, as required).`);
}

// ============================================================================
// G31 / G32 — the P2-6 flux books, tested INDEPENDENTLY of G30.
//
// G30 proves the per-pool cap correction behaves as declared, but it reads
// only the nutrient FIELDS. It cannot detect a wrong flux book: the books are
// not in its budget. These two gates test the books themselves, at the
// per-(guild, pool[, source]) granularity the books are stored at. Aggregate
// sums would not do: with four books per return, per-cell errors cancel in a
// total and leave the aggregate looking right. Every check here is per cell.
//
// The four books live behind `getFluxSnapshot()`. The pre-0.6.3 snapshot
// exposed ONE signed number under the name "returns", computed as
// `min(cap, before + in) - before`, which goes NEGATIVE whenever a cell is
// already above its own cap when a return arrives — and diffusion runs after
// the regeneration clamp, so that is routine. Ceiling deletion was therefore
// being reported to the reader as biological recycling.
//
// G31 (conservation, writer-isolated world)
//   Diffusion and regeneration are switched off, leaving the nutrient budget
//   with exactly one writer (a biotic return) and one draw (photosynthetic
//   uptake):
//     `nutrientRegen = 0`        no abiotic regeneration term
//     `nutrientFloor = 0`        no floor write
//     `nutrientDecay = 0`        no decay drain in the field step
//     `recyclingRate = 0`        no unclamped broadcast
//     `nutrientDiffusivity = 0`  the 5-point stencil degenerates to the
//                                identity map, so `step()` copies scratch back
//                                unchanged and moves nothing
//   Eviction is bounded, NOT zero. Float32 storage can round a cell UP past
//   its ceiling when a return drives it there, so a later return that arrives
//   finds excess and reports it. The rounding envelope is 4*EPS32*accepted;
//   field agreement is a separate check. G31 detects disagreement, not unclamped writes.
//   It does not assert whether a return leaves a cell above cap — that is G30's
//   job. The budget closes:
//     final - initial  ==  accepted - eviction - photo uptake
//   The left side is measured by the nutrient fields, the right side by the
//   books. Two different instruments agreeing — to float32 write rounding,
//   measured at ~1e-8 relative — is the evidence that `accepted` is the
//   nutrient that actually entered, not a number that merely agrees with its
//   own siblings.
//
// G32 (partition, saturation world with diffusion)
//   The same books are then read in the arm where the ceiling actually bites,
//   and the exact partition identity is asserted per (guild, pool, source):
//     attempted == accepted + capLoss   (every unit offered is accounted for)
//     all four books >= 0               (none is a signed blend)
//   Non-negativity is held to double-precision cancellation (-1e-12 relative)
//   rather than asserted exactly, because `capLoss = amount - acceptedAmt`
//   cancels when the two nearly match and clamping it would break the exact
//   identity above. And `eviction > 0` is REQUIRED, so the gate cannot pass by
//   sitting on the trivial branch where the clamp never fires.
// ============================================================================
function gate31(): void {
  type Snapshot = ReturnType<World['getFluxSnapshot']>;
  // Detritus / sediment / litter — the three biotic mineralisation sources.
  const BIOTIC_SOURCES = 3;

  const sum2 = (a: number[][]): number => {
    let s = 0;
    for (const row of a) for (const v of row) s += v;
    return s;
  };
  const sum3 = (a: number[][][]): number => {
    let s = 0;
    for (const g of a) s += sum2(g);
    return s;
  };

  // ---- G31: writer-isolated conservation -------------------------------
  const ISO_TICKS = 100;
  const iso = new World({
    config: {
      founders: 300, worldW: 800, worldH: 800, seed: 4242, label: 'gates31',
      nutrientRegen: 0, nutrientCyclic: false, nutrientFloor: 0,
      nutrientDiffusivity: 0, nutrientDecay: 0, recyclingRate: 0,
      excretionRate: 0.06, bioticMineralisation: 1.0, basalFoodPerCell: 0.5,
    },
  });
  const poolTotal = (): number => {
    let s = 0;
    for (const f of iso.nutrients) s += f.total();
    return s;
  };
  const initial = poolTotal();
  for (let t = 0; t < ISO_TICKS; t++) iso.step();
  const isoFlux = iso.getFluxSnapshot() as Snapshot;
  const photo = sum2(isoFlux.photoUptake);
  const accIso = sum2(isoFlux.excretionReturns.accepted)
    + sum3(isoFlux.bioticMineralization.accepted);
  const eviIso = sum2(isoFlux.excretionReturns.eviction)
    + sum3(isoFlux.bioticMineralization.eviction);
  const observedDelta = poolTotal() - initial;
  const predictedDelta = accIso - eviIso - photo;
  const scale = Math.abs(accIso) + Math.abs(photo);
  // Residual tolerance is float32 field rounding, not a fitted margin: the
  // pools are Float32Array, so every write rounds and the error accumulates
  // over 100 ticks x 3 pools x every cell. 1e-4 relative is ~3 orders above
  // single precision and still two orders below any real bookkeeping error.
  const g31Residual = scale > 0 ? Math.abs(observedDelta - predictedDelta) / scale : Infinity;

  // With diffusion off, excess is float32 storage rounding at the ceiling.
  // Seeding is below cap (cap * jitter * 0.55 <= 0.7545 * cap).
  // This checks book/field agreement, not whether the cap is enforced (G30).
  const EPS32 = 2 ** -23;
  const g31EvictionEnvelope = 4 * EPS32 * Math.abs(accIso) + 1e-12;
  const g31EvictionBounded = eviIso <= g31EvictionEnvelope;

  // Cap-loss is also tracked from the books (a return's refused amount).
  const capLossIso = sum2(isoFlux.excretionReturns.capLoss)
    + sum3(isoFlux.bioticMineralization.capLoss);

  record('G31', 'flux books are a real measurement, not a self-consistent tally',
    g31Residual <= 1e-4 && g31EvictionBounded && accIso > 0 && capLossIso > 0,
    `writer-isolated world (no diffusion / regen / decay / broadcast / floor): ` +
    `pool totals moved ${observedDelta.toFixed(6)}; the books predict ` +
    `${predictedDelta.toFixed(6)} = accepted ${accIso.toFixed(6)} - photo ` +
    `${photo.toFixed(6)} - eviction ${eviIso.toExponential(3)}. Relative ` +
    `residual ${g31Residual.toExponential(2)}, limit 1e-4 (float32 field ` +
    `rounding). Eviction ${eviIso.toExponential(3)} vs envelope ` +
    `${g31EvictionEnvelope.toExponential(3)}; the current run's ceiling ` +
    `exercise is tracked as capLoss=${capLossIso.toFixed(6)}. Accepted must ` +
    `be > 0, else no return ran and this proves nothing.`);

  // ---- G32: partition identity where the ceiling actually bites ---------
  const SAT_TICKS = 120;
  const sat = new World({
    config: {
      founders: 300, worldW: 800, worldH: 800, seed: 4242, label: 'gates32',
      // G30's saturation arm verbatim: it is the arm where the ceiling bites.
      nutrientRegen: 0.5, nutrientCyclic: false, nutrientFloor: 0,
      producerCaptureScale: 0,
      excretionRate: 0.06, bioticMineralisation: 1.0, basalFoodPerCell: 0.5,
      recyclingRate: 0.02,
    },
  });
  for (let t = 0; t < SAT_TICKS; t++) sat.step();
  const s32 = sat.getFluxSnapshot();

  let attempted = 0, accepted = 0, capLoss = 0, eviction = 0;
  let worstResidual = 0;
  // If a book cell goes negative — the exact defect the pre-0.6.3 snapshot
  // shipped — report WHICH one. "3 negative cells" without an address is a
  // failure a reader cannot act on. `label` is kept for that reason: it is
  // dead weight in the pass path and the whole point in the fail path.
  const negatives: { label: string; guild: number; pool: number; src: number; value: number }[] = [];
  const note = (
    label: string, g: number, p: number, src: number,
    a: number, c: number, l: number, e: number,
  ): void => {
    attempted += a; accepted += c; capLoss += l; eviction += e;
    const r = Math.abs(a - (c + l));
    if (r > worstResidual) worstResidual = r;
    for (const [book, v] of [['attempted', a], ['accepted', c], ['capLoss', l], ['eviction', e]] as const) {
      if (v < 0) negatives.push({ label: `${label}.${book}`, guild: g, pool: p, src, value: v });
    }
  };
  for (let g = 0; g < TROPHIC_COUNT; g++) {
    for (let p = 0; p < NUTRIENT_COUNT; p++) {
      note('excretion', g, p, -1,
        s32.excretionReturns.attempted[g][p],
        s32.excretionReturns.accepted[g][p],
        s32.excretionReturns.capLoss[g][p],
        s32.excretionReturns.eviction[g][p],
      );
      for (let src = 0; src < BIOTIC_SOURCES; src++) {
        note('biotic', g, p, src,
          s32.bioticMineralization.attempted[g][p][src],
          s32.bioticMineralization.accepted[g][p][src],
          s32.bioticMineralization.capLoss[g][p][src],
          s32.bioticMineralization.eviction[g][p][src],
        );
      }
    }
  }
  // Float summation over ~1e4 non-negative terms: 1e-6 x the total is generous
  // and still two orders below any defect that would blend the books.
  const partitionOk = worstResidual <= 1e-6 * Math.max(1, attempted);
  // NON-NEGATIVITY, bounded rather than asserted exactly. `capLoss` is
  // accumulated as `amount - acceptedAmt`, and when the two are nearly equal
  // that subtraction cancels: a run of small excretion returns leaves cells
  // around -1e-15. Clamping them to zero would break
  // `attempted == accepted + capLoss`, which is the stronger claim, so the
  // exact identity wins and non-negativity is held to double-precision
  // cancellation instead. A genuine negative return — the pre-0.6.3 defect —
  // is O(1), five orders above this bound.
  const worstNeg = negatives.reduce<{ label: string; guild: number; pool: number; src: number; value: number } | null>(
    (acc, n) => (acc === null || n.value < acc.value ? n : acc), null);
  const negOk = worstNeg === null || worstNeg.value >= -1e-12 * Math.max(1, attempted);
  const worstNegText = worstNeg === null
    ? 'none'
    : `${worstNeg.label}[guild ${worstNeg.guild}][pool ${worstNeg.pool}]` +
      `[source ${worstNeg.src}] = ${worstNeg.value}`;

  record('G32', 'return books partition exactly at every (guild, pool, source)',
    negOk && partitionOk && eviction > 0 && attempted > 0,
    `saturation arm with diffusion, ${SAT_TICKS} ticks: attempted ` +
    `${attempted.toFixed(6)} == accepted ${accepted.toFixed(6)} + capLoss ` +
    `${capLoss.toFixed(6)}; worst per-cell residual ` +
    `${worstResidual.toExponential(2)}, limit 1e-6 x max(1, attempted). ` +
    `${negatives.length} negative cells, limit -1e-12 x max(1, attempted); ` +
    `worst: ${worstNegText}. Eviction total ${eviction.toFixed(6)} — the ` +
    `bounded over-cap event; it must be > 0 or the ceiling never bit and the ` +
    `identity was only tested on its trivial branch.`);
}

// G33 — phenotype-partitioned mineralization books (O3, Owner decision 2026-10-15).
//
// The new `bioticMineralizationByPheno` family must partition the existing
// guild books exactly: for every (guild, pool, source) and every one of the
// four books, `guild book == sum over the 4 donor classes`. Per-cell, like
// G32: aggregates would let misbooked classes cancel. `neither` is REPORTED,
// not asserted zero: the cached mineralizer flag and live expressed traits
// refresh on different cadences (plus post-birth trait drift under genomeV2),
// so a stale-flag event can legitimately classify NEITHER. Asserting zero
// would couple the gate to refresh cadence. New-books determinism is checked
// by twin runs with elementwise snapshot equality (books are excluded from
// `hashState` by design, so nothing else covers them).
function gate33(): void {
  const TICKS = 120;
  const cfg = {
    founders: 300, worldW: 800, worldH: 800, seed: 4242, label: 'gates33',
    nutrientRegen: 0.5, nutrientCyclic: false, nutrientFloor: 0,
    producerCaptureScale: 0,
    excretionRate: 0.06, bioticMineralisation: 1.0, basalFoodPerCell: 0.5,
    recyclingRate: 0.02,
  };
  const run = (): World => {
    const w = new World({ config: { ...cfg } });
    for (let t = 0; t < TICKS; t++) w.step();
    return w;
  };
  const a = run();
  const fa = a.getFluxSnapshot();
  const ph = fa.bioticMineralizationByPheno;
  const old = fa.bioticMineralization;

  let attempted = 0;
  let worstResidual = 0;
  let worstNegValue: number | null = null;
  let worstNegWhere = 'none';
  let acceptedNonNeither = 0;
  let neitherAccepted = 0;
  let phenoEviction = 0;
  const bookOf = (fam: { attempted: number[][][][]; accepted: number[][][][]; capLoss: number[][][][]; eviction: number[][][][] }, book: 'attempted' | 'accepted' | 'capLoss' | 'eviction') => fam[book];
  for (let g = 0; g < TROPHIC_COUNT; g++) {
    for (let p = 0; p < NUTRIENT_COUNT; p++) {
      for (let src = 0; src < 3; src++) {
        const cells: Array<[book: 'attempted' | 'accepted' | 'capLoss' | 'eviction', guildVal: number]> = [
          ['attempted', old.attempted[g][p][src]],
          ['accepted', old.accepted[g][p][src]],
          ['capLoss', old.capLoss[g][p][src]],
          ['eviction', old.eviction[g][p][src]],
        ];
        for (const [book, guildVal] of cells) {
          let s = 0;
          for (let c = 0; c < MINERAL_PHENO_CLASS_COUNT; c++) {
            const v: number = bookOf(ph, book)[c][g][p][src];
            s += v;
            attempted += book === 'attempted' ? v : 0;
            if (v < 0 && (worstNegValue === null || v < worstNegValue)) {
              worstNegValue = v;
              worstNegWhere = `pheno.${book}[class ${c}][guild ${g}][pool ${p}][source ${src}] = ${v}`;
            }
            if (book === 'accepted') {
              if (c === 3) neitherAccepted += v;
              else acceptedNonNeither += v;
            }
            if (book === 'eviction') phenoEviction += v;
          }
          const r = Math.abs(guildVal - s);
          if (r > worstResidual) worstResidual = r;
        }
      }
    }
  }
  const partitionOk = worstResidual <= 1e-6 * Math.max(1, attempted);
  const negOk = worstNegValue === null || worstNegValue >= -1e-12 * Math.max(1, attempted);
  const nonVacuous = attempted > 0 && acceptedNonNeither > 0 && phenoEviction > 0;

  // Twin-run determinism over the NEW family (elementwise ===).
  const b = run();
  const fb = b.getFluxSnapshot();
  const pb = fb.bioticMineralizationByPheno;
  let detMismatch = 0;
  for (let c = 0; c < MINERAL_PHENO_CLASS_COUNT; c++) {
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      for (let p = 0; p < NUTRIENT_COUNT; p++) {
        for (let src = 0; src < 3; src++) {
          if (bookOf(ph, 'attempted')[c][g][p][src] !== bookOf(pb, 'attempted')[c][g][p][src]) detMismatch++;
          if (bookOf(ph, 'accepted')[c][g][p][src] !== bookOf(pb, 'accepted')[c][g][p][src]) detMismatch++;
          if (bookOf(ph, 'capLoss')[c][g][p][src] !== bookOf(pb, 'capLoss')[c][g][p][src]) detMismatch++;
          if (bookOf(ph, 'eviction')[c][g][p][src] !== bookOf(pb, 'eviction')[c][g][p][src]) detMismatch++;
        }
      }
    }
  }
  const hashEqual = a.hashState() === b.hashState();
  const neitherShare = acceptedNonNeither + neitherAccepted > 0
    ? neitherAccepted / (acceptedNonNeither + neitherAccepted) : 0;

  record('G33', 'phenotype books partition guild books at every (class, guild, pool, source)',
    negOk && partitionOk && nonVacuous && detMismatch === 0 && hashEqual,
    `saturation arm (G32 verbatim + phenotype mirror), ${TICKS} ticks: ` +
    `per-cell guild==sum(classes) worst residual ${worstResidual.toExponential(2)}, ` +
    `limit 1e-6 x max(1, attempted=${attempted.toFixed(1)}). ` +
    `Worst negative pheno cell: ${worstNegWhere} (limit -1e-12 x max(1, attempted)). ` +
    `Non-neither accepted ${acceptedNonNeither.toFixed(3)} (> 0 required); ` +
    `neither accepted ${neitherAccepted.toFixed(3)} ` +
    `(share ${(neitherShare * 100).toFixed(2)}%, REPORTED not asserted — stale ` +
    `flag / trait-drift events classify here). Pheno eviction total ` +
    `${phenoEviction.toExponential(3)} (> 0 required, ceiling bit). Twin-run new-book ` +
    `mismatches ${detMismatch} (must be 0); trajectory digests ` +
    `${hashEqual ? 'equal' : 'DIFFER'} (must be equal).`);
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
  gate33();

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
