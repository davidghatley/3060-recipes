#!/usr/bin/env bash
# Flint Q4_K_M on llama-server. Defaults are the tuned config; see PLAN.md and RESULTS.md for the evidence.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BIN=${FLINT_BIN:-/mnt/scratch/llama.cpp/b12242/bin/llama-b12242}
MODEL=${FLINT_MODEL:-/mnt/models/llm/flint/Flint-Q4_K_M.gguf}
CUDA_LIB=${FLINT_CUDA_LIB:-/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64}
export LD_LIBRARY_PATH="$BIN:$CUDA_LIB${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export GPU_RUN_MEM=${GPU_RUN_MEM:-44G}
KV=${FLINT_KV:-f16}
UB=${FLINT_UBATCH:-4096}
exec "$HOME/anime-pipeline/tools/gpu_run" --need 10500 --wait 120 \
  "$BIN/llama-server" -m "$MODEL" --alias flint-local \
  -ngl 99 -ncmoe "${FLINT_CPU_MOE:-43}" --fit off --spec-type "${FLINT_SPEC:-ngram-map-k}" \
  -c "${FLINT_CONTEXT:-131072}" -np 1 -t "${FLINT_THREADS:-6}" \
  -b "$UB" -ub "$UB" --load-mode "${FLINT_LOAD_MODE:-none}" \
  -fa on -ctk "$KV" -ctv "$KV" --jinja --reasoning-format deepseek \
  --temp 1.0 --top-p 0.95 --top-k 20 \
  --host 127.0.0.1 --port "${FLINT_PORT:-8081}" "$@"
