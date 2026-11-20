#!/usr/bin/env bash
# One promo capture session inside one gpu_run lock: start the server for <config>, capture the prompts, stop it.
#   promo/session.sh baseline|tuned lighthouse,windmill
# baseline = Q8_0 official, no speculation, the RESULTS.md baseline row (default ubatch).
# tuned    = serve.sh's defaults (Q5_K_M, no speculation, -ub 2048, f16 KV), on port 8084 instead of 8083.
# Sampling is set per request by capture.py (card sampling, seed 1), so it is identical for both.
set -uo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cfg=$1 slugs=$2
BIN=/mnt/scratch/llama.cpp/b12242/bin/llama-b12242
CUDA_LIB=/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64
D=/mnt/models/llm/qwen3.5-4b-3d-coder
case $cfg in
  baseline) ARGS=(-m $D/Qwen3.5-4B-3D-Coder-Q8_0.gguf -ngl 99 -fa on -c 65536 -np 1) ;;
  tuned) ARGS=(-m $D/own/Qwen3.5-4B-3D-Coder-MTP-Q5_K_M.gguf -ngl 99 -fa on -ctk f16 -ctv f16 -c 65536 -np 1
               -b 2048 -ub 2048 --spec-type none) ;;
  *) echo "unknown config $cfg"; exit 2 ;;
esac
inner() {
  export LD_LIBRARY_PATH="$BIN:$CUDA_LIB"
  "$BIN/llama-server" "${ARGS[@]}" --alias qwen35-3d-coder --jinja --reasoning-format deepseek \
    --host 127.0.0.1 --port 8084 > "$ROOT/promo/captures/server-$cfg-$(date +%H%M%S).log" 2>&1 < /dev/null &
  local pid=$!
  for _ in $(seq 300); do curl -sf http://127.0.0.1:8084/health >/dev/null && break; sleep 1; done
  echo "$cfg server $pid up $(date +%T) $(nvidia-smi --query-gpu=memory.used,temperature.gpu --format=csv,noheader)"
  local rc=0
  for sd in ${SEEDS:-1}; do  # SEEDS="2 3" captures extra seeds as <config>-s<seed>.json
    local nm=$cfg; [ "$sd" = 1 ] || nm=$cfg-s$sd
    python3 -I "$ROOT/promo/capture.py" --url http://127.0.0.1:8084 --config "$cfg" --seed "$sd" --name "$nm" --slugs "$slugs" || rc=$?
  done
  kill -INT $pid; for _ in $(seq 60); do kill -0 $pid 2>/dev/null || break; sleep 1; done
  echo "$cfg done rc=$rc $(date +%T)"
}
export -f inner; export ROOT cfg slugs BIN CUDA_LIB SEEDS="${SEEDS:-1}"
export ARGS_STR="${ARGS[*]}"
mkdir -p "$ROOT/promo/captures"
GPU_RUN_MEM=24G ~/anime-pipeline/tools/gpu_run --need 10000 --wait 14400 \
  bash -c 'ARGS=($ARGS_STR); inner'
