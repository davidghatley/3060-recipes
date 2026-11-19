#!/usr/bin/env bash
# Requantize ONLY the routed-expert tensors of blocks 2..42 (the 41 MoE layers mainline -ncmoe 43 keeps in RAM)
# of Flint-Q4_K_M to TYPE. Everything else is pinned to its current type, which llama-quantize copies verbatim.
#   tools/requant.sh TYPE OUT.gguf [--dry-run]
set -euo pipefail
TYPE=${1:?type}; OUT=${2:?out}; shift 2
BIN=/mnt/scratch/llama.cpp/b12242/bin/llama-b12242
export LD_LIBRARY_PATH=$BIN
SRC=/mnt/models/llm/flint/Flint-Q4_K_M.gguf
IMAT=${IMATRIX:-/mnt/scratch/data/flint-imatrix-dl/RecursiveSI_flint-imatrix.gguf}
RAM='blk\.([2-9]|[1-3][0-9]|4[0-2])\.ffn_(up|gate|down)_exps'
nice -n 10 "$BIN/llama-quantize" --allow-requantize --imatrix "$IMAT" \
  --token-embedding-type q8_0 --output-tensor-type q8_0 \
  --tensor-type "$RAM=$TYPE" \
  --tensor-type 'ffn_(up|gate|down)_exps=q4_k' \
  --tensor-type 'ffn_(up|gate|down)_shexp=q8_0' \
  --tensor-type 'attn_(q|k|v|output)=q8_0' \
  --tensor-type 'ffn_(up|gate|down)\.weight=q4_k' \
  "$@" "$SRC" "$OUT" Q4_K_M 10
