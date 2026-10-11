#!/bin/sh
# Run the diagnostic screen with the seed panel split across N parallel legs.
#
# WHY: the screen's cost is (targets x seeds). Targets are fixed per suite, so
# seeds are the only axis that shards cleanly. Each leg writes its OWN output
# directory and its own manifest; outputs are deliberately NOT merged. Merging
# hand-written CSVs to fake a single result file is exactly the kind of
# evidence-shaped fabrication this repository's rules forbid. Per-leg results
# are uploaded separately and each manifest states the seeds it covered.
#
# WHY THE SHARDING MOVED OUT OF SHELL: this script used to split the panel
# itself, on comma and space. The diagnostic kit's parser also understands
# "lo:hi", so `1:10` was a perfectly valid panel that this planner counted as
# ONE token. It started one leg, handed that leg the entire range, and reported
# success — four requested shards silently became one. Two parsers reading the
# same string is how the two halves of a shard plan come to disagree about what
# was requested, so the expansion now happens once, in one validated place
# (tools/diagnostics/plan-seeds.mjs), and this script consumes an already-
# expanded panel.
#
# Every argument below is quoted and is treated as DATA. No value is ever
# concatenated into a command line or interpreted as shell syntax.
#
# Usage: sh scripts/run-diagnostics.sh <kit.mjs> <outroot> <legs> <seeds> <ticks> <interval> <mode> <suite> [target]
set -eu
KIT="$1"; OUTROOT="$2"; LEGS="$3"; SEEDS="$4"; TICKS="$5"; INTERVAL="$6"; MODE="$7"; SUITE="$8"; TARGET="${9:-}"

mkdir -p "$OUTROOT"

# Expand and validate the panel with the SAME planner CI tests, so a range like
# 1:10 is understood identically here and in the kit. One line of N seeds.
PANEL=$(node tools/diagnostics/plan-seeds.mjs panel "$SEEDS" "$LEGS")
TOTAL=$(printf '%s' "$PANEL" | tr ',' '\n' | grep -c .)

# Cap legs at the seed count: a leg with no seeds to run is a job that reports
# success while measuring nothing.
[ "$LEGS" -gt "$TOTAL" ] && LEGS="$TOTAL"
PER=$(( (TOTAL + LEGS - 1) / LEGS ))

pids=""
leg=0
start=1
while [ "$leg" -lt "$LEGS" ]; do
  end=$(( start + PER - 1 ))
  [ "$end" -gt "$TOTAL" ] && end=$TOTAL
  if [ "$start" -le "$TOTAL" ]; then
    CHUNK=$(printf '%s' "$PANEL" | cut -d, -f"$start-$end")
    OUT="$OUTROOT/leg$leg"
    mkdir -p "$OUT"
    # The leg's exact assigned seeds are recorded beside its own output, so the
    # manifest states which part of the panel this leg actually covered.
    printf '%s\n' "$CHUNK" > "$OUT/.assigned-seeds"
    case "$SUITE" in
      factorial-core)
        set -- --mode "$MODE" --factorial-core --seeds "$CHUNK" --ticks "$TICKS" --interval "$INTERVAL" --out "$OUT"
        ;;
      target)
        set -- --mode "$MODE" --target "$TARGET" --seeds "$CHUNK" --ticks "$TICKS" --interval "$INTERVAL" --out "$OUT"
        ;;
      *)
        set -- --mode "$MODE" --all --config-only --seeds "$CHUNK" --ticks "$TICKS" --interval "$INTERVAL" --out "$OUT"
        ;;
    esac
    echo "leg $leg: seeds=$CHUNK -> $OUT"
    node "$KIT" "$@" > "$OUT/leg.log" 2>&1 &
    pids="$pids $!"
  fi
  leg=$(( leg + 1 ))
  start=$(( end + 1 ))
done

status=0
for p in $pids; do
  wait "$p" || status=1
done
[ "$status" -eq 0 ] || { echo "one or more legs failed; see leg logs" >&2; exit 1; }
echo "all legs complete -> $OUTROOT"