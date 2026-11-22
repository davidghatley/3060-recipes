#!/usr/bin/env bash
# Batches 2-6 one after the other, each its own turn in the shared GPU queue.
cd "$(dirname "$0")/../.."
until grep -q "^#### done" runs/r2/batch1.log; do sleep 10; done
tools/gpu_batch.sh runs/r2/batch2.sh > runs/r2/batch2.log 2>&1
tools/gpu_batch.sh runs/r2/batch4.sh r2-iq2xxs-gpu-64k:IQ2_XXS:gpu:128 r2-q2kxl-gpu-64k:Q2_K_XL:gpu:128 > runs/r2/batch4.log 2>&1
tools/gpu_batch.sh runs/r2/batch6.sh > runs/r2/batch6.log 2>&1
tools/gpu_batch.sh runs/r2/batch4.sh 'r2-iq3xxs-core5-64k:IQ3_XXS:core:128:blk\.([0-2]|2[0-3])\.ffn_.*_exps=CPU' > runs/r2/batch5.log 2>&1
tools/gpu_batch.sh runs/r2/batch3.sh > runs/r2/batch3.log 2>&1
echo "#### queue1 done $(date +%T)" > runs/r2/queue1.done
