# Authoritative state digest repair

Same isolated fix/post-feeding-starvation branch, based on main06be7da plus
the two previously requested current-energy fixes. Hashing changes do NOT
change biological arithmetic/config/defaults or re-pin population values.
Hash-contract successor engine0.6.13 retains0.6.12 biology/pins; digest identity is explicitly
`world-state/2:<eight hexadecimal digits>`. Old unversioned strings are
historical format1; never compare the two as if they were the same format.

## Scope

Tick-boundary state, not a resumable mid-phase checkpoint. Added fatigue,
active module instructions/count, pioneerTicks/Void, Float64 mineralisedCell,
live-slot markers, dormancy, cached physical traits/role/geometry/capacity,
procedural seeds, damage attribution, allocation free-stack order, active
abiotic forcing, habitat shade/drainage, lineage identity and pending births.
Resolved biological config is canonicalized by sorted keys and double-precision
numbers, excluding diagnostic label. Nested options are included. The live
stable-ID lookup is included; stale dead-ID entries self-validate as inert.
Double state is mixed at Float64 precision; no Float32 downcast of cyclic flux.

Allocation ordering matters even if live-slot contents agree. Cached expressed
state matters because refresh is staggered rather than immediate. Active
disturbance contents matter even when history lengths agree. Hashing merely
read fields has no RNG/biology writes.

Exclusions: grid/sensing/contest/intent work buffers, shadeMass and patchCensus
are rebuilt before their next tick's biological reads. cyclicFluxLastTick is
reset before accumulating a diagnostic maximum; it is NOT the causal lag
buffer (mineralisedCell is). Timing/profiling, trace events, observer counters
and historical measurement books do not feed biology. Vacant slot genome
payloads are overwritten on allocation; free-stack contents/order are included.
This is a32-bit change detector with collision risk, NOT mathematical proof
of state equality, cryptographic certification or a persistence serialization.

## Checks actually executed

G40:27 single-authority perturbation checks, requiring both changed digest and
exact restoration, including sub-Float32 Float64 differences. Profiling-only
mutations leave the digest unchanged. Existing G38/G39 remain green.
Typecheck clean,46/46 compiled gates,11/11 contracts (fresh app/CLI agreement,
same biological pins and byte-identical repeats),154/154 workflow fixtures.
Explicit150tick paired worlds checked at EVERY tick with repeated hash reads:
defaults world-state/2:a45e774e; modular+cyclic+pioneer world-state/2:0145ce11.
No drift between twins; no read-induced divergence.

Historical false-equality script: `node scripts/hash-negative-checks.mjs`
extracts and executes the actual hash method from main06be7da, not a fabricated
replacement. The five reported omitted fields falsely alias under the old
method and are detected/restored by the new method. G40 additionally covers
other audited authority. Independent review plus focused follow-up found no
material remaining concerns. Follow-up confirmed local-modifier/grid reset
semantics, added persistent live-ID lookup and removed diagnostic history
length/redundant scalar hashing. The affected checks and fresh bundle contracts
were rerun after those corrections. This intermediate record predates PR
delivery; current delivery status is on the PR.
