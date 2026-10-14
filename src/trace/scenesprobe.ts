/**
 * SENESCENCE PROBE — dormant-sleeper viability loss vs overgrowth lock-in.
 *
 * Same engine config as the combined winner (photox4 + seeding + dormancy +
 * spores) plus dormantSenescence=grace. Reports guild counts, dormant count,
 * and cumulative senescence deaths every 1000 ticks, so the tip-point
 * trajectories can be compared directly against deeptime baselines.
 *
 * Run: tsx src/trace/senesprobe.ts [seed] [ticks] [setting] [photoScale]
 *   setting: plain number = fixed grace ticks (e.g. 200),
 *     or "share:R" (dormant-share mode, R=rate scale),
 *     or "lifespan:K" (lifespan-relative mode, K=grace multiplier),
 *     or "off" (no senescence — combined winner as-is).
 *   photoScale: consumerPhotoScale override (default 4 = combined winner).
 *   e.g. tsx src/trace/senesprobe.ts 24601 6000 200
 *        tsx src/trace/senesprobe.ts 517 6000 share:1 2
 */
import { World } from '../world/world.js';
import { TROPHIC_COUNT } from '../bio/role.js';

const SEED = Number(process.argv[2] ?? 24601);
const TICKS = Number(process.argv[3] ?? 6000);
const SETTING = process.argv[4] ?? '200';
const PHOTO = Number(process.argv[5] ?? 4);
// BASAL: consumer upkeep multiplier, or "null" for unchanged (default).
// The rabbits-eat-plants deal pairs photox0 with cheap bodies.
const BASALRAW = process.argv[6] ?? 'null';
const BASAL = BASALRAW === 'null' ? null : Number(BASALRAW);
// GRAZE: graze yield multiplier, or "null" for unchanged (default).
const GRAZERAW = process.argv[7] ?? 'null';
const GRAZE = GRAZERAW === 'null' ? null : Number(GRAZERAW);
// TISSUE: plant-tissue yield basis, or "null"/missing for legacy (default 0).
const TISSUERAW = process.argv[8] ?? 'null';
const TISSUE = TISSUERAW === 'null' ? 0 : Number(TISSUERAW);
// DISEASE: diseased-food fraction, or "null"/missing for off.
const DISRAW = process.argv[10] ?? 'null';
const DISNUM = DISRAW === 'null' ? null : Number(DISRAW);
if (DISNUM !== null && (!Number.isFinite(DISNUM) || DISNUM < 0)) {
  throw new Error(`bad disease fraction: ${DISRAW} (want 0..1 or null)`);
}
const DISEASE = DISNUM;
// RADIATION: "onset,doubling,cap" or "onset,doubling,cap,couplingFloor",
// or "null"/missing for off. The optional 4th value couples the multiplier
// to the live dormant share: radiation dies as overgrowth dies.
const RADRAW = process.argv[9] ?? 'null';
let RADIATION: { onset: number; doubling: number; cap: number; overgrowthCoupling: number | null } | null = null;
if (RADRAW !== 'null') {
  const parts = RADRAW.split(',').map(Number);
  const coupling = parts.length > 3 ? parts[3] : null;
  const head = parts.slice(0, 3);
  const couplingOk = coupling === null || (Number.isFinite(coupling) && coupling >= 0);
  if (
    (parts.length !== 3 && parts.length !== 4) ||
    head.some((x) => !Number.isFinite(x)) ||
    head[0] < 0 || head[1] <= 0 || head[2] < 1 ||
    !couplingOk
  ) {
    throw new Error(`bad radiation schedule: ${RADRAW} (want onset,doubling,cap[,couplingFloor])`);
  }
  RADIATION = { onset: parts[0], doubling: parts[1], cap: parts[2], overgrowthCoupling: coupling };
}
// MIXO: mixotrophic carbon requirement — "on" = producers need local
// heterotrophic substrate to photosynthesise. "off"/"null" = declared.
const MIXORAW = (process.argv[13] ?? 'off').toLowerCase();
if (!['on', 'true', 'off', 'false', 'null'].includes(MIXORAW)) {
  throw new Error(`bad mixotrophyCarbon: ${process.argv[13]} (want on|off)`);
}
const MIXOTROPHY = MIXORAW === 'on' || MIXORAW === 'true' ? true : null;
// CYC: cyclic nutrient regeneration — "on" = nutrient returns only where
// organic matter is being decomposed. "off"/"null" = declared.
const CYCRAW = (process.argv[14] ?? 'off').toLowerCase();
if (!['on', 'true', 'off', 'false', 'null'].includes(CYCRAW)) {
  throw new Error(`bad nutrientCyclic: ${process.argv[14]} (want on|off)`);
}
const NUTRIENT_CYCLIC = CYCRAW === 'on' || CYCRAW === 'true' ? true : null;
// SAT: substrate saturation for the two knobs above (default 0.4).
const SATRAW = process.argv[15] ?? '0.4';
const SAT = Number(SATRAW);
if (!Number.isFinite(SAT) || SAT <= 0) {
  throw new Error(`bad mixotrophySaturation: ${SATRAW} (want >0)`);
}
// NFLOOR: abiotic nutrient floor as a fraction of per-cell capacity (0=off).
const NFRAW = process.argv[17] ?? '0';
const NFLOOR = Number(NFRAW);
if (!Number.isFinite(NFLOOR) || NFLOOR < 0 || NFLOOR > 1) {
  throw new Error(`bad nutrientFloor: ${NFRAW} (want 0..1)`);
}
// --- ZERO BASELINE PRESET ---------------------------------------------------
// Owner directive: 0 = inert, 1 = declared. `--zero` sets every energy-giving
// mechanism to inert in one flag, so the flatline baseline is a single
// argument instead of a hand-typed line that can be got wrong.
//
// Every energy source is zeroed together, because photosynthesis is the ONLY
// true injection into the system: with producer light capture at zero, no
// guild can be fed and all three starve. Prediction (recorded before the
// runs): complete extinction on every seed. If any seed survives, the
// surviving mechanism is the finding — reported, not treated as a failure.
//
// What `--zero` does NOT do: it does not disable structural parameters
// (metapopulation grid, dormancy thresholds, dispersal). Those are not energy
// sources and leaving them declared keeps the flatline attributable to
// energy only. The brake is not zeroed either — it is the one graduated
// control, and with no energy it has nothing to act on.
const ZERO = process.argv.includes('--zero');
// `--zero-lift=dial:value` raises ONE dial off the zero floor while leaving
// every other energy source inert.
//
// Needed because the preset deliberately spreads LAST in the config object
// and so overrides positional arguments. That ordering is correct for the
// baseline — a hand-typed dial must never be able to contaminate it — but it
// also means the slider ladder cannot simply pass a dial alongside --zero.
// This flag is the sanctioned way to take exactly one step off the floor.
// A lifted dial whose name is not in the preset is a typo, so it throws
// rather than silently doing nothing.
const LIFTS = new Map<string, number>();
for (const arg of process.argv) {
  const m = /^--zero-lift=([a-zA-Z]+):(.+)$/.exec(arg);
  if (!m) continue;
  const value = Number(m[2]);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`bad --zero-lift value: ${m[2]} (want >=0)`);
  }
  LIFTS.set(m[1], value);
}
const ZERO_LIFTABLE = {
  producerCaptureScale: 0,
  consumerPhotoScale: 0,
  basalFoodPerCell: 0,
  nutrientRegen: 0,
  excretionRate: 0,
  meatYieldPerMass: 0,
  grazeYieldScale: 0,
  plantYieldPerMass: 0,
  // Also in ZEROED: the preset sets the baseline, this authorises the override.
  // Belonging in BOTH is correct — the P0-2 bug was being in ZERO_LIFTABLE
  // ONLY, which left the baseline ungated while making it look controllable.
  decomposerPhotoScale: 0,
} as const;
const ZEROED = ZERO ? {
  // No primary energy: producers cannot photosynthesise at all.
  producerCaptureScale: 0,
  // Consumers get no solar income either.
  consumerPhotoScale: 0,
  // Decomposers had NO branch in the guild capture gate, so they captured at
  // full demand regardless of the two scales above. That made the decomposer
  // guild the only one with a live input under --zero.
  decomposerPhotoScale: 0,
  // No exogenous organic subsidy.
  basalFoodPerCell: 0,
  // No abiotic nutrient regeneration (the free lunch A+C was closing).
  nutrientRegen: 0,
  // No excretion. MEASURED LEAK, not a theoretical guess: with every other
  // energy source zeroed, seed 41018 still grew 194 -> 5519 and producers
  // recovered 0 -> 186. Cause: excretion returns nutrient to substrate as a
  // matter source, so decomposers living on corpse pools plus their own
  // excretion form a self-sustaining loop (decomposer B/D 1.30, above
  // replacement) that producers can draw a trickle from with zero
  // photosynthesis. Zeroing this is what takes the flatline from 17/18 to
  // 18/18. See REPORT.md.
  excretionRate: 0,
  // No trophic transfer: a bite yields nothing.
  meatYieldPerMass: 0,
  grazeYieldScale: 0,
  plantYieldPerMass: 0,
  // Lifts applied last, and only for dials the preset actually owns. An
  // unknown dial name is a typo, so it throws rather than silently reading as
  // "the lift did nothing".
  ...(() => {
    if (LIFTS.size === 0) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of LIFTS) {
      if (!(k in ZERO_LIFTABLE)) {
        throw new Error(
          `unknown --zero-lift dial: ${k} (want one of ${Object.keys(ZERO_LIFTABLE).join(', ')})`,
        );
      }
      out[k] = v;
    }
    return out;
  })(),
} : null;
// RSUR: breeding-surplus buffer in ticks. "null"/missing = declared 90.
// Previously a hardcoded engine constant with no config path; see
// config.reproSurplusTicks. Both breeding gates read it.
const RSURRAW = process.argv[18] ?? 'null';
const RSUR = RSURRAW === 'null' ? null : Number(RSURRAW);
if (RSUR !== null && (!Number.isFinite(RSUR) || RSUR < 0)) {
  throw new Error(`bad reproSurplusTicks: ${RSURRAW} (want >=0 or null)`);
}
// DFOUND: decomposer founder fraction (trailing slot 19). "null"/missing =
// the probe's standing 0.25, so every existing arm runs byte-identical.
// Explicit 0..1 for ablation arms; loud on anything else.
// Positional discipline: trailing values precede --zero flags (as all slots
// do), so a flag in slot 19 reads as "not provided", never as a value.
const _DFDRAW = process.argv[19] ?? 'null';
const DFOUNDRAW = _DFDRAW.startsWith('--') ? 'null' : _DFDRAW;
const DFOUND = DFOUNDRAW === 'null' ? 0.25 : Number(DFOUNDRAW);
if (DFOUNDRAW.trim() === '' || !Number.isFinite(DFOUND) || DFOUND < 0 || DFOUND > 1) {
  throw new Error(`bad decomposerFounders: ${DFOUNDRAW} (want 0..1 or null)`);
}
// PCAP: producerCaptureScale — multiplies PRODUCER photosynthesis demand.
// "null"/missing = declared. With mixo+cyc on, producers are light-starved;
// this is the light dial that sets how slowly (or fast) they regrow.
const PCAPRAW = process.argv[16] ?? 'null';
const PCAP = PCAPRAW === 'null' ? null : Number(PCAPRAW);
if (PCAP !== null && (!Number.isFinite(PCAP) || PCAP <= 0)) {
  throw new Error(`bad producerCaptureScale: ${PCAPRAW} (want >0 or null)`);
}
// DTB: dormantThreatBlind — "on"/"true" = sleepers cannot detect threats,
// "off"/"false"/"null"/missing = declared behaviour (sleepers still flee).
const DTRAW = (process.argv[12] ?? 'null').toLowerCase();
if (!['on', 'true', 'off', 'false', 'null'].includes(DTRAW)) {
  throw new Error(`bad dormantThreatBlind: ${process.argv[12]} (want on|off|null)`);
}
const DORMANT_THREAT_BLIND = DTRAW === 'on' || DTRAW === 'true' ? true : null;
// PIONEER: "grace,discount" establishment bonus, or "null"/missing for off.
const PIORAW = process.argv[11] ?? 'null';
let PIONEER: { grace: number; discount: number } | null = null;
if (PIORAW !== 'null') {
  const parts = PIORAW.split(',').map(Number);
  if (parts.length !== 2 || parts.some((x) => !Number.isFinite(x)) || parts[0] < 0 || parts[1] < 0 || parts[1] > 1) {
    throw new Error(`bad pioneer bonus: ${PIORAW} (want grace,discount01)`);
  }
  PIONEER = { grace: parts[0], discount: parts[1] };
}
// Plain number = legacy fixed grace; "share:R" / "lifespan:K" select a
// scale-free mode with its scale parameter; "off" = no senescence.
let senescence: number | { mode: 'share' | 'lifespan'; scale: number } | null;
let settingLabel = SETTING;
if (SETTING === 'off') {
  senescence = null;
  settingLabel = 'off';
} else if (SETTING.includes(':')) {
  const [mode, raw] = SETTING.split(':');
  const scale = Number(raw);
  if ((mode !== 'share' && mode !== 'lifespan') || !(scale > 0)) {
    throw new Error(`bad senescence setting: ${SETTING} (want N, share:R, or lifespan:K)`);
  }
  senescence = { mode, scale };
} else {
  const grace = Number(SETTING);
  if (!(grace >= 0)) throw new Error(`bad senescence setting: ${SETTING}`);
  senescence = grace;
}
const STEP = 1000;

const w = new World({
  config: {
    founders: 400, worldW: 2400, worldH: 2400, seed: SEED,
    consumerPhotoScale: PHOTO, consumerBasalScale: BASAL, decomposerFounders: DFOUND,
    decomposerDormancy: 0.05, sporeDispersal: 1, grazeYieldScale: GRAZE,
    plantYieldPerMass: TISSUE, radiation: RADIATION, foodDisease: DISEASE,
    pioneerBonus: PIONEER, dormantSenescence: senescence,
    dormantThreatBlind: DORMANT_THREAT_BLIND,
    mixotrophyCarbon: MIXOTROPHY, mixotrophySaturation: SAT,
    nutrientCyclic: NUTRIENT_CYCLIC, producerCaptureScale: PCAP,
    nutrientFloor: NFLOOR, reproSurplusTicks: RSUR,
    // The zero preset overrides the energy-giving dials above. Spread last so
    // it cannot be silently undone by a positional argument.
    ...(ZEROED ?? {}),
  },
});
const s = w.store;

console.log(`SENESCENCE seed=${SEED} ticks=${TICKS} setting=${settingLabel} photox${PHOTO} basalx${BASALRAW} grazex${GRAZERAW} tissuex${TISSUERAW} radx${RADRAW} disx${DISRAW} piox${PIORAW} dtb${DTRAW} mixo${MIXORAW} cyc${CYCRAW} sat${SAT} pcap${PCAPRAW} nfloor${NFRAW} rsur${RSURRAW} dfound=${DFOUND}${ZERO ? ' ZERO-BASELINE' : ''} (probe config)`);
console.log('tick      pop   prod  cons  decomp | dormant  senescDeaths');

for (let t = 1; t <= TICKS; t++) {
  w.step();
  // Always print the final tick alongside each 1000-tick checkpoint, so
  // horizons like 2400/4800 still report their endpoint state.
  if (t % STEP !== 0 && t !== TICKS) continue;
  const n = [0, 0, 0];
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const g = w.roleOf(sl).trophic;
    if (g >= 0 && g < TROPHIC_COUNT) n[g]++;
  }
  const [dd] = w.dormantCounts();
  // Total organic pools (detritus + sediment + litter): the corpse-subsidy
  // hypothesis lives or dies on whether this rises with disease deaths.
  // O(cells) once per checkpoint — negligible. Applies to future launches;
  // already-running processes loaded earlier code.
  let pools = 0;
  const pa = [w.detritus.data, w.sediment.data, w.litter.data];
  for (let pi = 0; pi < pa.length; pi++) {
    const arr = pa[pi];
    for (let i = 0; i < arr.length; i++) pools += arr[i];
  }
  console.log(
    `${String(t).padEnd(8)}${String(s.population).padEnd(6)}` +
    `${String(n[0]).padEnd(6)}${String(n[1]).padEnd(6)}${String(n[2]).padEnd(7)}| ` +
    `${String(dd).padEnd(9)}${w.senescenceDeaths} disD:${w.diseaseDeaths} pools:${Math.round(pools)} pioG:${w.pioneerGrants}`,
  );
}
const d = w.demographics();
const bd = (g: number): string => {
  const b = d.births[g].reduce((a: number, x: number) => a + x, 0);
  const dd2 = d.deaths[g].reduce((a: number, x: number) => a + x, 0);
  return `${b}/${dd2}=${dd2 > 0 ? (b / dd2).toFixed(2) : 'n/a'}`;
};
console.log(`B/D prod=${bd(0)} cons=${bd(1)} decomp=${bd(2)} senescenceDeaths=${w.senescenceDeaths} diseaseDeaths=${w.diseaseDeaths} diseaseMeals=${w.diseaseMeals} pioneerGrants=${w.pioneerGrants} pioGPG=${w.pioneerGrantsByGuild.join('/')} grazeSubmit=${w.submittedByKind[4]} grazeWins=${w.grazeWins} grazeEnergy=${Math.round(w.grazeEnergy)} grazeRequested=${Math.round(w.grazeRequested)}`);
// Direct conservation measurement.
//
// Population counts and birth/death ratios do NOT establish whether energy is
// conserved: a conservative system can grow while converting stored resources,
// and an energy-positive one can stabilise under density limits. This reports
// the accounting identity itself — inputs versus biomass + detritus +
// dissipation — so an energy-balance claim rests on a measurement instead of
// an inference from population shape.
const L = w.ledger;
const _biomass = L.biomass(w.store, (slot) => w.aliveAt(slot));
const _det = w.detritus.total();
const _dis = L.totalDissipated();
const _residual = w.accountingResidualFraction();
// BREAKDOWN, not just the total. A single totalInput figure makes a leak
// invisible: a system that mints energy and books it as input still balances,
// so residualPct reads 0 and the books look clean while energy appears from
// nowhere. Naming the components is what makes that visible. Per-guild capture
// is included because "no guild may capture" is a claim about guilds.
const _g = [0, 1, 2].map((i) => L.capturedByGuild[i].toFixed(1)).join('/');
console.log(`LEDGER totalInput=${L.totalInput().toFixed(1)} founding=${L.foundingBiomass.toFixed(1)} capture=${L.capture.toFixed(1)} organic=${L.injectOrganic.toFixed(1)} captureByGuild=${_g} biomass=${_biomass.toFixed(1)} detritus=${_det.toFixed(1)} dissipated=${_dis.toFixed(1)} accounted=${(_biomass + _det + _dis).toFixed(1)} residualPct=${(_residual * 100).toFixed(5)}`);

console.log(JSON.stringify({ seed: SEED, ticks: TICKS, setting: settingLabel }));
