#!/usr/bin/env bash
# One llama-bench run for Flint through the shared GPU queue, with PCIe/VRAM telemetry.
#   tools/bench.sh <name> [llama-bench args...]
# Writes runs/bench-<name>.jsonl (llama-bench results) and runs/bench-<name>-dmon.txt (nvidia-smi dmon).
# Common args (model, -ngl 99, -fa on, -t 6) are filled in; pass everything else.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
name=${1:?name}; shift
BIN=${FLINT_BIN:-/mnt/scratch/llama.cpp/b12242/bin/llama-b12242}
MODEL=${FLINT_MODEL:-/mnt/models/llm/flint/Flint-Q4_K_M.gguf}
CUDA_LIB=${FLINT_CUDA_LIB:-/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64}
export LD_LIBRARY_PATH="$BIN:$CUDA_LIB${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export GPU_RUN_MEM=${GPU_RUN_MEM:-44G}
out="$ROOT/runs/bench-$name"
nvidia-smi dmon -s mt -d 1 > "$out-dmon.txt" 2>&1 &
dmon=$!
trap 'kill $dmon 2>/dev/null || true' EXIT
"$HOME/anime-pipeline/tools/gpu_run" --need 10500 --wait 600 \
  "$BIN/llama-bench" -m "$MODEL" -ngl 99 -fa on -t 6 -o jsonl "$@" > "$out.jsonl" 2> "$out.err"
python3 -I "$ROOT/tools/summarize.py" "$out.jsonl"
