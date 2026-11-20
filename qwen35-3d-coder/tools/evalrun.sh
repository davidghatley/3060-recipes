#!/usr/bin/env bash
# Quality eval: generate scenes for the fixed prompt subset with one model, then render them headless on the CPU.
#   tools/evalrun.sh <name> <model.gguf> [gen.py args, e.g. --first 20]
# Generation runs inside ONE gpu_run session (llama-server, 4 slots x 32k, no speculation, card sampling).
# Re-running the same name resumes (finished items are skipped). Rendering + scoring run after the GPU is released.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
name=${1:?name}; model=${2:?model}; shift 2
out=$ROOT/runs/eval-$name; mkdir -p "$out"
BIN=${QC_BIN:-/mnt/scratch/llama.cpp/b12242/bin/llama-b12242}
CUDA_LIB=${QC_CUDA_LIB:-/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64}
PORT=${QC_PORT:-8082}
if [[ -z ${QC_INSIDE:-} ]]; then
  env QC_INSIDE=1 GPU_RUN_MEM=${GPU_RUN_MEM:-24G} "$HOME/anime-pipeline/tools/gpu_run" --need 10000 --wait 7200 "$0" "$name" "$model" "$@"
  (cd "$out" && node "$ROOT/tools/render.mjs" render $(ls scene-*.html 2>/dev/null) > render.log 2>&1) || true
  /mnt/scratch/envs/llama-convert-b12242/bin/python -I "$ROOT/tools/score.py" "$out"
  exit 0
fi
LD_LIBRARY_PATH="$BIN:$CUDA_LIB" setsid "$BIN/llama-server" -m "$model" -ngl 99 -fa on -c 131072 -np 4 \
  --jinja --reasoning-format deepseek --no-webui --host 127.0.0.1 --port "$PORT" >> "$out/server.log" 2>&1 < /dev/null &
srv=$!
trap 'kill -INT $srv 2>/dev/null; for _ in $(seq 60); do kill -0 $srv 2>/dev/null || break; sleep 1; done' EXIT
for _ in $(seq 300); do curl -sf "http://127.0.0.1:$PORT/health" >/dev/null && break; kill -0 $srv || exit 1; sleep 1; done
echo "eval $name ready $(date -Is) vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)" | tee -a "$out/gen.log"
python3 -I "$ROOT/tools/gen.py" --subset "$ROOT/runs/data/subset-40.jsonl" --out "$out" --url "http://127.0.0.1:$PORT" \
  --parallel 4 --max-tokens 32000 --deadline-min ${QC_DEADLINE_MIN:-18} "$@" 2>&1 | tee -a "$out/gen.log"
