#!/usr/bin/env bash
# KL divergence of a lossy change (the local Q8_0-head copy) against the published file (Q6_K blocks, BF16 head).
# No higher-precision copy of this model is on disk, so this measures only what a lever changes, not the
# quantization's own error. Reference logits live in /mnt/scratch/tmp-qwen35-9b-heretic/kld (~4 GB per text).
#   tools/kld.sh base                         build the reference logits (published file)
#   tools/kld.sh <label> <model.gguf> [extra llama-perplexity args]
# Run inside a gpu_run session (tools/gpu_batch.sh), or set KLD_GPU_RUN=1.
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ -n ${KLD_GPU_RUN:-} ]]; then
  exec env KLD_GPU_RUN= GPU_RUN_MEM=${GPU_RUN_MEM:-24G} "$HOME/anime-pipeline/tools/gpu_run" --free --need 8000 --wait 14400 prlimit --core=0 "$0" "$@"
fi
BIN=${QH_BIN:-/mnt/scratch/llama.cpp/master-225a5345b/bin}
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
K=/mnt/scratch/tmp-qwen35-9b-heretic/kld; out=$R/runs/kld; mkdir -p "$K" "$out"
REF=/mnt/models/llm/qwen35-9b-heretic/Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf
common=(-ngl 99 --fit off -fa on -c 512 -b 2048 -ub 512 -t 6 --chunks ${KLD_CHUNKS:-16})
declare -A TEXT=([wiki]=/mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw [code]=$R/../inkling-2-mini/runs/data/kld-code.txt)
label=${1:?label}
if [[ $label == base ]]; then
  for t in ${KLD_TEXTS:-wiki code}; do
    "$BIN/llama-perplexity" -m "$REF" "${common[@]}" -f "${TEXT[$t]}" --kl-divergence-base "$K/ref-$t.bin" \
      > "$out/base-$t.log" 2>&1 < /dev/null || echo "FAILED base $t"
    echo "== base $t"; grep -E "Final estimate" "$out/base-$t.log" || tail -3 "$out/base-$t.log"
  done | tee -a "$out/summary.txt"; exit 0
fi
model=${2:?model}; shift 2
for t in ${KLD_TEXTS:-wiki code}; do
  "$BIN/llama-perplexity" -m "$model" "${common[@]}" "$@" -f "${TEXT[$t]}" --kl-divergence-base "$K/ref-$t.bin" --kl-divergence \
    > "$out/$label-$t.log" 2>&1 < /dev/null || echo "FAILED $label $t"
  echo "== $label $t ($(readlink -f "$model") $*)"
  grep -E "Mean PPL\(Q\)|Mean PPL\(base\)|Mean    KLD|99.0%   KLD|Same top p" "$out/$label-$t.log" || tail -3 "$out/$label-$t.log"
done | tee -a "$out/summary.txt"
