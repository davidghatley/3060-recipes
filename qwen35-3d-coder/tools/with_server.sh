#!/usr/bin/env bash
# Start serve.sh (env overrides as given, e.g. QC_SPEC=draft-mtp QC_BIN=...) on port $QC_PORT (default 8090), run a
# command against it, then stop the server with SIGINT and wait for it to exit.
#   QC_SPEC=draft-mtp tools/with_server.sh runs/x-server.log -- python3 -I tools/mtp_repro.py gen ...
# The server is found as a child of our own launcher, never by port: while we queue for the GPU lock, another
# session's server can answer on the same port. If we give up or are killed while still queued, the whole launcher
# tree is ended so no server starts later with nobody to stop it.
set -uo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
log=$1; shift; [ "$1" = "--" ] && shift
export QC_PORT=${QC_PORT:-8090}
setsid ./serve.sh > "$log" 2>&1 < /dev/null &
top=$!
descendants() { local p; for p in $(pgrep -P "$1"); do echo "$p"; descendants "$p"; done; return 0; }
ours() { local p; for p in $(descendants "$top"); do [ "$(cat /proc/$p/comm 2>/dev/null)" = llama-server ] && echo "$p"; done; return 0; }
stop() {
  local p srv; srv=$(ours)
  if [ -z "$srv" ]; then kill -TERM $(descendants "$top") "$top" 2>/dev/null; else for p in $srv; do kill -INT "$p" 2>/dev/null; done; fi
  for _ in $(seq 60); do kill -0 "$top" 2>/dev/null || return 0; sleep 1; done
  echo "server did not exit after 60 s (pid $top); sending TERM" >&2
  for p in $(ours) "$top"; do kill -TERM "$p" 2>/dev/null; done
  return 0
}
trap stop EXIT; trap 'exit 143' TERM; trap 'exit 130' INT  # exit runs the EXIT trap
ok=0
for _ in $(seq $(( ${QC_GPU_WAIT:-120} + 900 ))); do  # lock wait + load
  [ -n "$(ours)" ] && curl -sf "http://127.0.0.1:$QC_PORT/health" >/dev/null && { ok=1; break; }
  kill -0 "$top" 2>/dev/null || break
  sleep 1
done
[ "$ok" = 1 ] || { echo "server did not come up (see $log)"; exit 1; }
echo "server pid $(ours) spec=${QC_SPEC:-none} bin=${QC_BIN:-default} $(nvidia-smi --query-gpu=memory.used,temperature.gpu --format=csv,noheader)"
"$@"; rc=$?
stop; trap - EXIT
echo "command exit $rc"
exit $rc
