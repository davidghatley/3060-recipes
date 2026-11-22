#!/usr/bin/env bash
# Largest context for UD-IQ2_XXS fully on the GPU: 128k failed on both builds (ctx-1, ctx-2), so try 96k.
cd "$(dirname "$0")/../.."
until [ -e runs/r2/queue8.done ]; do sleep 10; done
tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-iq2xxs-gpu-96k-ub128-pr32740:pr32740-3afe9c3c8:IQ2_XXS:gpu:98304:q8_0:128:92000" \
  "r2-iq2xxs-gpu-96k-ub32-inkfix:r2inkfix-19c41d2ff:IQ2_XXS:gpu:98304:q8_0:32:92000" > runs/r2/ctx-4.log 2>&1
echo done > runs/r2/queue9.done
