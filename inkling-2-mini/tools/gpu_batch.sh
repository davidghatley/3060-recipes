#!/usr/bin/env bash
# Run a script of several tests inside ONE gpu_run session (one turn in the shared GPU queue, keep it under ~30 min).
#   tools/gpu_batch.sh <script> [args...]
# The tools then skip their own gpu_run call: serve.sh / bench.sh via INK_NO_GPU_RUN, kld.sh / nanprobe.sh / bufprobe.sh
# via their *_INSIDE switches. prlimit --core=1: a CUDA OOM aborts llama-server and a core dump would land on /.
set -euo pipefail
exec env GPU_RUN_MEM="${GPU_RUN_MEM:-44G}" "$HOME/anime-pipeline/tools/gpu_run" --need "${INK_NEED:-10000}" --wait "${INK_WAIT:-14400}" \
  env INK_NO_GPU_RUN=1 KLD_INSIDE=1 NP_INSIDE=1 BP_INSIDE=1 UBK_INSIDE=1 prlimit --core=1 bash "$@"
