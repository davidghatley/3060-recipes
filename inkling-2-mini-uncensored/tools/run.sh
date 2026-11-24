#!/usr/bin/env bash
# One server start + one gate mode:  tools/run.sh <label> <mode> [serve.sh args...]
#   VARIANT=... and any INK_* / UNC_* env pass through to serve.sh. Port 8102 unless PORT is set.
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
label=${1:?label}; mode=${2:?mode}; shift 2
export PORT=${PORT:-8102} INK_PORT=${PORT:-8102}
# speed runs wait for the host to be free of other sessions' compiler jobs (read-only check, never touches them)
if [ "${WAIT_IDLE:-1}" = 1 ]; then
  while [ "$(ps -eo comm= | grep -cE '^(cicc|ptxas|cc1plus|nvcc)$' || true)" -gt 0 ]; do echo "waiting: compiler jobs on the host $(date +%T)"; sleep 60; done
fi
exec prlimit --core=0 "$R/../scripts/with_server.sh" "$label" "${SERVE:-$R/serve.sh}" "$R/runs" "$@" -- "$R/tools/gate.sh" "$mode"
