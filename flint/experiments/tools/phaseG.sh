#!/usr/bin/env bash
# Phase G (2026-11-21): squeeze the 128k cache profile, and test -ub 8192 for prefill at 64k / 32k.
# Same harness as exp 5: serve.sh unchanged via tools/srv.sh, FLINT_SPEC=none, -lv 4 for cache stats.
cd "$(dirname "$0")/.."
run() { echo "== $(date +%T) $1"; tools/srv.sh "$@"; local r=$?; [ $r = 0 ] || echo "!! $1 failed (exit $r)"; return $r; }

# G1: 128k cache size / cpu-share, controls on both sides. Decode only (prose), plus warm-up windows.
export TESTS="warmup|--reps 3 --skip cold11k,code|" FLINT_CONTEXT=131072 FLINT_CPU_MOE=49
run G-128k-c2944-ctl1 -- -lv 4 --moe-cache-mib 2944 --moe-cache-cpu-share 0.95
run G-128k-c3200      -- -lv 4 --moe-cache-mib 3200 --moe-cache-cpu-share 0.95
run G-128k-c3328      -- -lv 4 --moe-cache-mib 3328 --moe-cache-cpu-share 0.95
run G-128k-c2944-s090 -- -lv 4 --moe-cache-mib 2944 --moe-cache-cpu-share 0.90
run G-128k-c2944-ctl2 -- -lv 4 --moe-cache-mib 2944 --moe-cache-cpu-share 0.95

# G2: -ub 8192 at 64k and 32k. Prefill on the cold 11k opencode prompt plus prose decode.
export TESTS="warmup|--reps 3 --skip code|"
export FLINT_CONTEXT=65536
FLINT_UBATCH=4096 run G-64k-ub4096-c5248-ctl -- -lv 4 --moe-cache-mib 5248 --moe-cache-cpu-share 0.95
for c in 3200 2688 2176; do
  FLINT_UBATCH=8192 run G-64k-ub8192-c$c -- -lv 4 --moe-cache-mib $c --moe-cache-cpu-share 0.95 && break
done
export FLINT_CONTEXT=32768
FLINT_UBATCH=4096 run G-32k-ub4096-c6144-ctl -- -lv 4 --moe-cache-mib 6144 --moe-cache-cpu-share 0.95
for c in 4096 3584 3072; do
  FLINT_UBATCH=8192 run G-32k-ub8192-c$c -- -lv 4 --moe-cache-mib $c --moe-cache-cpu-share 0.95 && break
done
echo "== G done $(date +%T)"
