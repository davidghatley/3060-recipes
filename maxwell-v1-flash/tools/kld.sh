#!/usr/bin/env bash
# KL divergence on this box. No higher-precision Maxwell file is on disk (Q8_0 38.4 GB / BF16 72 GB not downloaded,
# see README "Owner decisions"), so the reference here is the AD-Q4_K-IQ4_XS file itself: this measures how far an
# EDIT (the uncensored LoRA) or a runtime change moves the output from the shipped base, not quantization error.
#   tools/kld.sh ref  <label>                      write reference logits (base file, flags below)
#   tools/kld.sh cmp  <label> [lora.gguf] [extra llama-perplexity args...]   KLD against the reference
# One gpu_run session per call unless KLD_INSIDE=1 (tools/batch.sh sets it).
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ -z ${KLD_INSIDE:-} ]]; then
  exec env KLD_INSIDE=1 GPU_RUN_MEM=${GPU_RUN_MEM:-44G} "$HOME/anime-pipeline/tools/gpu_run" --need 8000 --wait 7200 prlimit --core=0 "$0" "$@"
fi
mode=${1:?ref|cmp}; label=${2:?label}; shift 2
BIN=${MX_BIN:-/mnt/scratch/llama.cpp/maxwell-4f969ad24/bin}
MODEL=${MX_MODEL:-/mnt/models/llm/maxwell-v1-flash/Maxwell-V1-Flash-AD-Q4_K-IQ4_XS.gguf}
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
K=/mnt/scratch/tmp-maxwell/kld; out=$R/runs/kld; mkdir -p "$K" "$out"
common=(-ngl 99 --n-cpu-moe "${KLD_NCMOE:-33}" --fit off -fa on -c 512 -b 2048 -ub 2048 -t 6 --chunks "${KLD_CHUNKS:-24}")
declare -A TEXT=([wiki]=/mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw [code]=$R/../inkling-2-mini/runs/data/kld-code.txt)
for t in ${KLD_TEXTS:-wiki code}; do
  base=$K/ad-q4k-$t.bin
  if [[ $mode == ref ]]; then
    "$BIN/llama-perplexity" -m "$MODEL" "${common[@]}" -f "${TEXT[$t]}" --kl-divergence-base "$base" > "$out/$label-$t.log" 2>&1 < /dev/null || echo "FAILED $label $t"
    echo "== ref $label $t: $(grep -E 'Final estimate' "$out/$label-$t.log" || tail -2 "$out/$label-$t.log")"
  else
    lora=${1:-}; extra=("${@:2}")
    args=(); [[ -n $lora ]] && args+=(--lora "$lora")
    "$BIN/llama-perplexity" -m "$MODEL" "${common[@]}" "${args[@]}" ${extra[@]+"${extra[@]}"} -f "${TEXT[$t]}" --kl-divergence-base "$base" --kl-divergence \
      > "$out/$label-$t.log" 2>&1 < /dev/null || echo "FAILED $label $t"
    echo "== $label $t ($(readlink -f "$MODEL")${lora:+ + $lora} ${extra[*]:-})"
    grep -E "Mean PPL\(Q\)|Mean PPL\(base\)|Mean    KLD|Maximum KLD|99.0%   KLD|Same top p|RMS Δp" "$out/$label-$t.log" || tail -3 "$out/$label-$t.log"
  fi
done | tee -a "$out/summary.txt"
