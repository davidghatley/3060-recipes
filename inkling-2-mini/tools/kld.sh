#!/usr/bin/env bash
# Teacher-forced quality check: KL divergence and top-token agreement of each candidate GGUF vs the Q8_0 GGUF
# (ggml-org Q8_0: their KLD 0.0030 vs BF16), on two fixed texts:
#   wiki : wikitext-2 test (/mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw), 24 chunks x 512
#   code : runs/data/kld-code.txt (CPython 3.14 stdlib: difflib, statistics, shlex, heapq, ...), 24 chunks x 512
#   tools/kld.sh [model.gguf ...]      (default: IQ4_NL)   one gpu_run session per call
# The Q8_0 base logits (~5 GB per text) are cached under /mnt/models/llm/inkling-2-mini/kld/.
# Experts stay in RAM (-ot exps=CPU) so the 27.8 GB Q8_0 runs; the KLD is a property of the weights, not the placement.
# Everything runs with --no-op-offload (experts computed on the CPU): op offload of loop-core experts held in RAM gives NaN
# logits on master 29b52d398 (runs/nanprobe/), and staging the Q8_0 experts would need a 13 GB buffer anyway.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
BIN=${INK_BIN:-/mnt/scratch/llama.cpp/master-29b52d398/bin}
D=/mnt/models/llm/inkling-2-mini
if [[ -z ${KLD_INSIDE:-} ]]; then
  exec env KLD_INSIDE=1 GPU_RUN_MEM=${GPU_RUN_MEM:-44G} "$HOME/anime-pipeline/tools/gpu_run" --need 6000 --wait 7200 "$0" "$@"
fi
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
out=$ROOT/runs/kld${KLD_TAG:+/$KLD_TAG}; mkdir -p "$out" "$D/kld"     # KLD_TAG=r2 keeps a later round in its own folder
models=("$@"); [[ ${#models[@]} -eq 0 ]] && models=("$D/Inkling-2-Mini-IQ4_NL.gguf")
common=(-ngl 99 -ot exps=CPU --no-op-offload --fit off -fa on -c 512 -b 2048 -ub 2048 -t 6 --chunks 24)
declare -A TEXT=([wiki]=/mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw [code]=$ROOT/runs/data/kld-code.txt)
for t in wiki code; do
  base=$D/kld/q8_0-$t.bin
  [[ -s $base ]] || "$BIN/llama-perplexity" -m "$D/Inkling-2-Mini-Q8_0.gguf" "${common[@]}" -f "${TEXT[$t]}" \
    --kl-divergence-base "$base" > "$out/q8_0-base-$t.log" 2>&1 < /dev/null
  for m in "${models[@]}"; do
    label=$(basename "$m" .gguf)
    "$BIN/llama-perplexity" -m "$m" "${common[@]}" -f "${TEXT[$t]}" --kl-divergence-base "$base" --kl-divergence \
      > "$out/$label-$t.log" 2>&1 < /dev/null || echo "FAILED $label $t"
    echo "== $label $t"; grep -E "Mean PPL\(Q\)|Mean PPL\(base\)|Mean    KLD|Maximum KLD|99.0%   KLD|Same top p|RMS Δp" "$out/$label-$t.log" || tail -3 "$out/$label-$t.log"
  done
done | tee -a "$out/summary.txt"
