#!/usr/bin/env bash
# The shipped 128k profile (6-15 on GPU, ub 64, no op offload) on the new shipped build: decode empty, pp 8k, needles at 124k.
cd "$(dirname "$0")/../.."
until [ -e runs/r2/queue5.done ]; do sleep 10; done
P15='blk\.([0-5]|1[6-9]|2[0-3])\.ffn_.*_exps=CPU'
CTX_PP=8000 tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-128k-c15-ub64-inkfix:r2inkfix-19c41d2ff:iq4nl:core:131072:q8_0:64:124000:$P15:--no-op-offload" > runs/r2/b128-6.log 2>&1
echo done > runs/r2/queue6.done
