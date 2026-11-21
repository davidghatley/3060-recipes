#!/usr/bin/env bash
# One GPU batch (<= INK_EVAL_SECONDS, default 1700 s) of an Inkling eval run, then free the GPU.
# Starts ./serve.sh (defaults untouched; extra args such as --override-kv go after --), runs the kit with resume,
# stops the server it started (by PID), and exits 0 when the run is complete, 10 when more batches are needed.
#
# usage: eval/run_batch.sh ROWS OUT_DIR [engine options as key=value ...] [-- llama-server args]
# env:   INK_BIN (default serve.sh's), INK_EVAL_SECONDS, KIT_VENV
set -uo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
rows=$1; out=$2; shift 2
opts=(); srv=()
while [ $# -gt 0 ]; do
  if [ "$1" = -- ]; then shift; srv=("$@"); break; fi
  opts+=(--option "$1"); shift
done
venv=${KIT_VENV:-/mnt/work/jev-index/venv}
port=${INK_PORT:-8085}
mkdir -p "$out" "$here/runs/eval"
log="$here/runs/eval/server-$(date +%Y%m%d-%H%M%S).log"
"$here/serve.sh" "${srv[@]}" > "$log" 2>&1 &
gp=$!
for i in $(seq 1 720); do
  curl -s -m 2 "127.0.0.1:$port/health" | grep -q '"ok"' && break
  kill -0 $gp 2>/dev/null || { echo "server exited, see $log" >&2; exit 2; }
  sleep 5
done
echo "server up ($log)"
srvpid=$(pgrep -x llama-server | while read p; do tr "\\0" " " < /proc/$p/cmdline | grep -q -- "--port $port" && echo $p; done | head -1)
echo "llama-server pid $srvpid"
timeout --signal=INT "${INK_EVAL_SECONDS:-1700}" "$venv/bin/python" -I "$here/eval/run_kit.py" run \
  --engine engines.inkling:InklingEngine --option base_url=http://127.0.0.1:$port "${opts[@]}" \
  --edition 0.3 --suite-dir /mnt/work/jev-index/suite-0.3 --no-verify --rows "$rows" --out "$out" >> "$out/kit.log" 2>&1
rc=$?
# stop only the server this script started
[ -n "$srvpid" ] && kill "$srvpid"
wait $gp 2>/dev/null
total=$(python3 -c "import gzip,sys;print(sum(1 for _ in (gzip.open if sys.argv[1].endswith('.gz') else open)(sys.argv[1],'rt')))" "$rows")
done_n=$(python3 -c "import json,sys;print(sum(1 for l in open(sys.argv[1]) if json.loads(l).get('status') in ('ok','unsupported')))" "$out/results.jsonl" 2>/dev/null || echo 0)
echo "kit rc=$rc rows $done_n/$total"
[ "$done_n" -ge "$total" ] && exit 0 || exit 10
