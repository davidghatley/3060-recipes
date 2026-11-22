#!/usr/bin/env bash
# Phase H (2026-11-22): a smaller expert quant made from the original weights, with the same "all experts in RAM +
# hot cache in VRAM" profile. unsloth/flint-GGUF UD-Q3_K_XL @ 20468edf (18.5 GB) vs the shipped Q4_K_M.
# Speed: 128k profile, same cache MiB (a Q3 expert is smaller, so more of them fit). Controls on both sides.
# Quality: KLD + top-1 vs the Q4_K_M base logits (exp 3/5 method), wikitext PPL, needles 60k/120k, the textwrap
# rewrite (code case), and the shared 8-task code eval at temp 0.
# Port 8091, not 8081: another session's server on 8081 answered our health check while we queued (first run, void).
cd "$(dirname "$0")/.."; export FLINT_PORT=${FLINT_PORT:-8091} FLINT_GPU_WAIT=3600 FLINT_CONTEXT=131072 FLINT_CPU_MOE=49
Q3=/mnt/models/llm/flint/ud-q3kxl/flint-UD-Q3_K_XL.gguf
CACHE=${CACHE:-2944}
REPO=$(cd ../.. && pwd)
export EXTRA="python3 -I $REPO/scripts/codeeval.py --url http://127.0.0.1:${FLINT_PORT} --out $PWD/runs --max 4096 --label \"\$1\""
export TESTS="warmup|--reps 3 --code-max 4000|"
run() { echo "== $(date +%T) $1"; tools/srv.sh "$@"; local r=$?; [ $r = 0 ] || echo "!! $1 failed (exit $r)"; return $r; }
C="-lv 4 --moe-cache-mib $CACHE --moe-cache-cpu-share 0.95"
run H-q4km-ctl1 -- $C
FLINT_MODEL=$Q3 run H-q3kxl -- $C
run H-q4km-ctl2 -- $C
TESTS="|--skip cold11k,prose,code --needles 60000,120000|" EXTRA= FLINT_MODEL=$Q3 run H-q3kxl-needles -- $C

# Quality via llama-perplexity, same flags as exp 3 (phaseCD2.sh), stock b12242.
B=/mnt/scratch/llama.cpp/b12242/bin/llama-b12242
export LD_LIBRARY_PATH="$B:/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64" GPU_RUN_MEM=44G
G="$HOME/anime-pipeline/tools/gpu_run --need 10500 --wait 3600"
W=/mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw
KB=/mnt/scratch/data/flint-kld/base-q4km-20x512.bin
P="-c 512 -b 2048 -ngl 99 -fa on -t 6 -ncmoe 43"
q() { local name=$1; shift; echo "== $(date +%T) $name"; tools/quiet.sh; $G "$@" > runs/$name.log 2>&1; echo "exit=$?"
      grep -E "Final estimate|Mean +KLD|Same top|Mean PPL\(Q\)" runs/$name.log | head -6; }
q kld-q3kxl $B/llama-perplexity -m $Q3 -f $W --chunks 20 $P --kl-divergence-base $KB --kl-divergence
q ppl-q3kxl $B/llama-perplexity -m $Q3 -f $W --chunks 80 $P
echo "== H done $(date +%T)"
