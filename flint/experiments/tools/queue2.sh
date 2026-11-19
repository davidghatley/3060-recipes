#!/usr/bin/env bash
# After sweepE: missing 64k full run + needles, cache quality (KLD at ubatch 8), profiling (phase B), quality+routing (phase C/D).
set -uo pipefail
cd "$(dirname "$0")/.."
FULL="warmup|--reps 4 --skip code|greedy,depth"
r() { local label=$1 ctx=$2 ncmoe=$3 tests=$4; shift 4; echo "== $(date +%T) $label"
      FLINT_CONTEXT=$ctx FLINT_CPU_MOE=$ncmoe TESTS="$tests" tools/srv.sh "$label" -- -lv 4 "$@" 2>&1 | grep --line-buffered -vE "^\s*$"; }
r E-64k-all-c5248-95       65536 49 "$FULL"  --moe-cache-mib 5248 --moe-cache-cpu-share 0.95
r E-64k-all-c5248-95-ndl   65536 49 "|--skip cold11k,prose,code --needles 30000,62000|" --moe-cache-mib 5248 --moe-cache-cpu-share 0.95
r E-128k-all-c2944-95-ndl 131072 49 "|--skip cold11k,prose,code --needles 60000,120000|" --moe-cache-mib 2944 --moe-cache-cpu-share 0.95
r E-64k-n43-c2688-95-full  65536 43 "$FULL" --moe-cache-mib 2688 --moe-cache-cpu-share 0.95
r E-64k-n43-c2688-95-ndl   65536 43 "|--skip cold11k,prose,code --needles 30000,62000|" --moe-cache-mib 2688 --moe-cache-cpu-share 0.95
r E-128k-n45-c1600-95 131072 45 "warmup||greedy" --moe-cache-mib 1600 --moe-cache-cpu-share 0.95
r E-128k-n47-c2100-95 131072 47 "warmup||greedy" --moe-cache-mib 2100 --moe-cache-cpu-share 0.95
r E-64k-n37             65536 37 "warmup|--reps 3 --skip code|"
r E-64k-n35             65536 35 "warmup|--reps 3 --skip code|"
r E-64k-n39-ndl            65536 39 "|--skip cold11k,prose,code --needles 30000,62000|"
# cache quality: KL divergence vs the Q4_K_M base logits (ubatch 2048, no cache), here at ubatch 8 so the cache is used
B=/mnt/scratch/llama.cpp/b12242/bin/llama-b12242
export LD_LIBRARY_PATH="$B:/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64" GPU_RUN_MEM=44G
G="$HOME/anime-pipeline/tools/gpu_run --need 10500 --wait 600"
W=/mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw
KB=/mnt/scratch/data/flint-kld/base-q4km-20x512.bin
Q4=/mnt/models/llm/flint/Flint-Q4_K_M.gguf
q() { local name=$1; shift; echo "== $(date +%T) $name"; tools/quiet.sh; $G "$@" > runs/$name.log 2>&1; echo "exit=$?"; grep -E "Final estimate|Mean +KLD|Same top|RMS Δp|Mean +PPL|hit rate" runs/$name.log | head -8; }
P="-c 512 -ngl 99 -fa on -t 6 --load-mode none -f $W"
q kldbase-q4km $B/llama-perplexity -m $Q4 $P -b 2048 -ncmoe 43 --chunks 20 --kl-divergence-base $KB
q kld-ub8-nocache    $B/llama-perplexity -m $Q4 $P -b 8 -ub 8 -cmoe --chunks 20 --kl-divergence-base $KB --kl-divergence
q kld-ub8-c2944-95   $B/llama-perplexity -m $Q4 $P -b 8 -ub 8 -cmoe --chunks 20 --kl-divergence-base $KB --kl-divergence --moe-cache-mib 2944 --moe-cache-cpu-share 0.95 -lv 4
q kld-ub8-n43        $B/llama-perplexity -m $Q4 $P -b 8 -ub 8 -ncmoe 43 --chunks 20 --kl-divergence-base $KB --kl-divergence
tools/phaseB.sh
echo "== queue2 done $(date +%T)"
