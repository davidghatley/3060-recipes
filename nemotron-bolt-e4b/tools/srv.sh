#!/usr/bin/env bash
# One server config + one test, for use inside tools/gpu_batch.sh scripts.
#   tools/srv.sh <label> [ENV=VALUE ...] -- <test command...>
# Env assignments before -- configure serve.sh (VARIANT, NB_*). Server log: runs/server-<label>.log.
set -euo pipefail
R=$(cd "$(dirname "$0")/.." && pwd)
label=$1; shift; envs=()
while [ $# -gt 0 ] && [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift
mkdir -p "$R/configs"
env "${envs[@]}" NB_DRY=1 "$R/serve.sh" > "$R/runs/cmd-$label.txt"
exec env "${envs[@]}" PORT="${PORT:-8105}" READY_WAIT="${READY_WAIT:-900}" \
  "$R/../scripts/with_server.sh" "$label" "$R/serve.sh" "$R/runs" -- "$@"
