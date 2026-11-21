#!/usr/bin/env bash
# GPU session: readout exactness on the default build, then the patched build (73e22d20a) at 3, 2 and 1 loop passes.
# Starts and stops its own servers (by PID, matched on the port). serve.sh defaults are untouched; the patched
# build and pass count are run-time overrides (INK_BIN, --override-kv).
set -uo pipefail
here=$(cd "$(dirname "$0")/../.." && pwd)
rows=${ROWS:-/mnt/work/jev-index/splits-ink/calib.jsonl.gz}
out=$here/runs/eval/readout
mkdir -p "$out"
py=/mnt/work/jev-index/venv/bin/python
newbin=/mnt/scratch/llama.cpp/inkfix-loop-73e22d20a/bin

serve_and_check() {  # label n bin [server args...]
  local label=$1 n=$2 bin=$3; shift 3
  local log=$out/server-$label.log
  INK_BIN=$bin "$here/serve.sh" "$@" > "$log" 2>&1 &
  local gp=$!
  for i in $(seq 1 720); do
    curl -s -m 2 127.0.0.1:8085/health | grep -q '"ok"' && break
    kill -0 $gp 2>/dev/null || { echo "$label: server exited (see $log)"; return 1; }
    sleep 5
  done
  local sp; sp=$(pgrep -x llama-server | while read p; do tr "\\0" " " < /proc/$p/cmdline | grep -q -- "--port 8085" && echo $p; done | head -1)
  echo "$label: server pid $sp up at $(date +%T)"
  grep -m3 -i "loop\|n_passes\|single pass" "$log" | cut -c1-160
  "$py" -I "$here/eval/tools/check_readout.py" "$rows" "$out/$label.json" --n "$n" --label "$label" > "$out/$label.out" 2>&1
  echo "$label: check rc=$? at $(date +%T)"; tail -12 "$out/$label.out"
  [ -n "$sp" ] && kill "$sp"; wait $gp 2>/dev/null; sleep 3
}

serve_and_check default-3pass 40 /mnt/scratch/llama.cpp/inkfix-4c836a8eb/bin
serve_and_check patched-3pass 20 "$newbin"
serve_and_check patched-2pass 10 "$newbin" --override-kv inkling2_loop.loop.count=int:2
serve_and_check patched-1pass 10 "$newbin" --override-kv inkling2_loop.loop.count=int:1
for l in patched-3pass patched-2pass patched-1pass; do
  [ -f "$out/$l.json" ] && "$py" -I "$here/eval/tools/compare_readouts.py" "$out/default-3pass.json" "$out/$l.json"
done
echo "session done $(date +%T)"
