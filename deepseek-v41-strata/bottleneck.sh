#!/usr/bin/env bash
# Separate CPU from NVMe in DeepSeek-V4.1-Flash decode (2026-11-21). One knob per run, a control on both sides:
#   threads: --cpu-threads 3 vs the default 6 (if decode is CPU bound, it should drop a lot)
#   store:   --ssd-cache 13.5 vs 27 GB RAM store (if decode waits on the SSD, a smaller store means more SSD reads)
# Faster mode (5 experts, the default), chat + code, 3 runs each (first is warm-up), 256 tokens, effort low.
# Two gpu_run sessions, each under ~30 min.  Usage: deepseek-v41-strata/bottleneck.sh [a|b]
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
export BENCH_ARGS="--cases chat,code --runs 3" GPU_RUN_MEM=44G
q() { "$HOME/anime-pipeline/tools/gpu_run" --free --need 11000 --wait "${DS_GPU_WAIT:-1800}" "$HERE/run_variant.sh" "$@"; }
session_a() {
  q bn-ctl1    --ssd-cache 27
  q bn-t3      --ssd-cache 27 --cpu-threads 3
  q bn-store13 --ssd-cache 13.5
}
session_b() {
  q bn-t12     --ssd-cache 27 --cpu-threads 12
  q bn-ctl2    --ssd-cache 27
}
case "${1:-all}" in a) session_a ;; b) session_b ;; all) session_a; session_b ;; esac
