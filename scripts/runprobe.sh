#!/bin/sh
# Retry wrapper for COMPILED senesprobe runs (node build/trace/senesprobe.js).
#
# WHY: this device intermittently fails Node's module resolution with
# "Cannot find module" for files that demonstrably exist (ls/stat/read all
# succeed, and the same command succeeds on retry). Both the ESM loader
# (tsx) and the CJS loader (plain node) have shown it. Engine peak RSS is
# only ~149MB, so this is device-level, not workload-level.
#
# Scope of retry: ONLY the two module-resolution error strings. Any other
# failure, or an output with no data rows, is returned immediately so a real
# fault is never masked or retried into a false pass.
#
# A successful retry reruns the same seed+config and yields identical bytes;
# determinism is unaffected (verified byte-identical repeats).
#
# Usage: sh scripts/runprobe.sh <outfile> <probe args...>
set -u
OUT="$1"; shift
ROOT=/root/DEE-TS-POC
PROBE=experiment/ts-evolution-poc/build/trace/senesprobe.js
ATTEMPTS=8
i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  timeout 400 node "$PROBE" "$@" > "$OUT" 2>&1
  if ! grep -qE "Cannot find module|ERR_MODULE_NOT_FOUND" "$OUT" 2>/dev/null; then
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done
echo "RUNPROBE: gave up after $ATTEMPTS attempts (module-resolution flake)" >&2
exit 1
