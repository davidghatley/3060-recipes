#!/usr/bin/env bash
# Phase C (quality: wikitext-2 PPL 80x512 + KL divergence 20x512 vs the original Q4_K_M) and
# Phase D (routing counts with llama-imatrix on three code corpora). Stock b12242, through gpu_run.
set -uo pipefail
cd "$(dirname "$0")/.."
B=/mnt/scratch/llama.cpp/b12242/bin/llama-b12242
export LD_LIBRARY_PATH="$B:/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64" GPU_RUN_MEM=44G
G="$HOME/anime-pipeline/tools/gpu_run --need 10500 --wait 600"
Q4=/mnt/models/llm/flint/Flint-Q4_K_M.gguf
R=/mnt/scratch/models/flint-requant
W=/mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw
KB=/mnt/scratch/data/flint-kld/base-q4km-20x512.bin
P="-c 512 -b 2048 -ngl 99 -fa on -t 6 -ncmoe 43"
run() { local name=$1; shift; echo "== $(date +%T) $name"; tools/quiet.sh; $G "$@" > runs/$name.log 2>&1; echo "exit=$?"; grep -E "Final estimate|Mean +KLD|Same top|RMS Δp|Mean PPL\(Q\)|PPL\(base\)" runs/$name.log | head -8; }
if [ "${ONLY:-CD}" != D ]; then
run ppl-q4km   $B/llama-perplexity -m $Q4 -f $W --chunks 80 $P
# kldbase made in queue2.sh
for v in Q3_K IQ4_XS; do
  [ -f $R/Flint-Q4_K_M-ramexp-$v.gguf ] || continue
  run ppl-$v   $B/llama-perplexity -m $R/Flint-Q4_K_M-ramexp-$v.gguf -f $W --chunks 80 $P
  run kld-$v   $B/llama-perplexity -m $R/Flint-Q4_K_M-ramexp-$v.gguf -f $W --chunks 20 $P --kl-divergence-base $KB --kl-divergence
done
fi
if [ "${ONLY:-CD}" != C ]; then
for c in A-py1 B-py2 C-cpp; do
  run imatrix-$c $B/llama-imatrix -m $Q4 -f /mnt/scratch/data/flint-routing/code-$c.txt -o /mnt/scratch/data/flint-routing/imatrix-$c.gguf \
     -c 4096 -b 4096 -ub 4096 -ngl 99 -fa on -t 6 -ncmoe 43 --load-mode none
  grep -E "chunks|tokeniz|n_tokens|processing" runs/imatrix-$c.log | head -3
done
fi
echo "== done $(date +%T)"
