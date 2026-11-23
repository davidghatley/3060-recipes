#!/usr/bin/env bash
# Run a script of several server tests inside ONE gpu_run session (one turn in the shared GPU queue; keep it < ~30 min).
#   tools/gpu_batch.sh <script> [args...]
# Inside, serve.sh skips its own gpu_run call (SNL_NO_GPU_RUN=1). prlimit --core=0: no core dumps on / after a CUDA OOM.
set -euo pipefail
exec env GPU_RUN_MEM="${GPU_RUN_MEM:-24G}" "$HOME/anime-pipeline/tools/gpu_run" --free --need "${SNL_NEED:-9000}" --wait "${SNL_WAIT:-14400}" \
  env SNL_NO_GPU_RUN=1 PORT="${PORT:-8103}" prlimit --core=0 bash "$@"
