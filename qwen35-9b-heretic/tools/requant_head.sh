#!/usr/bin/env bash
# Labelled lossy experiment: the same file with only output.weight converted BF16 -> Q8_0 (every other tensor keeps
# its type, and llama-quantize copies a tensor unchanged when its type does not change). CPU only.
#   tools/requant_head.sh [OUT]   (default /mnt/scratch/tmp-qwen35-9b-heretic/...-Q6_K-headQ8_0-local.gguf)
set -euo pipefail
BIN=/mnt/scratch/llama.cpp/master-29b52d398/bin   # master-225a5345b ships no llama-quantize
IN=/mnt/models/llm/qwen35-9b-heretic/Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf
OUT=${1:-/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf}
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
nice prlimit --core=0 "$BIN/llama-quantize" --allow-requantize --output-tensor-type q8_0 --token-embedding-type q6_k \
  "$IN" "$OUT" Q6_K 6
