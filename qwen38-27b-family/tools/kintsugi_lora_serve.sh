#!/usr/bin/env bash
# Stretch test: the Kintsugi bundle's own llama-server (author's fork, v1.1.1, unmodified, read-only) on its EXL3
# GGUF, plain (no layer, no drafter), optionally with our GGUF conversion of harness-hub's pi LoRA (KL_LORA=path).
# Port 8101. Run inside tools/gpu_batch.sh (no gpu_run of its own).
set -euo pipefail
K=/mnt/models/llm/kintsugi-27b; B=$K/bundle/Kintsugi-27B/bin
export LD_LIBRARY_PATH="$B" GGML_ESCHA_PREFILL=i8 GGML_ESCHA_I8_MIN_ROWS=256 GGML_CUDA_BATCH_INVARIANT=1
LORA=(); [ -n "${KL_LORA:-}" ] && LORA=(--lora "$KL_LORA")
exec prlimit --core=0 "$B/llama-server" -m "$K/Kintsugi-27B-12G.gguf" "${LORA[@]}" -ngl 99 -c "${KL_CTX:-16384}" -fa on -np 1 \
  -ub 512 --fit off --jinja -ctk q4_0 -ctv q4_0 --chat-template-kwargs '{"enable_thinking":false}' \
  --host 127.0.0.1 --port "${PORT:-8101}" ${KL_EXTRA:-}
