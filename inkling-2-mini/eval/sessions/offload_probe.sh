#!/usr/bin/env bash
# GPU session: GGML_OP_OFFLOAD_MIN_BATCH=1 (RAM experts always computed on the GPU) at the default ub 128.
# Expect: cold == cold-ub512 bit for bit, and cached == cold, if the < 32-token CPU path explains the differences.
set -uo pipefail
here=$(cd "$(dirname "$0")/../.." && pwd)
rows=/mnt/work/jev-index/splits-ink/calib.jsonl.gz
out=$here/runs/eval/readout
py=/mnt/work/jev-index/venv/bin/python
GGML_OP_OFFLOAD_MIN_BATCH=1 "$here/serve.sh" > "$out/server-offload1.log" 2>&1 &
gp=$!
for i in $(seq 1 720); do curl -s -m 2 127.0.0.1:8085/health | grep -q '"ok"' && break; kill -0 $gp 2>/dev/null || { echo "server died"; exit 1; }; sleep 5; done
sp=$(pgrep -x llama-server | while read p; do tr "\\0" " " < /proc/$p/cmdline | grep -q -- "--port 8085" && echo $p; done | head -1)
grep -c . /proc/$sp/environ >/dev/null; tr "\\0" "\n" < /proc/$sp/environ | grep OFFLOAD
echo "up $(date +%T) pid $sp"
"$py" -I "$here/eval/tools/probe_cold.py" "$rows" "$out/default-3pass.json" "$out/offload1-cold.json" --label offload1-cold
"$py" -I "$here/eval/tools/check_readout.py" "$rows" "$out/offload1-check.json" --n 40 --label offload1-check > "$out/offload1-check.out" 2>&1
tail -10 "$out/offload1-check.out"
[ -n "$sp" ] && kill "$sp"; wait $gp 2>/dev/null
for x in cold-ub512-a cold-ub128-a; do "$py" -I "$here/eval/tools/compare_readouts.py" "$out/$x.json" "$out/offload1-cold.json"; done
echo done $(date +%T)
