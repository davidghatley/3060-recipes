#!/usr/bin/env bash
# Round 2: 128k boundary, load step. IQ4_NL, q8_0 KV, core layers 6-15 (and 6-16) on the GPU, ub 64..256, op offload off and on.
cd "$(dirname "$0")/../.."
P15='blk\.([0-5]|1[6-9]|2[0-3])\.ffn_.*_exps=CPU'   # 6-15 on the GPU (the 128k profile)
P16='blk\.([0-5]|1[7-9]|2[0-3])\.ffn_.*_exps=CPU'   # 6-16 on the GPU
Q="-ctk q8_0 -ctv q8_0"
for b in r2inkfix-19c41d2ff master-225a5345b pr32752-d66e7bfe2 pr32740-3afe9c3c8; do
  echo "== $b; card before load: $(nvidia-smi --query-gpu=memory.used --format=csv,noheader) used (desktop + idle ComfyUI)"
  echo "-- 6-15 on GPU"
  BP_TAG=r2-128k-c15-$b INK_OT="$P15" INK_BIN=/mnt/scratch/llama.cpp/$b/bin tools/bufprobe.sh \
    "131072 64 $Q --no-op-offload" "131072 128 $Q --no-op-offload" "131072 192 $Q --no-op-offload" "131072 256 $Q --no-op-offload" \
    "131072 64 $Q" "131072 128 $Q" "131072 192 $Q" "131072 256 $Q"
  echo "-- 6-16 on GPU"
  BP_TAG=r2-128k-c16-$b INK_OT="$P16" INK_BIN=/mnt/scratch/llama.cpp/$b/bin tools/bufprobe.sh \
    "131072 64 $Q --no-op-offload" "131072 128 $Q --no-op-offload" "131072 128 $Q"
done 2>&1 | grep -v gallocr | tee runs/membuf/summary-r2-128k.txt
echo "#### done $(date +%T)"
