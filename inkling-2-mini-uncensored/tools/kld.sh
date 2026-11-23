#!/usr/bin/env bash
# KL divergence vs the base recipe's Q8_0 reference logits (ggml-org Inkling-2-Mini Q8_0), same texts and flags as
# ../inkling-2-mini/tools/kld.sh, plus an optional LoRA. The cached logits are only read, never rebuilt here.
#   tools/kld.sh <label> <model.gguf> [lora.gguf]       (one gpu_run session per call; KLD_INSIDE=1 to skip it)
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ -z ${KLD_INSIDE:-} ]]; then
  exec env KLD_INSIDE=1 GPU_RUN_MEM=${GPU_RUN_MEM:-44G} "$HOME/anime-pipeline/tools/gpu_run" --need 6000 --wait 7200 prlimit --core=0 "$0" "$@"
fi
label=${1:?label}; model=${2:?model}; lora=${3:-}
BIN=${INK_BIN:-/mnt/scratch/llama.cpp/r2inkfix-19c41d2ff/bin}
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
K=/mnt/models/llm/inkling-2-mini/kld; out=$R/runs/kld; mkdir -p "$out"
common=(-ngl 99 -ot exps=CPU --no-op-offload --fit off -fa on -c 512 -b 2048 -ub 2048 -t 6 --chunks 24)
[[ -n $lora ]] && common+=(--lora "$lora")
declare -A TEXT=([wiki]=/mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw [code]=$R/../inkling-2-mini/runs/data/kld-code.txt)
for t in ${KLD_TEXTS:-wiki code}; do
  base=$K/q8_0-$t.bin; [[ -s $base ]] || { echo "missing $base" >&2; exit 1; }
  "$BIN/llama-perplexity" -m "$model" "${common[@]}" -f "${TEXT[$t]}" --kl-divergence-base "$base" --kl-divergence \
    > "$out/$label-$t.log" 2>&1 < /dev/null || echo "FAILED $label $t"
  echo "== $label $t ($(readlink -f "$model")${lora:+ + $lora})"
  grep -E "Mean PPL\(Q\)|Mean PPL\(base\)|Mean    KLD|Maximum KLD|99.0%   KLD|Same top p|RMS Δp" "$out/$label-$t.log" || tail -3 "$out/$label-$t.log"
done | tee -a "$out/summary.txt"
