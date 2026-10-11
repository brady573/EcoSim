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

import { World } from './world/world.js';
import { WORLD_ENGINE_VERSION } from './world/version.js';
import { INTERACTION, InteractionQueue } from './bio/interactions.js';
import { TRAIT, TRAIT_COUNT } from './bio/genome.js';
import { OrganismStore } from './core/soa.js';
import { Rng } from './core/rng.js';
import { INTENT } from './world/world.js';

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
  // Assert the recycling ARITHMETIC directly, at two grid resolutions.
  //
  // An earlier version of this gate watched the standing nutrient field and
  // was wrong three times: it measured per-cell background regeneration, then
  // initial per-cell seeding, then net uptake rather than return. Uptake and
  // return occur in the same ticks, so no field proxy can separate them. The
  // quantity under test is a pure function of the mineralised total and the
  // cell count, so it is asserted directly instead.
  const run = (cell: number): { ratio: number } => {
    const w = new World({
      config: { ...SMALL, worldW: 1600, worldH: 1600, fieldCell: cell, founders: 60, nutrientRegen: 0, excretionRate: 0 } as never,
    });
    for (let i = 0; i < 40; i++) w.step();
    const intended = w.mineralisedLastTick * w.config.recyclingRate * 0.5;
    const got = w.recycledLastTick;
    return { ratio: intended === 0 ? 1 : got / intended };
  };
  const coarse = run(100); // 16 x 16 = 256 cells
  const fine = run(25); // 64 x 64 = 4096 cells, 16x more cells
  const bothExact = Math.abs(coarse.ratio - 1) < 1e-9 && Math.abs(fine.ratio - 1) < 1e-9;
  record(
    'G9',
    'recycled nutrient is grid-size invariant',
    bothExact,
    `recycled / (mineralised x recyclingRate x 0.5): coarse(256 cells)=${coarse.ratio.toFixed(6)} ` +
      `fine(4096 cells)=${fine.ratio.toFixed(6)}, want exactly 1.000000. ` +
      `A value near 16 means the return is still multiplied by the cell count; ` +
      `the ratio is independent of resolution because both sides are per-tick totals.`,
  );
}

function gate10(): void {
  const w = new World({
    config: {
      ...SMALL,
      founders: 300,
      producerCaptureScale: 0,
      consumerPhotoScale: 0,
      decomposerPhotoScale: 0,
      basalFoodPerCell: 0,
      nutrientRegen: 0,
      excretionRate: 0,
      meatYieldPerMass: 0,
      grazeYieldScale: 0,
      plantYieldPerMass: 0,
    } as never,
  });
  for (let i = 0; i < 300; i++) w.step();
  const g = [0, 1, 2].map((i) => w.ledger.capturedByGuild[i]);
  const total = g.reduce((a, b) => a + b, 0);
  record(
    'G10',
    'no guild captures energy when all capture scales are zero',
    total === 0 && g.every((x) => x === 0),
    `capture by guild [prod, cons, dec] = [${g[0]}, ${g[1]}, ${g[2]}], total=${total}. ` +
      `All must be exactly 0. A non-zero guild here means a capture path escaped gating ` +
      `and the zero preset is not actually zero.`,
  );
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