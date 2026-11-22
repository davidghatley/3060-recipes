#!/usr/bin/env bash
# 128k boundary: real long requests for the cases that load (runs/membuf/summary-r2-128k.txt). IQ4_NL, q8_0 KV, --no-op-offload.
cd "$(dirname "$0")/../.."
until [ -e runs/r2/queue1.done ]; do sleep 10; done
P15='blk\.([0-5]|1[6-9]|2[0-3])\.ffn_.*_exps=CPU'; P16='blk\.([0-5]|1[7-9]|2[0-3])\.ffn_.*_exps=CPU'; P17='blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'
N=--no-op-offload
CTX_PP=8000 tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-128k-c16-ub64-inkfix:r2inkfix-19c41d2ff:iq4nl:core:131072:q8_0:64:64000:$P16:$N" > runs/r2/b128-1.log 2>&1
tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-128k-c16-ub64-inkfix-124k:r2inkfix-19c41d2ff:iq4nl:core:131072:q8_0:64:124000:$P16:$N" > runs/r2/b128-2.log 2>&1
CTX_PP=8000 tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-128k-c17-ub128-pr32740:pr32740-3afe9c3c8:iq4nl:core:131072:q8_0:128:104000:$P17:$N" > runs/r2/b128-3.log 2>&1
CTX_PP=8000 tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-128k-c15-ub256-pr32740:pr32740-3afe9c3c8:iq4nl:core:131072:q8_0:256:104000:$P15:$N" > runs/r2/b128-4.log 2>&1
CTX_PP=8000 tools/gpu_batch.sh runs/r2/ctxrun.sh "r2-128k-c15-ub128-pr32752:pr32752-d66e7bfe2:iq4nl:core:131072:q8_0:128:104000:$P15:$N" > runs/r2/b128-5.log 2>&1
echo done > runs/r2/queue2.done
