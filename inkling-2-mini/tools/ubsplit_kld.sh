#!/usr/bin/env bash
# Is multi-micro-batch prefill correct? KLD vs the cached Q8_0 wiki logits (tools/kld.sh) of IQ4_NL with serve.sh's
# placement (core 6-17 experts on GPU, op offload on, inkfix build), at -ub 512 (one micro-batch per 512 chunk)
# and at smaller -ub (the chunk is processed in pieces, as every prompt > ub tokens and every decode step is).
#   tools/ubsplit_kld.sh [chunks]
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ -z ${UBK_INSIDE:-} ]]; then
  exec env UBK_INSIDE=1 GPU_RUN_MEM=${GPU_RUN_MEM:-44G} "$HOME/anime-pipeline/tools/gpu_run" --need 10000 --wait 7200 "$0" "$@"
fi
BIN=${INK_BIN:-/mnt/scratch/llama.cpp/inkfix-4c836a8eb/bin}
D=/mnt/models/llm/inkling-2-mini
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
out=$ROOT/runs/ubsplit; mkdir -p "$out"
chunks=${1:-12}
base=$D/kld/q8_0-wiki.bin
for cfg in "512 f16" "128 f16" "32 f16" "16 f16" "128 q8_0"; do
  set -- $cfg; ub=$1; kv=$2; label=ub$ub-kv$kv
  "$BIN/llama-perplexity" -m "$D/Inkling-2-Mini-IQ4_NL.gguf" -ngl 99 -ot 'blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU' --fit off \
    -fa on -ctk $kv -ctv $kv -c 512 -b 512 -ub $ub -t 6 --chunks $chunks \
    -f /mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw --kl-divergence-base "$base" --kl-divergence \
    > "$out/$label.log" 2>&1 < /dev/null || echo "FAILED $label"
  echo "== $label"; grep -E "Mean PPL\(Q\)|Mean PPL\(base\)|Mean    KLD|99.0%   KLD|Same top p" "$out/$label.log" || tail -3 "$out/$label.log"
done | tee "$out/summary.txt"
