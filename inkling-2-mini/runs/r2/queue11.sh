#!/usr/bin/env bash
# 128k on the #32740 build at the depths round 1 used: 6-15 on the GPU, ub 256, needles at 64k and 124k.
cd "$(dirname "$0")/../.."
until [ -e runs/r2/queue10.done ]; do sleep 10; done
P15='blk\.([0-5]|1[6-9]|2[0-3])\.ffn_.*_exps=CPU'
tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-128k-c15-ub256-pr32740-124k:pr32740-3afe9c3c8:iq4nl:core:131072:q8_0:256:64000+124000:$P15:--no-op-offload" > runs/r2/b128-8.log 2>&1
echo done > runs/r2/queue11.done
