#!/usr/bin/env bash
# Phase B2: hand-off profile with the [FLINT-PROF] build (now actually compiled in) and A/B of the
# [FLINT-ASYNC] prototype (GGML_SCHED_ASYNC=1), both env-gated in one self-built tree, ABAB order.
set -uo pipefail
cd "$(dirname "$0")/.."
C="-ncmoe 43 -b 4096 -ub 4096 -ctk f16 -ctv f16 -lm none"
b() { echo "== $(date +%T) $*"; tools/bench.sh "$@"; }
export ENGINE=prof
ENVS="GGML_SCHED_PROF=1" b B2-prof-on  $C -p 0 -n 128 -r 1
ENVS="GGML_SCHED_PROF=2" b B2-prof-detail $C -p 0 -n 32 -r 1
ENVS="GGML_SCHED_PROF=1 GGML_SCHED_ASYNC=1" b B2-prof-async $C -p 0 -n 128 -r 1
b B2-ctl1 $C -p 0 -n 128 -r 5
ENVS="GGML_SCHED_ASYNC=1" b B2-async1 $C -p 0 -n 128 -r 5
b B2-ctl2 $C -p 0 -n 128 -r 5
ENVS="GGML_SCHED_ASYNC=1" b B2-async2 $C -p 0 -n 128 -r 5
b B2-ctl-d32 $C -p 0 -n 128 -d 32768 -r 3
ENVS="GGML_SCHED_ASYNC=1" b B2-async-d32 $C -p 0 -n 128 -d 32768 -r 3
b B2-ctl-pp $C -p 4096 -n 0 -r 3
ENVS="GGML_SCHED_ASYNC=1" b B2-async-pp $C -p 4096 -n 0 -r 3
# output identity: greedy server probes, prof build, async off vs on
export FLINT_BIN=/mnt/scratch/src/llama.cpp-flint/build/bin FLINT_CUDA_LIB=/mnt/scratch/envs/ik-cuda/lib
r() { local label=$1; shift; echo "== $(date +%T) $label"; TESTS="warmup||greedy" tools/srv.sh "$label" -- "$@" 2>&1 | grep --line-buffered -vE "^\s*$"; }
r B2-srv-ctl
GGML_SCHED_ASYNC=1 r B2-srv-async
# exp 3: Q3_K RAM experts at the shipped 128k profile, needles + speed
unset FLINT_BIN FLINT_CUDA_LIB
export FLINT_MODEL=/mnt/scratch/models/flint-requant/Flint-Q4_K_M-ramexp-Q3_K.gguf
r E3-q3k-128k-ndl
FLINT_CONTEXT=131072 TESTS="|--skip cold11k,prose,code --needles 60000,120000|" tools/srv.sh E3-q3k-128k-needles 2>&1 | grep --line-buffered -vE "^\s*$"
# KLD floor: the original Q4_K_M against its own base logits, same flags as the base run
B=/mnt/scratch/llama.cpp/b12242/bin/llama-b12242
echo "== $(date +%T) kld-q4km-self"; tools/quiet.sh
LD_LIBRARY_PATH="$B:/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64" GPU_RUN_MEM=44G \
  $HOME/anime-pipeline/tools/gpu_run --need 10500 --wait 600 $B/llama-perplexity -m /mnt/models/llm/flint/Flint-Q4_K_M.gguf \
  -f /mnt/scratch/data/wikitext-2-dl/wikitext-2-raw/wiki.test.raw -c 512 -b 2048 -ngl 99 -fa on -t 6 -ncmoe 43 --load-mode none \
  --chunks 20 --kl-divergence-base /mnt/scratch/data/flint-kld/base-q4km-20x512.bin --kl-divergence > runs/kld-q4km-self.log 2>&1
grep -E "Mean +KLD|Same top" runs/kld-q4km-self.log
echo "== B2 done $(date +%T)"
