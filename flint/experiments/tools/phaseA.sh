#!/usr/bin/env bash
# Phase A: llama-bench A/B with stock b12242. Control runs bracket the candidates.
set -uo pipefail
cd "$(dirname "$0")/.."
Q4=/mnt/models/llm/flint/Flint-Q4_K_M.gguf
Q3=/mnt/scratch/models/flint-requant/Flint-Q4_K_M-ramexp-Q3_K.gguf
I4=/mnt/scratch/models/flint-requant/Flint-Q4_K_M-ramexp-IQ4_XS.gguf
C="-b 4096 -ub 4096 -ctk f16 -ctv f16 -lm none -r 3"
PP="-p 4096 -n 128"; D32="-p 0 -n 128 -d 32768"
b() { echo "== $(date +%T) $*"; tools/bench.sh "$@"; }
b A-ctl1          -ncmoe 43 $C $PP
b A-ctl1-d32      -ncmoe 43 $C $D32
FLINT_MODEL=$Q3 b A-q3k-n43    -ncmoe 43 $C $PP
FLINT_MODEL=$Q3 b A-q3k-n43-d32 -ncmoe 43 $C $D32
FLINT_MODEL=$I4 b A-iq4-n43    -ncmoe 43 $C $PP
FLINT_MODEL=$I4 b A-iq4-n43-d32 -ncmoe 43 $C $D32
b A-n39           -ncmoe 39 $C $PP
b A-n39-d32       -ncmoe 39 $C $D32
b A-n41           -ncmoe 41 $C $PP
b A-strict        -ncmoe 43 $C -p 0 -n 128 --cpu-mask 0x555 --cpu-strict 1
b A-prio2         -ncmoe 43 $C -p 0 -n 128 --prio 2
ENVS="GGML_CUDA_GRAPH_OPT=1" b A-graphopt -ncmoe 43 $C -p 0 -n 128
b A-ctl2          -ncmoe 43 $C $PP
echo "== done $(date +%T)"
