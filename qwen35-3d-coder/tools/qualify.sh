#!/usr/bin/env bash
# Start serve.sh exactly as shipped (port 8083), run tools/qualify.py against it, stop it with SIGINT.
#   tools/qualify.sh [--scene-only] [--scenes N]   -> runs/qualify.json (or $QUALIFY_OUT), runs/qualify-server.log,
#   runs/qualify-scene-<id>.txt
set -uo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
setsid ./serve.sh > runs/qualify-server.log 2>&1 < /dev/null &
for _ in $(seq 900); do curl -sf http://127.0.0.1:8083/health >/dev/null && break; sleep 2; done
pid=$(pgrep -n -f "[l]lama-server -m .* --alias qwen35-3d-coder")
echo "server pid $pid $(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
python3 -I tools/qualify.py --url http://127.0.0.1:8083 "$@" > "${QUALIFY_OUT:-runs/qualify.json}"; rc=$?
echo "vram after: $(nvidia-smi --query-gpu=memory.used --format=csv,noheader)" | tee -a runs/qualify-server.log
kill -INT "$pid"; for _ in $(seq 60); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
echo "qualify exit $rc"
