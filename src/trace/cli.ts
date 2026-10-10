/**
 * Trace inspection CLI: run a world and report on its event log.
 *
 * This exists because answering "why did this happen" during development
 * required re-running the simulation with one-off probe scripts, which is slow
 * and easy to get wrong. Everything here works from a single traced run.
 *
 * Usage:
 *   tsx src/trace/cli.ts [--ticks=N] [--seed=N] [--founders=N] [--capacity=N]
 *                        [--events] [--deaths] [--contests] [--immigrations]
 *                        [--lineage=ID] [--organism=ID] [--window=A..B]
 *                        [--summary] [--causes] [--survival]
 *
 * Examples:
 *   tsx src/trace/cli.ts --summary --causes
 *   tsx src/trace/cli.ts --ticks=400 --deaths | head -40
 *   tsx src/trace/cli.ts --lineage=42 --window=100..300
 *   tsx src/trace/cli.ts --survival            # do immigrants live long?
 */

import { World } from '../world/world.js';
import {
  formatEvent,
  TRACE,
  TRACE_NAME,
  DEATH_CAUSE_NAME,
  type TraceEvent,
} from './trace.js';

interface Args {
  ticks: number;
  seed: number;
  founders: number;
  capacity: number;
  events: boolean;
  deaths: boolean;
  contests: boolean;
  immigrations: boolean;
  lineage: number | null;
  organism: number | null;
  window: [number, number] | null;
  summary: boolean;
  causes: boolean;
  survival: boolean;
}

/** Parse a numeric flag, rejecting NaN/fractional/non-positive values. */
function num(val: string, name: string, min: number, integer: boolean): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) {
    console.error(`--${name} expects a ${integer ? 'positive integer' : 'number'} >= ${min}, got "${val}"`);
    process.exit(2);
  }
  return n;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    ticks: 400, seed: 11, founders: 200, capacity: 50000,
    events: false, deaths: false, contests: false, immigrations: false,
    lineage: null, organism: null, window: null,
    summary: false, causes: false, survival: false,
  };
  for (const arg of argv) {
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(2, eq) : arg.replace(/^--/, '');
    const val = eq >= 0 ? arg.slice(eq + 1) : '';
    switch (key) {
      case 'ticks': a.ticks = num(val, 'ticks', 0, true); break;
      case 'seed': a.seed = num(val, 'seed', 0, true); break;
      case 'founders': a.founders = num(val, 'founders', 1, true); break;
      // Capacity MUST be a positive integer: NaN silently corrupted the ring
      // (Math.max(1, NaN) is NaN) and a fractional value threw RangeError.
      case 'capacity': a.capacity = num(val, 'capacity', 1, true); break;
      case 'events': a.events = true; break;
      case 'deaths': a.deaths = true; break;
      case 'contests': a.contests = true; break;
      case 'immigrations': a.immigrations = true; break;
      case 'lineage': a.lineage = num(val, 'lineage', 0, true); break;
      case 'organism': a.organism = num(val, 'organism', 0, true); break;
      case 'summary': a.summary = true; break;
      case 'causes': a.causes = true; break;
      case 'survival': a.survival = true; break;
      case 'window': {
        const parts = val.split('..');
        if (parts.length !== 2) {
          console.error(`--window expects A..B, got "${val}"`);
          process.exit(2);
        }
        a.window = [num(parts[0], 'window', 0, true), num(parts[1], 'window', 0, true)];
        break;
      }
      default:
        console.error(`unknown flag: ${arg}`);
        process.exit(2);
    }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));

const world = new World({
  config: { founders: args.founders, seed: args.seed },
  trace: { enabled: true, capacity: args.capacity },
});

for (let t = 0; t < args.ticks; t++) world.step();

const log = world.trace();
if (!log) {
  console.error('tracing did not initialise');
  process.exit(1);
}
const all = log.events();
const guildName = (g: number) => ['producer', 'consumer', 'decomposer'][g] ?? String(g);

function inWindow(e: TraceEvent): boolean {
  return args.window === null || (e.tick >= args.window[0] && e.tick <= args.window[1]);
}

let printed = 0;
function printEvents(pred: (e: TraceEvent) => boolean, cap = 40): void {
  let n = 0;
  for (const e of all) {
    if (!pred(e) || !inWindow(e)) continue;
    console.log('  ' + formatEvent(e, guildName));
    if (++n >= cap) { console.log(`  ... (capped at ${cap}; raise the cap or narrow with --window)`); break; }
  }
  printed += n;
}

if (args.events) {
  console.log(`=== ALL EVENTS (ticks ${args.window ? args.window.join('..') : '0..' + args.ticks}) ===`);
  printEvents(() => true, 200);
}
if (args.deaths) {
  console.log('\n=== DEATHS ===');
  printEvents((e) => e.kind === TRACE.DEATH);
}
if (args.contests) {
  console.log('\n=== CONTESTS ===');
  printEvents((e) => e.kind === TRACE.CONTEST);
}
if (args.immigrations) {
  console.log('\n=== IMMIGRATIONS ===');
  printEvents((e) => e.kind === TRACE.IMMIGRATION);
}
if (args.organism !== null) {
  console.log(`\n=== ORGANISM ${args.organism}: full history ===`);
  printEvents((e) => e.a === args.organism || e.b === args.organism, 100);
}
if (args.lineage !== null) {
  const map = world.traceLineageMap();
  console.log(`\n=== LINEAGE ${args.lineage}: full history ===`);
  printEvents((e) => map.get(e.a) === args.lineage || map.get(e.b) === args.lineage, 100);
}

if (args.causes) {
  console.log('\n=== DEATH CAUSE BREAKDOWN ===');
  const byCause = new Map<string, number>();
  const byGuildCause = new Map<string, number>();
  for (const e of all) {
    if (e.kind !== TRACE.DEATH) continue;
    const c = DEATH_CAUSE_NAME[e.v] ?? String(e.v);
    byCause.set(c, (byCause.get(c) ?? 0) + 1);
    const key = `${guildName(e.z)}/${c}`;
    byGuildCause.set(key, (byGuildCause.get(key) ?? 0) + 1);
  }
  for (const [k, v] of [...byCause].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }
  console.log('  by guild:');
  for (const [k, v] of [...byGuildCause].sort((x, y) => y[1] - x[1])) {
    console.log(`    ${k.padEnd(24)} ${v}`);
  }
}

if (args.survival) {
  // Do immigrants live long enough to matter, or do they die immediately?
  // This is THE question for whether immigration is genuine recolonisation or
  // a subsidy propping up a doomed population.
  const immigrations = all.filter((e) => e.kind === TRACE.IMMIGRATION);
  if (immigrations.length === 0) {
    console.log('\n=== IMMIGRANT SURVIVAL ===');
    console.log('  no immigrants tracked in the retained window (try a longer run or --immigrations to confirm)');
  } else {
  // Ring eviction silently turns evicted deaths into "still alive", biasing
  // toward a false positive. Say so rather than report a confident wrong verdict.
  if (log.eventCount > all.length) {
    console.log(`  WARNING: ${log.eventCount - all.length} events were evicted by the ring buffer;`);
    console.log('  survival figures below describe only the retained suffix and may overstate survival.');
  }
  const deaths = new Map<number, TraceEvent>();
  for (const e of all) if (e.kind === TRACE.DEATH) deaths.set(e.a, e);
  let died = 0, alive = 0;
  const lifespans: number[] = [];
  for (const im of immigrations) {
    const d = deaths.get(im.a);
    if (d) { died++; lifespans.push(d.tick - im.tick); }
    else { alive++; }
  }
  const mean = lifespans.length ? lifespans.reduce((a, b) => a + b, 0) / lifespans.length : 0;
  const median = lifespans.length ? [...lifespans].sort((a, b) => a - b)[Math.floor(lifespans.length / 2)] : 0;
  console.log('\n=== IMMIGRANT SURVIVAL ===');
  console.log(`  immigrants tracked: ${immigrations.length}`);
  console.log(`  died during run:    ${died}  (mean lifespan ${mean.toFixed(0)} ticks, median ${median})`);
  console.log(`  still alive at end: ${alive}`);
  console.log(`  verdict: ${died === 0 ? 'ALL SURVIVED' : alive / Math.max(1, immigrations.length) > 0.5 ? 'majority survived — genuine establishment' : 'most died — thin subsidy, not self-sustaining'}`);
  }
}

if (args.summary || printed === 0) {
  const counts = new Map<number, number>();
  for (const e of all) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  console.log(`\n=== TRACE SUMMARY (seed ${args.seed}, ${args.ticks} ticks, pop ${world.store.population}) ===`);
  console.log(`  events retained: ${all.length} of ${log.eventCount} recorded`);
  for (const [kind, n] of [...counts].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${(TRACE_NAME[kind] ?? kind).padEnd(16)} ${n}`);
  }
  if (args.summary && printed === 0) {
    console.log('\n  (no event flags given — showing summary only; try --deaths --contests --survival)');
  }
}