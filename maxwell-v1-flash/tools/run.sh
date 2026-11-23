#!/usr/bin/env bash
# One server start + one gate mode:  tools/run.sh <label> <mode> [serve.sh args...]
#   VARIANT=... and any MX_* env pass through to serve.sh. Port 8104 unless PORT is set.
#   Inside tools/batch.sh (one gpu_run hold) serve.sh skips its own gpu_run (MX_NO_GPU_RUN=1).
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
label=${1:?label}; mode=${2:?mode}; shift 2
export PORT=${PORT:-8104} MX_PORT=${PORT:-8104}
if [ "${WAIT_IDLE:-1}" = 1 ]; then
  while [ "$(ps -eo comm= | grep -cE '^(cicc|ptxas|cc1plus|nvcc)$' || true)" -gt 0 ]; do echo "waiting: compiler jobs on the host $(date +%T)"; sleep 60; done
fi
# record the exact launch env of this run
python3 -I -c 'import json,os,sys,time; print(json.dumps({"label": sys.argv[1], "case": "env", "t": int(time.time()), "env": {k: v for k, v in os.environ.items() if k.startswith("MX_") or k in ("VARIANT", "GPU_RUN_MEM")}, "args": sys.argv[2:]}))' "$label" "$@" >> "$R/runs/ledger.jsonl"
exec prlimit --core=0 "$R/../scripts/with_server.sh" "$label" "${SERVE:-$R/serve.sh}" "$R/runs" "$@" -- "$R/tools/gate.sh" "$mode"
