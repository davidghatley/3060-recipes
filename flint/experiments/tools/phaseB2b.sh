#!/usr/bin/env bash
# Rerun of phaseB2's server part (it lacked -lv 4, so srv.sh's buffer grep failed and the runs exited at once).
set -uo pipefail
cd "$(dirname "$0")/.."
r() { local label=$1 tests=$2; shift 2; echo "== $(date +%T) $label"; TESTS="$tests" tools/srv.sh "$label" -- -lv 4 "$@" 2>&1 | grep --line-buffered -vE "^\s*$"; }
export FLINT_BIN=/mnt/scratch/src/llama.cpp-flint/build/bin FLINT_CUDA_LIB=/mnt/scratch/envs/ik-cuda/lib
r B2-srv-ctl "warmup||greedy"
GGML_SCHED_ASYNC=1 r B2-srv-async "warmup||greedy"
r B2-srv-ctl2 "||greedy"
unset FLINT_BIN FLINT_CUDA_LIB
export FLINT_MODEL=/mnt/scratch/models/flint-requant/Flint-Q4_K_M-ramexp-Q3_K.gguf
r E3-q3k-128k "warmup|--reps 3 --skip code --needles 60000,120000|greedy"
echo "== B2b done $(date +%T)"
