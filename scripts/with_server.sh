#!/usr/bin/env bash
# Start a recipe's serve script, wait until OUR server is healthy, run a test command, then stop the server cleanly.
# Generalised from inkling-2-mini/tools/serverrun.sh so new recipes don't each carry a copy.
#
#   PORT=8101 scripts/with_server.sh <label> <serve-script> <logdir> [serve args...] -- <test command...>
#
# The serve script must listen on 127.0.0.1:$PORT (export whatever env var it reads before calling this) and should
# go through gpu_run itself. The test command runs with PORT and LABEL exported.
#   READY_WAIT=7200   seconds to wait for load (includes time queued for the GPU lock)
#   READY_RE=...      regex the server log must contain before health is trusted (default: llama-server's listen line)
#   SERVER_COMM=...   process name of the server to signal (default llama-server)
set -euo pipefail
label=${1:?label}; serve=${2:?serve script}; logdir=${3:?log dir}; shift 3
sargs=(); while [ $# -gt 0 ] && [ "$1" != "--" ]; do sargs+=("$1"); shift; done
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "no test command after --" >&2; exit 2; }
: "${PORT:?set PORT (each recipe has its own test port)}"
export PORT LABEL=$label
comm=${SERVER_COMM:-llama-server}
re=${READY_RE:-"listening on http://127\\.0\\.0\\.1:$PORT\$"}
mkdir -p "$logdir"; log="$logdir/server-$label.log"
setsid "$serve" "${sargs[@]}" > "$log" 2>&1 < /dev/null &
top=$!
descendants() { local p; for p in $(pgrep -P "$1"); do echo "$p"; descendants "$p"; done; }
stop() {
  local pids p found=0
  pids="$top $(descendants "$top")"       # only ever our own launcher tree: never by port, never by name alone
  for p in $pids; do
    if [ "$(cat /proc/$p/comm 2>/dev/null)" = "$comm" ]; then found=1; kill -INT "$p" 2>/dev/null || true; fi
  done
  # No server yet: the launcher is still queued in gpu_run. Stop the whole tree, or it starts a server later that nobody owns.
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
echo "$label ready after $(( $(date +%s) - t0 )) s (includes any GPU-queue wait); vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
"$@"
echo "$label done; vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
