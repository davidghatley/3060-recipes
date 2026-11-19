#!/usr/bin/env bash
# One llama-bench run for the Flint experiments through the shared GPU queue, gated on an idle CPU.
#   [ENGINE=stock|prof] [FLINT_MODEL=...] [ENVS="K=V ..."] tools/bench.sh <name> [llama-bench args...]
# stock = prebuilt b12242 (the recipe's binary); prof = self-built 3b4d6ab3f clone (/mnt/scratch/src/llama.cpp-flint/build).
# Writes runs/bench-<name>.jsonl, .err, -dmon.txt (nvidia-smi), -load.txt (CPU state before and after).
set -euo pipefail
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
name=${1:?name}; shift
MODEL=${FLINT_MODEL:-/mnt/models/llm/flint/Flint-Q4_K_M.gguf}
case "${ENGINE:-stock}" in
  stock) BIN=/mnt/scratch/llama.cpp/b12242/bin/llama-b12242
         export LD_LIBRARY_PATH="$BIN:/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64" ;;
  prof)  BIN=${PROF_BIN:-/mnt/scratch/src/llama.cpp-flint/build/bin}
         export LD_LIBRARY_PATH="$BIN:/mnt/scratch/envs/ik-cuda/lib" ;;
esac
export GPU_RUN_MEM=${GPU_RUN_MEM:-44G}
out="$HERE/runs/bench-$name"
"$HERE/tools/quiet.sh" > "$out-load.txt" || { cat "$out-load.txt"; echo "CPU not quiet, refusing to run" >&2; exit 3; }
{ date -Is; uptime; ps -eo pcpu,comm --sort=-pcpu | head -6; } >> "$out-load.txt"
nvidia-smi dmon -s mt -d 1 > "$out-dmon.txt" 2>&1 &
dmon=$!
trap 'kill $dmon 2>/dev/null || true' EXIT
env ${ENVS:-} "$HOME/anime-pipeline/tools/gpu_run" --need 10500 --wait 600 \
  "$BIN/llama-bench" -m "$MODEL" -ngl 99 -fa 1 -t 6 -o jsonl "$@" > "$out.jsonl" 2> "$out.err"
{ echo "-- after"; date -Is; uptime; ps -eo pcpu,comm --sort=-pcpu | head -6; } >> "$out-load.txt"
python3 -I "$HERE/tools/summarize.py" "$out.jsonl"
