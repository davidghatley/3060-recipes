#!/usr/bin/env bash
# Teacher-forced quality check: KL divergence and top-token agreement of each quant vs our F16 GGUF,
# on 12 held-out validation answers (reasoning + three.js HTML; none are in the render-eval subset).
#   tools/kld.sh            (one gpu_run session; ~8 GB base-logit file under $D/kld/)
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
BIN=${QC_BIN:-/mnt/scratch/llama.cpp/b12242/bin/llama-b12242}
CUDA_LIB=${QC_CUDA_LIB:-/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64}
D=${QC_MODELS:-/mnt/models/llm/qwen3.5-4b-3d-coder}
if [[ -z ${QC_INSIDE:-} ]]; then
  exec env QC_INSIDE=1 GPU_RUN_MEM=${GPU_RUN_MEM:-24G} "$HOME/anime-pipeline/tools/gpu_run" --need 10500 --wait 7200 "$0" "$@"
fi
export LD_LIBRARY_PATH="$BIN:$CUDA_LIB"
out=$ROOT/runs/kld; mkdir -p "$out" "$D/kld"
common=(-ngl 99 -fa on -c 4096 -b 4096 -ub 1024 --chunks 8 -f "$ROOT/runs/data/kld.txt")
base=$D/kld/f16-base.bin
[[ -s $base ]] || "$BIN/llama-perplexity" -m "$D/own/Qwen3.5-4B-3D-Coder-MTP-F16.gguf" "${common[@]}" \
  --kl-divergence-base "$base" > "$out/f16-base.log" 2>&1 < /dev/null
for m in "$D/Qwen3.5-4B-3D-Coder-Q8_0.gguf" "$D/Qwen3.5-4B-3D-Coder-Q4_K_M.gguf" \
         "$D"/own/Qwen3.5-4B-3D-Coder-MTP-{Q8_0,Q6_K,Q5_K_M,Q4_K_M}.gguf; do
  label=$(basename "$m" .gguf); [[ $m == */own/* ]] && label=own-$label || label=official-$label
  "$BIN/llama-perplexity" -m "$m" "${common[@]}" --kl-divergence-base "$base" --kl-divergence \
    > "$out/$label.log" 2>&1 < /dev/null || echo "FAILED $label"
  echo "== $label"; grep -E "Mean PPL\(Q\)|Mean    KLD|Maximum KLD|99.0%   KLD|Same top p|RMS Δp" "$out/$label.log" || tail -3 "$out/$label.log"
done | tee "$out/summary.txt"
