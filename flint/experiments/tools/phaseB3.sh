#!/usr/bin/env bash
# Phase B3: [FLINT-ASYNC] combined with the MoE cache (best 64k config), ABA; and exp 1 near-full check at -ncmoe 37.
set -uo pipefail
cd "$(dirname "$0")/.."
r() { local label=$1 ctx=$2 ncmoe=$3 tests=$4; shift 4; echo "== $(date +%T) $label"
      FLINT_CONTEXT=$ctx FLINT_CPU_MOE=$ncmoe TESTS="$tests" tools/srv.sh "$label" -- -lv 4 "$@" 2>&1 | grep --line-buffered -vE "^\s*$"; }
C="--moe-cache-mib 5248 --moe-cache-cpu-share 0.95"
export FLINT_BIN=/mnt/scratch/src/llama.cpp-flint/build/bin FLINT_CUDA_LIB=/mnt/scratch/envs/ik-cuda/lib
r B3-c5248-ctl1  65536 49 "warmup|--reps 3 --skip cold11k,code|greedy" $C
GGML_SCHED_ASYNC=1 r B3-c5248-async 65536 49 "warmup|--reps 3 --skip cold11k,code|greedy" $C
r B3-c5248-ctl2  65536 49 "warmup|--reps 3 --skip cold11k,code|greedy" $C
GGML_SCHED_ASYNC=1 r B3-n43-128k-async 131072 43 "warmup|--reps 3 --skip code|greedy,depth"
unset FLINT_BIN FLINT_CUDA_LIB
r E-64k-n37-ndl 65536 37 "|--skip cold11k,prose,code --needles 30000,62000|"
echo "== B3 done $(date +%T)"
