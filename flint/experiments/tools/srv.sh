#!/usr/bin/env bash
# Start flint/serve.sh (unchanged) with env overrides + extra args, wait for health, run tests, stop cleanly.
#   [FLINT_CONTEXT=.. FLINT_CPU_MOE=.. FLINT_MODEL=..] TESTS="pre-probes|servertest-args|post-probes" [EXTRA='cmd "$1"'] tools/srv.sh <label> [-- extra llama-server args]
# servertest results -> runs/server-ledger.jsonl, probe results -> runs/exp5-ledger.jsonl, log -> runs/server-<label>.log
set -euo pipefail
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd); FLINT=$(dirname "$HERE")
label=${1:?label}; shift; [ "${1:-}" = "--" ] && shift
export FLINT_SPEC=${FLINT_SPEC:-none}
log="$HERE/runs/server-$label.log"
url="http://127.0.0.1:${FLINT_PORT:-8081}"
"$HERE/tools/quiet.sh" || { echo "CPU not quiet"; exit 3; }
setsid "$FLINT/serve.sh" "$@" > "$log" 2>&1 < /dev/null &
top=$!
descendants() { local p; for p in $(pgrep -P "$1"); do echo "$p"; descendants "$p"; done; return 0; }
ours() { local p; for p in $(descendants "$top"); do [ "$(cat /proc/$p/comm 2>/dev/null)" = llama-server ] && echo "$p"; done; return 0; }
stop() {
  local p srv; srv=$(ours)
  # Still queued in gpu_run (no llama-server yet): end the launcher so no server starts after we are gone.
  if [ -z "$srv" ]; then kill -TERM $(descendants "$top") "$top" 2>/dev/null; else for p in $srv; do kill -INT "$p" 2>/dev/null; done; fi
  for _ in $(seq 60); do kill -0 "$top" 2>/dev/null || return 0; sleep 1; done
  echo "server did not exit after 60 s (pid $top); sending TERM" >&2
  for p in $(ours) "$top"; do kill -TERM "$p" 2>/dev/null; done
  for _ in $(seq 30); do kill -0 "$top" 2>/dev/null || return 0; sleep 1; done
  echo "server still running after TERM (pid $top)" >&2; return 1
}
trap stop EXIT; trap 'exit 143' TERM; trap 'exit 130' INT  # exit runs the EXIT trap
for _ in $(seq $(( ${FLINT_GPU_WAIT:-120} + 900 ))); do  # lock wait + load
  # Trust health only from our own server: another session's server can hold the same port while we queue.
  [ -n "$(ours)" ] && curl -sf "$url/health" > /dev/null && curl -sf "$url/v1/models" | grep -q '"flint-local"' && break
  kill -0 "$top" 2>/dev/null || { echo "server exited during load:"; grep -E " E |error" "$log" | tail -5; exit 1; }
  sleep 1
done
{ [ -n "$(ours)" ] && curl -sf "$url/health" > /dev/null; } || { echo "$label: server never became healthy"; exit 1; }
echo "$label ready (pid $(ours)); vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
grep -E "MoE cache size|KV buffer size|compute buffer size|model buffer size" "$log" | sed 's/^/  /' | head -8
IFS='|' read -r PRE ST POST <<< "${TESTS:-warmup|--reps 4 --skip code|greedy,depth}"
[ -n "$PRE" ] && python3 -I "$HERE/tools/exp5probe.py" --url "$url" --label "$label" --cases "$PRE"
[ -n "$ST" ] && python3 -I "$FLINT/tools/servertest.py" --url "$url" --label "$label" --ledger "$HERE/runs/server-ledger.jsonl" $ST
[ -n "$POST" ] && python3 -I "$HERE/tools/exp5probe.py" --url "$url" --label "$label" --cases "$POST"
# EXTRA: one more command against the live server, e.g. the shared code eval (label is passed as $1).
[ -n "${EXTRA:-}" ] && bash -c "$EXTRA" _ "$label"
echo "$label done; vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
# Flag runs that shared the GPU with another compute job (other sessions don't always take the lock).
others=$(nvidia-smi --query-compute-apps=pid,process_name --format=csv,noheader | grep -v -E "llama-server|comfyui|main.py|helium|--type=gpu-process" || true)
[ -n "$others" ] && echo "$label CONTAMINATED: other GPU compute jobs at the end of the run: $others"
stop; trap - EXIT
grep -oE "llama_moe_cache: (ubatch|large).*" "$log" | sed "s/^/  /" || true
