#!/usr/bin/env bash
# llama-bench on the maxwell build (inside tools/batch.sh: the lock is already held).  tools/lbench.sh <label> [llama-bench args...]
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
label=${1:?label}; shift
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
BIN=${MX_BIN:-/mnt/scratch/llama.cpp/maxwell-4f969ad24/bin}
mkdir -p "$R/runs/bench"
echo "== $label $(date +%T) load $(cut -d' ' -f1-3 /proc/loadavg) args: $*" | tee "$R/runs/bench/$label.log"
"$BIN/llama-bench" -m "${MX_MODEL:-/mnt/models/llm/maxwell-v1-flash/Maxwell-V1-Flash-AD-Q4_K-IQ4_XS.gguf}" -fa on "$@" -o md 2>>"$R/runs/bench/$label.err" | tee -a "$R/runs/bench/$label.log"
echo "== end $(date +%T) load $(cut -d' ' -f1-3 /proc/loadavg)" | tee -a "$R/runs/bench/$label.log"
