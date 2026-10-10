/**
 * Reproduction-gate probe — measures criterion 2 of case 9b5ff0df:
 * "the fraction of gate-eligible consumer ticks lost to the stochastic breeding
 * roll (drive probability) rather than to ineligibility."
 *
 * WHY THIS EXISTS
 * In `World.proposeReproduction()` the stochastic roll is the last gate:
 *
 *     if (!this.rng.chance(Math.min(0.9, drive))) continue;
 *
 * An eligible organism that loses this roll leaves NO trace — no birth, no
 * event, no counter. That is precisely why this loss channel was never
 * measured, and why raising eligibility (the measured +49.9/+19.6/+32.6 point
 * effect of removing the fraction gate) did not produce recruitment in the
 * controlled sweep.
 *
 * DESIGN CONSTRAINTS
 * - Strictly observational. The probe is handed already-computed values and is
 *   called only at points where the engine has already decided. It MUST NOT
 *   consume RNG, allocate per-tick state, or influence any branch.
 * - Null when disabled, mirroring `World.traceLog`, so the unprobed hot path
 *   pays one predictable null check and allocates nothing.
 * - Deliberately kept out of `trace.ts` so the proven event-log module is
 *   untouched by this diagnostic.
 *
 * Non-perturbation is verified the same way tracing was: the gates suite
 * compares a state digest with instrumentation on versus off.
 */
/** Which deterministic gate blocked a reproductive proposal. */
export const REPRO_GATE = {
    /** Breeding cooldown still running. Checked before the energy gates. */
    cooldown: 0,
    /** energy/capacity < reproThreshold — the measured dominant blocker. */
    fraction: 1,
    /** age < maturityAge. */
    maturity: 2,
    /** damage exceeded the breeding disqualification bar. */
    damage: 3,
    /** energy <= upkeep * REPRO_SURPLUS_TICKS (drought reserve). */
    surplus: 4,
    /** Deferred to the MATE interaction (sexual); not subject to this lottery. */
    sexual: 5,
};
export const REPRO_GATE_NAMES = [
    'cooldown',
    'fraction',
    'maturity',
    'damage',
    'surplus',
    'sexual',
];
export const REPRO_GATE_COUNT = REPRO_GATE_NAMES.length;
/** Fixed drive histogram: buckets over [0,1), plus one overflow bucket. */
const DRIVE_BUCKETS = 64;
function newGuildStats() {
    return {
        blocked: new Array(REPRO_GATE_COUNT).fill(0),
        reachedRoll: 0,
        eligiblePositive: 0,
        fired: 0,
        driveSum: 0,
        drivePositiveSum: 0,
        driveMax: 0,
        driveHist: new Int32Array(DRIVE_BUCKETS + 1),
        marginHist: new Int32Array(DRIVE_BUCKETS + 1),
        marginSum: 0,
        marginN: 0,
        traitTermSum: 0,
        nonPositiveDrive: 0,
        asexualSum: 0,
        mateSum: 0,
        traitN: 0,
        asexualZeroTicks: 0,
    };
}
/** Accumulating implementation. Not engine-internal: reads only its own args. */
export class ReproProbeLog {
    guilds;
    constructor(guildCount) {
        this.guilds = Array.from({ length: guildCount }, newGuildStats);
    }
    stats(guild) {
        return guild >= 0 && guild < this.guilds.length ? this.guilds[guild] : undefined;
    }
    blocked(_slot, guild, gate) {
        const s = this.stats(guild);
        if (s && gate >= 0 && gate < REPRO_GATE_COUNT)
            s.blocked[gate]++;
    }
    reachedRoll(_slot, guild, drive, margin, asexualRate, mateSeeking) {
        const s = this.stats(guild);
        if (!s)
            return;
        s.reachedRoll++;
        if (drive > 0) {
            s.eligiblePositive++;
            s.drivePositiveSum += drive;
        }
        else {
            s.nonPositiveDrive++;
        }
        s.driveSum += drive;
        if (drive > s.driveMax)
            s.driveMax = drive;
        const b = Math.min(DRIVE_BUCKETS, Math.max(0, Math.floor(drive * DRIVE_BUCKETS)));
        s.driveHist[b]++;
        if (margin !== undefined && Number.isFinite(margin)) {
            s.marginSum += margin;
            s.marginN++;
            const mb = Math.min(DRIVE_BUCKETS, Math.max(0, Math.floor(margin * DRIVE_BUCKETS)));
            s.marginHist[mb]++;
            // Invert the gain term to isolate the heritable trait factor:
            //   drive = A*(1-0.55*M)*2.4 * (m+0.25) * (1+10m)
            const gain = (margin + 0.25) * (1 + 10 * margin);
            if (gain > 0)
                s.traitTermSum += drive / gain;
        }
        if (asexualRate !== undefined && mateSeeking !== undefined) {
            s.traitN++;
            s.asexualSum += asexualRate;
            s.mateSum += mateSeeking;
            if (asexualRate <= 1e-6)
                s.asexualZeroTicks++;
        }
    }
    fired(_slot, guild) {
        const s = this.stats(guild);
        if (s)
            s.fired++;
    }
    /** Snapshot one guild's tallies, safe to read after the run. */
    read(guild) {
        const s = this.stats(guild);
        if (!s)
            return null;
        const lost = Math.max(0, s.eligiblePositive - s.fired);
        return {
            blocked: s.blocked,
            reachedRoll: s.reachedRoll,
            eligiblePositive: s.eligiblePositive,
            fired: s.fired,
            driveMean: s.reachedRoll ? s.driveSum / s.reachedRoll : 0,
            driveMeanPositive: s.eligiblePositive ? s.drivePositiveSum / s.eligiblePositive : 0,
            expectedBirths: s.drivePositiveSum,
            driveMax: s.driveMax,
            drivePercentile: (p) => this.percentile(s.driveHist, p),
            lostToRoll: lost,
            lostToRollPct: s.eligiblePositive ? (lost / s.eligiblePositive) * 100 : 0,
            marginN: s.marginN,
            marginMean: s.marginN ? s.marginSum / s.marginN : 0,
            traitTermMean: s.marginN ? s.traitTermSum / s.marginN : 0,
            nonPositiveDrive: s.nonPositiveDrive,
            nearZeroMarginPct: s.marginN ? (s.marginHist[0] / s.marginN) * 100 : 0,
            marginPercentile: (p) => this.percentile(s.marginHist, p),
            asexualMean: s.traitN ? s.asexualSum / s.traitN : 0,
            mateMean: s.traitN ? s.mateSum / s.traitN : 0,
            asexualZeroPct: s.traitN ? (s.asexualZeroTicks / s.traitN) * 100 : 0,
        };
    }
    percentile(hist, p) {
        let total = 0;
        for (let i = 0; i < hist.length; i++)
            total += hist[i];
        if (!total)
            return 0;
        const target = total * p;
        let seen = 0;
        for (let i = 0; i < hist.length; i++) {
            seen += hist[i];
            if (seen >= target)
                return i / DRIVE_BUCKETS;
        }
        return 1;
    }
}
