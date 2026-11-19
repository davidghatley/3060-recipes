#!/usr/bin/env bash
# Server sweep for experiments 5 (MoE cache) and 1 (context profiles). Stock b12242 via flint/serve.sh, spec off, -lv 4.
# Full = warm-up probe (cold cache) | servertest cold11k + prose x4 | greedy + 32k-depth probe.
set -uo pipefail
cd "$(dirname "$0")/.."
FULL="warmup|--reps 4 --skip code|greedy,depth"
QUICK="warmup||greedy"
r() { local label=$1 ctx=$2 ncmoe=$3 tests=$4; shift 4; echo "== $(date +%T) $label"
      FLINT_CONTEXT=$ctx FLINT_CPU_MOE=$ncmoe TESTS="$tests" tools/srv.sh "$label" -- -lv 4 "$@" 2>&1 | grep -vE "^\s*$"; }
case "${1:-a}" in
a)
r E-128k-n43-ctl      131072 43 "$FULL"
r E-128k-all-c2944-95 131072 49 "$FULL"  --moe-cache-mib 2944 --moe-cache-cpu-share 0.95
r E-128k-all-c2944-100 131072 49 "$QUICK" --moe-cache-mib 2944 --moe-cache-cpu-share 1.0
r E-128k-all-c2944-80 131072 49 "$QUICK" --moe-cache-mib 2944 --moe-cache-cpu-share 0.8
r E-128k-all-c1984-95 131072 49 "$QUICK" --moe-cache-mib 1984 --moe-cache-cpu-share 0.95
r E-128k-all-c1024-95 131072 49 "$QUICK" --moe-cache-mib 1024 --moe-cache-cpu-share 0.95
r E-128k-n43-c512-95  131072 43 "$QUICK" --moe-cache-mib 512 --moe-cache-cpu-share 0.95
r E-128k-all-nocache  131072 49 "$QUICK"
r E-128k-n43-ctl2     131072 43 "$QUICK"
;;
b)
r E-64k-all-c5248-95  65536 49 "$FULL"  --moe-cache-mib 5248 --moe-cache-cpu-share 0.95
r E-64k-all-c5248-100 65536 49 "$QUICK" --moe-cache-mib 5248 --moe-cache-cpu-share 1.0
r E-64k-n43-c2688-95  65536 43 "$QUICK" --moe-cache-mib 2688 --moe-cache-cpu-share 0.95
r E-64k-n39-ctl       65536 39 "$FULL"
r E-96k-all-c4096-95  98304 49 "$QUICK" --moe-cache-mib 4096 --moe-cache-cpu-share 0.95
r E-96k-n41-ctl       98304 41 "$QUICK"
r E-128k-n43-ctl3     131072 43 "$QUICK"
;;
esac
echo "== sweep done $(date +%T)"
