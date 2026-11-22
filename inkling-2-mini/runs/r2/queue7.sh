#!/usr/bin/env bash
# 128k boundary on the #32740 build: 6-16 on the GPU at ub 128 (loads; does it run?), and 6-15 at ub 256 to 124k if 104k passed.
cd "$(dirname "$0")/../.."
until [ -e runs/r2/queue6.done ]; do sleep 10; done
P16='blk\.([0-5]|1[7-9]|2[0-3])\.ffn_.*_exps=CPU'
CTX_PP=8000 tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-128k-c16-ub128-pr32740:pr32740-3afe9c3c8:iq4nl:core:131072:q8_0:128:104000:$P16:--no-op-offload" > runs/r2/b128-7.log 2>&1
echo done > runs/r2/queue7.done
