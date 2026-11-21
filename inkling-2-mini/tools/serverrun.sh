#!/usr/bin/env bash
# Start serve.sh with the given env overrides, wait for health, run servertest.py, then stop the server cleanly.
#   INK_CPU_MOE=12 tools/serverrun.sh <label> [servertest args...] [-- extra llama-server args]
#   INK_SERVE=<other serve script> and INK_LOGDIR=<dir> are optional overrides.
#   INK_TEST="<shell command>" runs instead of srvtest.py (from the recipe dir), e.g. the smoke test.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
label=${1:?label}; shift
targs=(); sargs=()
while [ $# -gt 0 ]; do
  if [ "$1" = "--" ]; then shift; sargs=("$@"); break; fi
  targs+=("$1"); shift
done
SERVE=${INK_SERVE:-$ROOT/serve.sh}
log="${INK_LOGDIR:-$ROOT/runs}/server-$label.log"
setsid "$SERVE" "${sargs[@]}" > "$log" 2>&1 < /dev/null &
top=$!
descendants() { local p; for p in $(pgrep -P "$1"); do echo "$p"; descendants "$p"; done; }
stop() {
  local pids p
  pids=$(descendants "$top")
  for p in $pids; do [ "$(cat /proc/$p/comm 2>/dev/null)" = llama-server ] && kill -INT "$p" 2>/dev/null; done
  for _ in $(seq 60); do kill -0 "$top" 2>/dev/null || return 0; sleep 1; done
  echo "server did not exit after 60 s (pid $top)" >&2
}
trap stop EXIT
for _ in $(seq 7200); do
  curl -sf "http://127.0.0.1:${INK_PORT:-8085}/health" > /dev/null && break
  kill -0 "$top" 2>/dev/null || { echo "server exited during load:"; tail -20 "$log"; exit 1; }
  sleep 1
done
echo "$label ready; vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
if [ -n "${INK_TEST:-}" ]; then (cd "$ROOT" && eval "$INK_TEST"); else python3 -I "$ROOT/tools/srvtest.py" --label "$label" "${targs[@]}"; fi
echo "$label done; vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
