#!/usr/bin/env bash
# Qwen3.5-4B-3D-Coder on llama-server, tuned for single-user decode on the RTX 3060. Evidence: PLAN.md, RESULTS.md.
# Weights: our Q5_K_M with the MTP head restored (tools/download.sh + tools/build_quants.sh).
# Q4_K_M is faster but its pages throw errors twice as often in the render eval (RESULTS.md).
# Speculation is off by default: MTP is 31% faster but breaks long answers on this llama.cpp build (RESULTS.md,
# "MTP breaks long answers"). Opt in with QC_SPEC=draft-mtp.
set -euo pipefail
BIN=${QC_BIN:-/mnt/scratch/llama.cpp/b12242/bin/llama-b12242}
MODEL=${QC_MODEL:-/mnt/models/llm/qwen3.5-4b-3d-coder/own/Qwen3.5-4B-3D-Coder-MTP-Q5_K_M.gguf}
CUDA_LIB=${QC_CUDA_LIB:-/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64}
export LD_LIBRARY_PATH="$BIN:$CUDA_LIB${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export GPU_RUN_MEM=${GPU_RUN_MEM:-24G}
UB=${QC_UBATCH:-2048}
exec "$HOME/anime-pipeline/tools/gpu_run" --need 7000 --wait 120 \
  "$BIN/llama-server" -m "$MODEL" --alias qwen35-3d-coder \
  -ngl 99 -fa on -ctk f16 -ctv f16 -c "${QC_CONTEXT:-65536}" -np 1 -b "$UB" -ub "$UB" \
  --spec-type "${QC_SPEC:-none}" --spec-draft-n-max "${QC_DRAFT_MAX:-2}" --spec-draft-p-min "${QC_DRAFT_PMIN:-0}" \
  --jinja --reasoning-format deepseek \
  --temp 0.6 --top-p 0.95 --top-k 20 --repeat-penalty 1.0 \
  --host 127.0.0.1 --port "${QC_PORT:-8083}" "$@"
