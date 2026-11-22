#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
until [ -e runs/r2/queue2.done ]; do sleep 10; done
tools/gpu_batch.sh runs/r2/batch4.sh r2-q2kxl-gpu-64k-ub64:Q2_K_XL:gpu:64 > runs/r2/batch4b.log 2>&1
tools/gpu_batch.sh runs/r2/batch7.sh > runs/r2/batch7.log 2>&1
# largest context that runs a real long request, 2-bit quant fully on the GPU
tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-iq2xxs-gpu-128k-ub128-pr32740:pr32740-3afe9c3c8:IQ2_XXS:gpu:131072:q8_0:128:124000" > runs/r2/ctx-1.log 2>&1
tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-iq2xxs-gpu-128k-ub32-inkfix:r2inkfix-19c41d2ff:IQ2_XXS:gpu:131072:q8_0:32:124000" > runs/r2/ctx-2.log 2>&1
tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-iq2xxs-gpu-262k-q4-ub64-pr32740:pr32740-3afe9c3c8:IQ2_XXS:gpu:262144:q4_0:64:250000" > runs/r2/ctx-3.log 2>&1
echo done > runs/r2/queue3.done
