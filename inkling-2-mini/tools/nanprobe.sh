#!/usr/bin/env bash
# Repro matrix for the op-offload NaN (PLAN #7): llama-perplexity, wikitext-2, 3 chunks x 512, IQ4_NL (or INK_MODEL),
# for several expert placements, with and without op offload, and around the 32-token op-offload batch threshold.
#   INK_BIN=/mnt/scratch/llama.cpp/<build>/bin tools/nanprobe.sh <tag>     -> runs/nanprobe/<tag>-<row>.log, <tag>-summary.txt
# One gpu_run session for the whole matrix.
set -uo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
tag=${1:?tag}
if [[ -z ${NP_INSIDE:-} ]]; then
  exec env NP_INSIDE=1 GPU_RUN_MEM=${GPU_RUN_MEM:-44G} "$HOME/anime-pipeline/tools/gpu_run" --need 10000 --wait 7200 "$0" "$@"
fi
BIN=${INK_BIN:?INK_BIN}
MODEL=${INK_MODEL:-/mnt/models/llm/inkling-2-mini/Inkling-2-Mini-IQ4_NL.gguf}
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
out=$ROOT/runs/nanprobe
CORE_GPU='blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'          # core 6-17 on the GPU
L1819_GPU='blk\.([0-9]|1[0-7]|2[0-3])\.ffn_.*_exps=CPU'        # only 18-19 on the GPU, core in RAM
CORE7_GPU='blk\.([0-6]|1[89]|2[0-3])\.ffn_.*_exps=CPU'         # like CORE_GPU but core layer 6 also in RAM
rows=(
  "all-opon;exps=CPU;512;"
  "all-nopo;exps=CPU;512;--no-op-offload"
  "core-opon;$CORE_GPU;512;"
  "core-nopo;$CORE_GPU;512;--no-op-offload"
  "l1819gpu-opon;$L1819_GPU;512;"
  "core7to17gpu-opon;$CORE7_GPU;512;"
  "all-opon-ub31;exps=CPU;31;"
  "all-opon-ub32;exps=CPU;32;"
)
for row in "${rows[@]}"; do
  IFS=';' read -r name ot ub extra <<< "$row"
  [[ -n ${NP_ROWS:-} && " $NP_ROWS " != *" $name "* ]] && continue
  log=$out/$tag-$name.log
  "$BIN/llama-perplexity" -m "$MODEL" -ngl 99 -ot "$ot" --fit off -fa on -c 512 -b 512 -ub "$ub" -t 6 --chunks 3 $extra \
    -f /mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw > "$log" 2>&1 < /dev/null
  echo "$tag $name ub=$ub ${extra:-op-offload-on} :: $(grep -oE '\[[123]\][0-9a-z.+-]+,' "$log" | tr -d '\n') $(grep -oE 'Final estimate: PPL = [0-9.]+' "$log") $(grep -m1 -oE 'out of memory|failed to [a-z ]+' "$log")"
done | tee -a "$out/$tag-summary.txt"
