#!/usr/bin/env bash
# Run a script of several tools/run.sh / tools/kld.sh calls inside ONE gpu_run session (one turn in the shared queue;
# keep it under ~30 min).   tools/batch.sh <script>
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
while [ "$(ps -eo comm= | grep -cE '^(cicc|ptxas|cc1plus|nvcc)$' || true)" -gt 0 ]; do echo "waiting: compiler jobs on the host $(date +%T)"; sleep 60; done
cd "$R"
exec env GPU_RUN_MEM="${GPU_RUN_MEM:-44G}" "$HOME/anime-pipeline/tools/gpu_run" --need "${MX_NEED:-10500}" --wait "${MX_WAIT:-14400}" \
  env MX_NO_GPU_RUN=1 KLD_INSIDE=1 WAIT_IDLE=0 prlimit --core=0 bash "$@"
