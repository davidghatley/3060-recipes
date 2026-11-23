#!/usr/bin/env bash
# Start a serve script, wait until OUR server is healthy, run a test command, then stop the server cleanly.
#
#   PORT=8101 with_server.sh <label> <serve-script> <logdir> [serve args...] -- <test command...>
#
# The serve script must listen on 127.0.0.1:$PORT. The test command runs with PORT and LABEL exported.
#   READY_WAIT=7200   seconds to wait for load (includes any time queued for a shared GPU lock)
#   READY_RE=...      regex the server log must contain before health is trusted (default: llama-server's listen line)
#   SERVER_COMM=...   process name of the server to signal (default llama-server)
# Safety: it only ever signals descendants of the launcher it started. It never matches by port or by name alone,
# and it does not trust a healthy port unless its own log says its own server bound it.
set -euo pipefail
label=${1:?label}; serve=${2:?serve script}; logdir=${3:?log dir}; shift 3
sargs=(); while [ $# -gt 0 ] && [ "$1" != "--" ]; do sargs+=("$1"); shift; done
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "no test command after --" >&2; exit 2; }
: "${PORT:?set PORT}"
export PORT LABEL=$label
comm=${SERVER_COMM:-llama-server}
re=${READY_RE:-"listening on http://127\\.0\\.0\\.1:$PORT\$"}
mkdir -p "$logdir"; log="$logdir/server-$label.log"
setsid "$serve" "${sargs[@]}" > "$log" 2>&1 < /dev/null &
top=$!
descendants() { local p; for p in $(pgrep -P "$1"); do echo "$p"; descendants "$p"; done; }
stop() {
  local pids p found=0
  pids="$top $(descendants "$top")"
  for p in $pids; do
    if [ "$(cat /proc/$p/comm 2>/dev/null)" = "$comm" ]; then found=1; kill -INT "$p" 2>/dev/null || true; fi
  done
  # No server yet: the launcher is still queued. Stop the whole tree, or it starts a server later that nobody owns.
  if [ "$found" = 0 ]; then for p in $pids; do kill -TERM "$p" 2>/dev/null || true; done; fi
  for _ in $(seq 60); do kill -0 "$top" 2>/dev/null || return 0; sleep 1; done
  echo "server did not exit after 60 s (pid $top); stopping its tree" >&2
  for p in $top $(descendants "$top"); do kill -TERM "$p" 2>/dev/null || true; done
  return 0
}
trap stop EXIT
ready=0; t0=$(date +%s)
for _ in $(seq "${READY_WAIT:-7200}"); do
  grep -Eq "$re" "$log" 2>/dev/null && curl -sf "http://127.0.0.1:$PORT/health" > /dev/null && { ready=1; break; }
  kill -0 "$top" 2>/dev/null || { echo "$label: server exited during load:"; tail -20 "$log"; exit 1; }
  sleep 1
done
[ "$ready" = 1 ] || { echo "$label: server not ready after ${READY_WAIT:-7200} s; giving up"; exit 1; }
echo "$label ready after $(( $(date +%s) - t0 )) s"
"$@"
echo "$label done"
