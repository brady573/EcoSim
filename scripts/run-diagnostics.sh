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
# Usage: sh scripts/run-diagnostics.sh <kit.mjs> <outroot> <legs> <seeds> <ticks> <interval> <mode> <suite> [target]
set -eu
KIT="$1"; OUTROOT="$2"; LEGS="$3"; SEEDS="$4"; TICKS="$5"; INTERVAL="$6"; MODE="$7"; SUITE="$8"; TARGET="${9:-}"

mkdir -p "$OUTROOT"

# Split the comma/space separated seed list into $LEGS chunk files.
i=0
: > "$OUTROOT/.seeds.$$"
printf '%s' "$SEEDS" | tr ',' ' ' | tr -s ' ' '\n' | grep -v '^$' > "$OUTROOT/.seeds.$$"
TOTAL=$(wc -l < "$OUTROOT/.seeds.$$")
PER=$(( (TOTAL + LEGS - 1) / LEGS ))

pids=""
leg=0
start=1
while [ "$leg" -lt "$LEGS" ]; do
  end=$(( start + PER - 1 ))
  [ "$end" -gt "$TOTAL" ] && end=$TOTAL
  if [ "$start" -le "$TOTAL" ]; then
    CHUNK=$(sed -n "${start},${end}p" "$OUTROOT/.seeds.$$" | paste -sd, -)
    OUT="$OUTROOT/leg$leg"
    mkdir -p "$OUT"
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
rm -f "$OUTROOT/.seeds.$$"
[ "$status" -eq 0 ] || { echo "one or more legs failed; see leg logs" >&2; exit 1; }
echo "all legs complete -> $OUTROOT"
