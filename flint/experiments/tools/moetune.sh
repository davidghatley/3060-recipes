#!/usr/bin/env bash
# Run llama.cpp's scripts/moe-cache-tune.py (3b4d6ab3f = b12242) on the stock b12242 server through gpu_run.
#   tools/moetune.sh <name> <ncmoe> <ctx> [extra server args]
# Output: runs/moetune-<name>/ (per-run logs + traces) and runs/moetune-<name>.txt (the script's report).
set -euo pipefail
cd "$(dirname "$0")/.."
name=$1 ncmoe=$2 ctx=$3; shift 3
B=/mnt/scratch/llama.cpp/b12242/bin/llama-b12242
export LD_LIBRARY_PATH="$B:/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64" GPU_RUN_MEM=44G
tools/quiet.sh
python3 -I /mnt/scratch/src/llama.cpp-flint/scripts/moe-cache-tune.py --out runs/moetune-$name ${MAXMIB:+--max-mib $MAXMIB} --markdown -- \
  bash -c 'sleep 8; exec "$@"' _ "$HOME/anime-pipeline/tools/gpu_run" --need 10500 --wait 600 \
  "$B/llama-server" -m ${FLINT_MODEL:-/mnt/models/llm/flint/Flint-Q4_K_M.gguf} -ngl 99 $( [ "$ncmoe" = all ] && echo -cmoe || echo -ncmoe $ncmoe ) --fit off \
  -c "$ctx" -np 1 -t 6 -b 4096 -ub 4096 --load-mode none -fa on -ctk f16 -ctv f16 "$@" 2>&1 | tee runs/moetune-$name.txt
