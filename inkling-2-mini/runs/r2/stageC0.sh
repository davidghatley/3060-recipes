#!/usr/bin/env bash
# Round 2, step 2: what loads with the 2-bit quants fully on the GPU (buffers only; a load is not a run, see stage C3).
cd "$(dirname "$0")/../.."
until grep -q "^== done" runs/r2/stageB1.log; do sleep 10; done
U=/mnt/models/llm/inkling-2-mini/unsloth/Mainline_Support
for q in IQ2_XXS Q2_K_XL; do
  for b in master-225a5345b pr32740-3afe9c3c8; do
    echo "== $(date +%T) $q all-GPU on $b"
    BP_TAG=r2-$q-$b INK_NEED=10000 INK_MODEL=$U/Inkling-2-Mini-UD-$q.gguf INK_OT='blk\.99\.none=CPU' INK_BIN=/mnt/scratch/llama.cpp/$b/bin \
      tools/bufprobe.sh "65536 128 -ctk q8_0 -ctv q8_0" "65536 512 -ctk q8_0 -ctv q8_0" "131072 128 -ctk q8_0 -ctv q8_0" \
        "131072 512 -ctk q8_0 -ctv q8_0" "262144 128 -ctk q8_0 -ctv q8_0" "262144 128 -ctk q4_0 -ctv q4_0" 2>&1 | grep -v "waiting for the GPU"
  done
done | tee runs/membuf/summary-r2-allgpu.txt
echo "== done $(date +%T)"
