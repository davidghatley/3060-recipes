#!/usr/bin/env bash
# Start serve.sh (env overrides as given, e.g. QC_SPEC=draft-mtp QC_BIN=...) on port $QC_PORT (default 8090), run a
# command against it, then stop the server with SIGINT and wait for it to exit.
#   QC_SPEC=draft-mtp tools/with_server.sh runs/x-server.log -- python3 -I tools/mtp_repro.py gen ...
set -uo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
log=$1; shift; [ "$1" = "--" ] && shift
export QC_PORT=${QC_PORT:-8090}
setsid ./serve.sh > "$log" 2>&1 < /dev/null &
ok=0
for _ in $(seq 900); do curl -sf "http://127.0.0.1:$QC_PORT/health" >/dev/null && { ok=1; break; }; sleep 2; done
pid=$(pgrep -n -f "[l]lama-server -m .* --port $QC_PORT")
[ "$ok" = 1 ] || { echo "server did not come up (see $log)"; [ -n "$pid" ] && kill -INT "$pid"; exit 1; }
echo "server pid $pid spec=${QC_SPEC:-none} bin=${QC_BIN:-default} $(nvidia-smi --query-gpu=memory.used,temperature.gpu --format=csv,noheader)"
"$@"; rc=$?
kill -INT "$pid"; for _ in $(seq 60); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
echo "command exit $rc"
exit $rc
