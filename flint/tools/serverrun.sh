#!/usr/bin/env bash
# Start serve.sh with the given env overrides, wait for health, run servertest.py, then stop the server cleanly.
#   FLINT_CPU_MOE=43 tools/serverrun.sh <label> [servertest args...] [-- extra llama-server args]
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
label=${1:?label}; shift
targs=(); sargs=()
while [ $# -gt 0 ]; do
  if [ "$1" = "--" ]; then shift; sargs=("$@"); break; fi
  targs+=("$1"); shift
done
log="$ROOT/runs/server-$label.log"
setsid "$ROOT/serve.sh" "${sargs[@]}" > "$log" 2>&1 < /dev/null &
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
for _ in $(seq 900); do
  curl -sf "http://127.0.0.1:${FLINT_PORT:-8081}/health" > /dev/null && break
  kill -0 "$top" 2>/dev/null || { echo "server exited during load:"; tail -20 "$log"; exit 1; }
  sleep 1
done
echo "$label ready; vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
python3 -I "$ROOT/tools/servertest.py" --label "$label" "${targs[@]}"
