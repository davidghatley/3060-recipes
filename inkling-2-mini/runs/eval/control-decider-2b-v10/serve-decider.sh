#!/bin/bash
# Decider 2B v10 control: author's decider.serve @ f01b58d, bf16 (no FP8 on sm_86), 127.0.0.1:8090
cd /mnt/work/jev-index/ext/decider-f01b58d
export DECIDER_MODEL=/mnt/models/llm/decider-2b-v10 DECIDER_FP8=0 DECIDER_COMPILE=${DECIDER_COMPILE:-1} DECIDER_GRAPHS=${DECIDER_GRAPHS:-0} DECIDER_MAX_BATCH=1 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True HF_HUB_OFFLINE=1
exec /mnt/work/jev-index/venv-decider/bin/uvicorn decider.serve:app --host 127.0.0.1 --port 8090
