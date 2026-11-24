#!/usr/bin/env bash
# Run a script of several tools/run.sh calls inside ONE gpu_run session (one turn in the shared queue; keep it < ~30 min).
#   tools/batch.sh <script>     (the script's lines are run.sh / kld.sh calls; serve.sh skips gpu_run via INK_NO_GPU_RUN)
# Waits (outside the lock) until no other session is compiling, so A/B legs see the same idle host.
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
while [ "$(ps -eo comm= | grep -cE '^(cicc|ptxas|cc1plus|nvcc)$' || true)" -gt 0 ]; do echo "waiting: compiler jobs on the host $(date +%T)"; sleep 60; done
cd "$R"
exec env GPU_RUN_MEM="${GPU_RUN_MEM:-44G}" "$HOME/anime-pipeline/tools/gpu_run" --need "${INK_NEED:-10000}" --wait "${INK_WAIT:-14400}" \
  env INK_NO_GPU_RUN=1 KLD_INSIDE=1 WAIT_IDLE=0 prlimit --core=0 bash "$@"
