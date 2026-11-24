#!/usr/bin/env bash
# Local Q8_0 copy of the DFlash drafter (CPU only, ~1 min). Used by NB_DRAFT_Q8=1 ./serve.sh (PLAN row 20).
# The drafter is under the NVIDIA Software and Model Evaluation License: keep the copy local, don't redistribute it.
set -euo pipefail
D=/mnt/models/llm/nemotron-bolt-e4b/dflash
Q=${NB_QUANTIZE_BIN:-/mnt/scratch/llama.cpp/master-29b52d398/bin/llama-quantize}   # master-225a5345b ships no llama-quantize
LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib prlimit --core=0 nice "$Q" \
  "$D/Nemotron-3.5-Bolt-E4B-DFlash-BF16.gguf" "$D/Nemotron-3.5-Bolt-E4B-DFlash-Q8_0-local.gguf" Q8_0 6
