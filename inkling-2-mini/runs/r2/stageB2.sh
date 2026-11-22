#!/usr/bin/env bash
# Round 2, step 1: what does --fit choose for the shipped flags (IQ4_NL, 64k, q8_0 KV, ub 128)? stock master vs PR #32777.
cd "$(dirname "$0")/../.."
until grep -q "^== done" runs/r2/stageC0.log; do sleep 10; done
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib GPU_RUN_MEM=44G
M=/mnt/models/llm/inkling-2-mini/Inkling-2-Mini-IQ4_NL.gguf
for b in master-225a5345b pr32777-c9adddc89; do
  for t in 1024 512 256; do
    echo "== $(date +%T) $b --fit-target $t"
    "$HOME/anime-pipeline/tools/gpu_run" --need 10000 --wait 7200 /mnt/scratch/llama.cpp/$b/bin/llama-fit-params -m $M \
      -c 65536 -np 1 -fa on -ctk q8_0 -ctv q8_0 -b 2048 -ub 128 -t 6 --fit-target $t > runs/r2/fit-$b-t$t.log 2>&1 < /dev/null
    grep -v "^gpu_run" runs/r2/fit-$b-t$t.log | tail -2
  done
done
echo "== done $(date +%T)"
