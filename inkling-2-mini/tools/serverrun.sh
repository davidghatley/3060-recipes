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
# Test runs use their own port (other sessions on this box serve on 8081, 8085 and 8091); serve.sh, srvtest.py and codeeval.py read INK_PORT.
export INK_PORT=${INK_PORT:-8097}
log="${INK_LOGDIR:-$ROOT/runs}/server-$label.log"
setsid "$SERVE" "${sargs[@]}" > "$log" 2>&1 < /dev/null &
top=$!
descendants() { local p; for p in $(pgrep -P "$1"); do echo "$p"; descendants "$p"; done; }
stop() {
  local pids p
  pids="$top $(descendants "$top")"     # $top is llama-server itself when serve.sh runs without gpu_run (INK_NO_GPU_RUN)
  for p in $pids; do [ "$(cat /proc/$p/comm 2>/dev/null)" = llama-server ] && kill -INT "$p" 2>/dev/null; done
  for _ in $(seq 60); do kill -0 "$top" 2>/dev/null || return 0; sleep 1; done
  echo "server did not exit after 60 s (pid $top)" >&2
}
trap stop EXIT
for _ in $(seq 7200); do
  # healthy only if OUR server bound the port (its own log says so): another session's server on the same port must not pass for ours
  grep -q "listening on http://127.0.0.1:$INK_PORT\$" "$log" 2>/dev/null && curl -sf "http://127.0.0.1:$INK_PORT/health" > /dev/null && break
  kill -0 "$top" 2>/dev/null || { echo "server exited during load:"; tail -20 "$log"; exit 1; }
  sleep 1
done
echo "$label ready; vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
if [ -n "${INK_TEST:-}" ]; then (cd "$ROOT" && eval "$INK_TEST"); else python3 -I "$ROOT/tools/srvtest.py" --label "$label" "${targs[@]}"; fi
echo "$label done; vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
