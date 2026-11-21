#!/usr/bin/env bash
# GPU session: is the cold readout stable across repeats and micro-batch sizes? (cached vs cold differed by up to 0.46)
set -uo pipefail
here=$(cd "$(dirname "$0")/../.." && pwd)
rows=/mnt/work/jev-index/splits-ink/calib.jsonl.gz
out=$here/runs/eval/readout
ref=$out/default-3pass.json
py=/mnt/work/jev-index/venv/bin/python
run() {  # label then env assignments / server args
  local label=$1; shift
  [ -f "$out/$label-b.json" ] && { echo "$label already done"; return 0; }
  env "${ENVS[@]}" "$here/serve.sh" "$@" > "$out/server-$label.log" 2>&1 &
  local gp=$!
  for i in $(seq 1 720); do curl -s -m 2 127.0.0.1:8085/health | grep -q '"ok"' && break; kill -0 $gp 2>/dev/null || { echo "$label server died"; return 1; }; sleep 5; done
  local sp; sp=$(pgrep -x llama-server | while read p; do tr "\\0" " " < /proc/$p/cmdline | grep -q -- "--port 8085" && echo $p; done | head -1)
  echo "$label up $(date +%T)"
  "$py" -I "$here/eval/tools/probe_cold.py" "$rows" "$ref" "$out/$label-a.json" --label "$label-a"
  "$py" -I "$here/eval/tools/probe_cold.py" "$rows" "$ref" "$out/$label-b.json" --label "$label-b"
  [ -n "$sp" ] && kill "$sp"; wait $gp 2>/dev/null; sleep 3
}
ENVS=(INK_DUMMY=1); run cold-ub128
ENVS=(INK_UBATCH=512 INK_CONTEXT=16384); run cold-ub512
ENVS=(INK_UBATCH=2048 INK_BATCH=2048 INK_CONTEXT=8192); run cold-ub2048
for x in cold-ub128-a cold-ub128-b cold-ub512-a cold-ub2048-a; do "$py" -I "$here/eval/tools/compare_readouts.py" "$ref" "$out/$x.json"; done
"$py" -I "$here/eval/tools/compare_readouts.py" "$out/cold-ub128-a.json" "$out/cold-ub128-b.json"
"$py" -I "$here/eval/tools/compare_readouts.py" "$out/cold-ub512-a.json" "$out/cold-ub2048-a.json"
echo done $(date +%T)
