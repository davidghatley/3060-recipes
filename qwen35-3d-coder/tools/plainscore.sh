#!/usr/bin/env bash
# Re-score every finished render-comparison page on the shipped no-spec server (tools/plainscore.py), in gpu-share
# sessions of of about 24-30 min (the deadline is checked between pages), resuming until every page is done. Then print the per-arm report.
set -uo pipefail
cd "$(dirname "$0")/.."
RUNS="runs/eval-rc-mtp-s1 runs/eval-rc-none-s1 runs/eval-rc-mtp-s2 runs/eval-rc-none-s2"
OUT=runs/plainscore; mkdir -p "$OUT"
export QC_GPU_WAIT=${QC_GPU_WAIT:-3600}
todo() { python3 -I tools/plainscore.py todo --runs $RUNS --out "$OUT"; }
for s in 1 2 3 4 5 6; do
  [ "$(todo)" = 0 ] && break
  echo "== $(date +%T) session $s, $(todo) pages left"
  QC_SPEC=none tools/with_server.sh "$OUT/server-b$s.log" -- python3 -I tools/plainscore.py score \
    --url "http://127.0.0.1:${QC_PORT:-8090}" --runs $RUNS --out "$OUT" --deadline-min 24
done
python3 -I tools/plainscore.py report --out "$OUT" | tee "$OUT/report.txt"
