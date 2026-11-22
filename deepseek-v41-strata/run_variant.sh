#!/usr/bin/env bash
# Start the Strata DeepSeek server with one engine variant, benchmark it, stop it. Run this inside gpu_run:
#   GPU_RUN_MEM=44G ~/anime-pipeline/tools/gpu_run --free --need 11000 deepseek-v41-strata/run_variant.sh LABEL [engine args...]
# Engine args are appended to the setup-written ones (later flags win), e.g.  --experts 6 --dspark off
# BENCH_ARGS passes extra options to scripts/bench.py (e.g. BENCH_ARGS="--cases chat --runs 2").
set -euo pipefail
LABEL=$1; shift
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(dirname "$HERE")
OUT=$HERE/runs; mkdir -p "$OUT"
BASE_CFG=$HOME/.local/share/strata/install/strata-deepseek-v4.1-flash-ist-das-2.00bpw.json
STRATA=/mnt/models/llm/strata/terminal/0.1.54
CFG=$OUT/$LABEL.config.json
LOG=$OUT/$LABEL.server.log
PORT=8080

# Variant config: same as setup's, but text only, with this variant's flags, and its own engine log.
python3 -I - "$BASE_CFG" "$CFG" "$OUT/$LABEL.engine.log" "$@" <<'EOF'
import json, sys
base, out, log, extra = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
c = json.load(open(base))
c["args"] = c["args"] + ["--vision", "off"] + extra
c["log"] = log
json.dump(c, open(out, "w"), indent=1)
EOF

# Another server already on the port would answer our readiness checks and take the benchmark.
curl -sf -m 3 http://127.0.0.1:$PORT/v1/models >/dev/null && { echo "port $PORT is already in use; not starting $LABEL"; exit 1; }
echo "[$(date +%T)] start $LABEL: $*" | tee "$LOG"
cd "$STRATA"
"$STRATA/python/bin/python3.12" "$STRATA/serve/server.py" --engine strata --config "$CFG" --port $PORT >>"$LOG" 2>&1 &
SRV=$!
# Stop the front end and any engine process it started, so nothing outlives the gpu_run session.
stop() { local kids; kids=$(pgrep -P $SRV || true); kill $SRV $kids 2>/dev/null; wait $SRV 2>/dev/null || true
  [ -z "$kids" ] && return 0
  local k alive; for _ in $(seq 30); do alive=0; for k in $kids; do kill -0 "$k" 2>/dev/null && alive=1; done
    [ $alive = 0 ] && return 0; sleep 1; done; kill -9 $kids 2>/dev/null || true; }
trap stop EXIT

t0=$(date +%s)
until curl -sf -m 5 http://127.0.0.1:$PORT/v1/models >/dev/null; do
  kill -0 $SRV 2>/dev/null || { echo "server died during load"; tail -30 "$LOG"; exit 1; }
  sleep 5
done
# The HTTP side can be up before the engine: a 1-token request waits for the engine to be ready.
curl -s -m 3600 http://127.0.0.1:$PORT/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"x","messages":[{"role":"user","content":"Say OK."}],"max_tokens":8,"reasoning_effort":"low"}' >"$OUT/$LABEL.warmup.json"
echo "[$(date +%T)] ready after $(( $(date +%s) - t0 )) s; vram $(nvidia-smi --query-gpu=memory.used --format=csv,noheader); rss $(ps -o rss= --ppid $SRV --pid $SRV | awk '{s+=$1} END {printf "%.1f GiB", s/1048576}')" | tee -a "$LOG"

python3 -I "$REPO/scripts/bench.py" --url http://127.0.0.1:$PORT --label "$LABEL" --out "$OUT" ${BENCH_ARGS:-} | tee "$OUT/$LABEL.bench.txt"
echo "[$(date +%T)] done $LABEL" | tee -a "$LOG"
