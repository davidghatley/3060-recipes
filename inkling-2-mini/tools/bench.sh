#!/usr/bin/env bash
# One llama-bench run for Inkling-2-Mini through the shared GPU queue, with VRAM/PCIe telemetry.
#   tools/bench.sh <name> [llama-bench args...]
# Writes runs/bench-<name>.jsonl (llama-bench results), .err, and -dmon.txt (nvidia-smi dmon).
# Filled in: model (INK_MODEL), -ngl 99, -fa 1, -t 6 unless given. Waits for >= 90% idle CPU first.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
name=${1:?name}; shift
BIN=${INK_BIN:-/mnt/scratch/llama.cpp/master-29b52d398/bin}
MODEL=${INK_MODEL:-/mnt/models/llm/inkling-2-mini/Inkling-2-Mini-IQ4_NL.gguf}
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
export GPU_RUN_MEM=${GPU_RUN_MEM:-44G}
out="$ROOT/runs/bench-$name"
idle() { local a b; read -r _ a1 a2 a3 a4 a5 a6 a7 _ < /proc/stat; sleep 2; read -r _ b1 b2 b3 b4 b5 b6 b7 _ < /proc/stat
  local tot=$(( (b1+b2+b3+b4+b5+b6+b7)-(a1+a2+a3+a4+a5+a6+a7) )); echo $(( 100*(b4-a4)/(tot>0?tot:1) )); }
for _ in $(seq 300); do [ "$(idle)" -ge 90 ] && break; done
echo "cpu idle $(idle)% at start" > "$out.err"
nvidia-smi dmon -s mt -d 1 > "$out-dmon.txt" 2>&1 &
dmon=$!
trap 'kill $dmon 2>/dev/null || true' EXIT
extra=(); [[ " $* " == *" -t "* ]] || extra+=(-t 6)
"$HOME/anime-pipeline/tools/gpu_run" --need "${INK_NEED:-10000}" --wait 7200 \
  "$BIN/llama-bench" -m "$MODEL" -ngl 99 -fa 1 "${extra[@]}" -o jsonl "$@" > "$out.jsonl" 2>> "$out.err"
python3 -I "$ROOT/tools/summarize.py" "$out.jsonl"
