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
 *
 * Run: pnpm gates   (designed to finish in a few seconds at small scale)
 */

import { World } from './world/world.js';
import { WORLD_ENGINE_VERSION } from './world/version.js';
import { INTERACTION } from './bio/interactions.js';
import { TRAIT_COUNT } from './bio/genome.js';

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

function main(): void {
  console.log(`=== credibility gates :: ${WORLD_ENGINE_VERSION} ===`);
  console.log(`scenario: founders=${SMALL.founders} world=${SMALL.worldW}x${SMALL.worldH} ticks=${TICKS} seed=${SMALL.seed}\n`);
  gate1();
  gate2();
  gate3();
  gate4();
  gate5();

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