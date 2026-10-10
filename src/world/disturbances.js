/**
 * Dynamic abiotic axis and explicit environmental disturbances.
 *
 * Two related but distinct mechanisms:
 *
 *  1. The abiotic AXIS is the slow background forcing — light and temperature
 *     oscillating on a cycle, plus a long-period drift. It has no discrete
 *     onset and no discrete end; it is always acting.
 *
 *  2. DISTURBANCES are discrete, spatially localised, explicit events with a
 *     named cause and a bounded radius. They are the thing that makes an
 *     ecosystem interesting: a bloom that helps producers and a frost that
 *     culls them are different events, not a shared "random bad thing".
 *
 * Every disturbance is recorded with its type, tick, centre and magnitude, so
 * an observed population collapse can be lined up against forcing history
 * rather than guessed at.
 */
export const DISTURBANCE = {
    /** Nutrient upwelling: boosts producer capture over a region. */
    BLOOM: 0,
    /** Rain of organic material: adds detritus, feeds scavengers. */
    ORGANIC_RAIN: 1,
    /** Cold snap: drops the local temperature, raises metabolism cost. */
    FROST: 2,
    /** Dry spell: accelerates nutrient loss, no light gain. */
    DROUGHT: 3,
    /** Heat pulse: raises local temperature, speeds metabolism. */
    HEAT_WAVE: 4,
    /** Ash/contaminant: temporarily suppresses capture in a region. */
    ASH_FALL: 5,
};
export const DISTURBANCE_NAME = {
    0: 'bloom',
    1: 'organicRain',
    2: 'frost',
    3: 'drought',
    4: 'heatWave',
    5: 'ashFall',
};
export function emptyModifiers() {
    return { lightMul: 1, tempOffset: 0, nutrientMul: 1, detritusAdd: 0, captureMul: 1, metabolismMul: 1 };
}
/**
 * Tracks the slow abiotic axis and generates discrete disturbances.
 */
export class AbioticDriver {
    cycleTicks;
    interval;
    chance;
    /** Current phase of the light/temperature cycle, 0..1. */
    phase = 0;
    /** Long-period drift multiplier, slowly wandering. */
    drift = 1;
    driftPhase = 0;
    /** Active disturbances with their remaining duration in ticks. */
    active = [];
    /** Lifetime of a disturbance, ticks. */
    lifetime;
    decay;
    /** Full history, for lining population history up against forcing. */
    history = [];
    constructor(cycleTicks, interval, chance) {
        this.cycleTicks = cycleTicks;
        this.interval = interval;
        this.chance = chance;
        this.lifetime = new Float64Array(6).fill(1);
        this.lifetime[DISTURBANCE.BLOOM] = 140;
        this.lifetime[DISTURBANCE.ORGANIC_RAIN] = 70;
        this.lifetime[DISTURBANCE.FROST] = 190;
        this.lifetime[DISTURBANCE.DROUGHT] = 320;
        this.lifetime[DISTURBANCE.HEAT_WAVE] = 240;
        this.lifetime[DISTURBANCE.ASH_FALL] = 150;
        // Ash lingers longest without capture.
        this.decay = new Float64Array(6).fill(1);
        this.decay[DISTURBANCE.ASH_FALL] = 0.6;
        this.decay[DISTURBANCE.FROST] = 0.85;
    }
    /** Advance the abiotic axis. Returns the global light multiplier. */
    stepAxis(tick, baseLight, lightAmp) {
        this.phase = (tick / Math.max(1, this.cycleTicks)) % 1;
        // Smooth 0..1..0 triangle via cosine, so the axis has no derivative
        // discontinuity that would look like an artificial pulse.
        const s = 0.5 - 0.5 * Math.cos(this.phase * 2 * Math.PI);
        // Slow drift on a much longer period, wandering around 1.
        this.driftPhase = (tick / (this.cycleTicks * 9)) % 1;
        const d = 0.5 - 0.5 * Math.cos(this.driftPhase * 2 * Math.PI);
        this.drift = 0.72 + 0.56 * d;
        const light = Math.max(0.02, Math.min(1.4, (baseLight + lightAmp * (s - 0.5) * 2) * this.drift));
        const temp = 18 + (s - 0.5) * 18 * this.drift;
        return { light, temp };
    }
    /** Base temperature from the axis; world adds its own config offsets. */
    baseTemperature(baseTemp, tempAmp) {
        return baseTemp + (this.phase - 0.5) * 2 * tempAmp * this.drift;
    }
    /** Roll for a new disturbance. Explicit, bounded, recorded. */
    maybeDisturb(tick, worldW, worldH, rng) {
        if (tick % this.interval !== 0)
            return;
        if (!rng.chance(this.chance))
            return;
        const kind = rng.int(6);
        const radius = 260 + rng.nextFloat() * 900;
        const x = rng.nextFloat() * worldW;
        const y = rng.nextFloat() * worldH;
        const magnitude = 0.45 + rng.nextFloat() * 0.85;
        const ev = {
            tick,
            kind,
            name: DISTURBANCE_NAME[kind],
            x,
            y,
            radius,
            magnitude,
            remaining: this.lifetime[kind],
        };
        this.active.push(ev);
        this.history.push(ev);
    }
    /**
     * Local modifiers at a point, from all active disturbances.
     * Writes into `out` to avoid per-organism allocation in the hot loop.
     */
    modifiersAt(x, y, out) {
        out.lightMul = 1;
        out.tempOffset = 0;
        out.nutrientMul = 1;
        out.detritusAdd = 0;
        out.captureMul = 1;
        out.metabolismMul = 1;
        if (this.active.length === 0)
            return out;
        for (let i = 0; i < this.active.length; i++) {
            const d = this.active[i];
            const dx = x - d.x;
            const dy = y - d.y;
            const distSq = dx * dx + dy * dy;
            const rSq = d.radius * d.radius;
            if (distSq > rSq)
                continue;
            // Radial falloff, squared for a soft shoulder.
            const t = 1 - Math.sqrt(distSq) / d.radius;
            const w = t * t * d.magnitude;
            switch (d.kind) {
                case DISTURBANCE.BLOOM:
                    out.nutrientMul += w * 1.6;
                    out.lightMul += w * 0.22;
                    out.captureMul += w * 0.7;
                    break;
                case DISTURBANCE.ORGANIC_RAIN:
                    out.detritusAdd += w * 22;
                    break;
                case DISTURBANCE.FROST:
                    out.tempOffset -= w * 13;
                    out.metabolismMul += w * 0.62;
                    out.captureMul -= w * 0.3;
                    break;
                case DISTURBANCE.DROUGHT:
                    out.lightMul -= w * 0.34;
                    out.nutrientMul -= w * 0.3;
                    out.metabolismMul += w * 0.18;
                    break;
                case DISTURBANCE.HEAT_WAVE:
                    out.tempOffset += w * 15;
                    out.metabolismMul += w * 0.45;
                    out.nutrientMul -= w * 0.22;
                    break;
                case DISTURBANCE.ASH_FALL:
                    out.captureMul -= w * 0.85;
                    out.lightMul -= w * 0.18;
                    out.detritusAdd += w * 6;
                    break;
                default:
                    break;
            }
        }
        if (out.captureMul < 0)
            out.captureMul = 0;
        if (out.lightMul < 0.05)
            out.lightMul = 0.05;
        if (out.metabolismMul < 0.4)
            out.metabolismMul = 0.4;
        return out;
    }
    /**
     * Age active disturbances by one tick. Each kind has its own lifetime and
     * per-tick magnitude decay, so an ash fall lingers as a suppressive
     * background while a frost fades out comparatively fast.
     */
    age() {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const d = this.active[i];
            d.remaining--;
            const decayed = this.decay[d.kind];
            // Below 1 the event fades rather than cutting out abruptly, so there is
            // no artificial step change in the environment at the expiry tick.
            d.magnitude *= decayed < 1 ? 0.988 : 0.9992;
            if (d.remaining <= 0 || d.magnitude < 0.03) {
                this.active.splice(i, 1);
            }
        }
    }
    get activeCount() {
        return this.active.length;
    }
    activeEvents() {
        return this.active;
    }
}
