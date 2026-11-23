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
# Profiles (experiments/RESULTS.md, exp 5): all experts in RAM plus a VRAM cache of the hot ones.
#   128k (default): 2944 MiB cache, ~59 tok/s.  64k: 5248 MiB cache, ~63 tok/s.  nocache: the first tuned profile, -ncmoe 43, ~52 tok/s.
case "${FLINT_PROFILE:-128k}" in
  128k)    d_ctx=131072; d_cpu_moe=49; d_cache=2944; d_spec=ngram-map-k ;;
  64k)     d_ctx=65536;  d_cpu_moe=49; d_cache=5248; d_spec=none ;;
  nocache) d_ctx=131072; d_cpu_moe=43; d_cache=0;    d_spec=ngram-map-k ;;
  *) echo "FLINT_PROFILE must be 128k, 64k or nocache" >&2; exit 2 ;;
esac
CACHE=${FLINT_MOE_CACHE_MIB:-$d_cache}
CACHE_ARGS=()
[ "$CACHE" != 0 ] && CACHE_ARGS=(--moe-cache-mib "$CACHE" --moe-cache-cpu-share "${FLINT_MOE_CACHE_SHARE:-0.95}")
exec "$HOME/anime-pipeline/tools/gpu_run" --need 10500 --wait "${FLINT_GPU_WAIT:-120}" \
  "$BIN/llama-server" -m "$MODEL" --alias flint-local \
  -ngl 99 -ncmoe "${FLINT_CPU_MOE:-$d_cpu_moe}" "${CACHE_ARGS[@]}" --fit off --spec-type "${FLINT_SPEC:-$d_spec}" \
  -c "${FLINT_CONTEXT:-$d_ctx}" -np 1 -t "${FLINT_THREADS:-6}" \
  -b "$UB" -ub "$UB" --load-mode "${FLINT_LOAD_MODE:-none}" \
  -fa on -ctk "$KV" -ctv "$KV" --jinja --reasoning-format deepseek \
  --temp 1.0 --top-p 0.95 --top-k 20 \
  --host 127.0.0.1 --port "${FLINT_PORT:-8081}" "$@"
