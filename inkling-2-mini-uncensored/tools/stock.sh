#!/usr/bin/env bash
# The model cards' own launch line on stock llama.cpp master 225a5345b (the "baseline, stock flags" row):
#   nokeepai:   llama-server -m <base GGUF> --lora <r64 LoRA> -ngl 99 -c 32768 --jinja
#   atomicchat: llama-server -m Inkling-2-Mini-Uncensored-AD-Q4_K.gguf -ngl 99 -c 32768 --jinja
# (--mmproj left out: text-only benchmark.) llama.cpp's default --fit decides the placement. Port 8102.
# Run inside tools/batch.sh (holds the GPU lock); STOCK=nokeepai|atomicchat. STOCK_FIT=1 drops -ngl 99, so
# llama.cpp's --fit picks the placement (with -ngl 99 set, --fit gives up and the cards' lines run out of VRAM).
# Extra args go last, so e.g. `-c 65536` overrides the card's 32768.
set -euo pipefail
B=/mnt/models/llm/inkling-2-mini; U=/mnt/models/llm/inkling-2-mini-uncensored
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
case "${STOCK:-nokeepai}" in
  nokeepai)   M=(-m "$B/Inkling-2-Mini-IQ4_NL.gguf" --lora "$U/nokeepai/Inkling-2-Mini-Unbound-v2-LoRA-r64.gguf") ;;
  atomicchat) M=(-m "$U/atomicchat/Inkling-2-Mini-Uncensored-AD-Q4_K.gguf") ;;
esac
NGL=(-ngl 99); [ -n "${STOCK_FIT:-}" ] && NGL=()
exec /mnt/scratch/llama.cpp/master-225a5345b/bin/llama-server "${M[@]}" ${NGL[@]+"${NGL[@]}"} -c 32768 --jinja --host 127.0.0.1 --port "${PORT:-8102}" "$@"
