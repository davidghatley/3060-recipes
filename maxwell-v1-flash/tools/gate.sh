#!/usr/bin/env bash
# Test command for ../scripts/with_server.sh (reads PORT and LABEL). One mode per server start.
#   speed   : 2 cold 8k prompts (prefill, TTFT) + 6 capped coding answers at empty context (decode), thinking off
#   deep    : 6 capped coding answers after 32k of context + needles at NEEDLES (default 32k, 62k = ~50% / ~95% of 64k)
#   pp      : cold prefill at PP (default 8000,32000,62000)
#   needles : needles only;  load : nothing (load + VRAM only)
#   code    : scripts/codeeval.py (thinking per the server's --chat-template-kwargs);  refusal : scripts/refusal_probe.py
#   quality : code + refusal
# Speed and needles use tools/srvtest.py (llama-server's own timings, never streamed chunks).
# At the end it records the server's cgroup memory peak (page cache included), RSS high-water mark and VRAM.
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
mode=${1:?mode}; url=http://127.0.0.1:$PORT
host() { printf '{"label": "%s", "case": "host-%s", "t": %s, "loadavg": "%s", "compilers": %d, "vram_mib": %s}\n' "$LABEL" "$1" "$(date +%s)" \
  "$(cut -d' ' -f1-3 /proc/loadavg)" "$(ps -eo comm= | grep -cE '^(cicc|ptxas|cc1plus|nvcc|ninja)$' || true)" \
  "$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits)" | tee -a "$R/runs/ledger.jsonl"; }
host start
printf '{"label": "%s", "case": "lora-adapters", "t": %s, "adapters": %s}\n' "$LABEL" "$(date +%s)" "$(curl -sf "$url/lora-adapters" || echo null)" | tee -a "$R/runs/ledger.jsonl"
srv() { python3 -I "$R/tools/srvtest.py" --url "$url" --label "$LABEL" --ledger "$R/runs/ledger.jsonl" "$@"; }
case "$mode" in
  speed) srv --pp 8000 --depths 0 --reps "${REPS:-6}" ;;
  deep) srv --pp "" --depths "${DEPTH:-32000}" --reps "${REPS:-6}" --needles "${NEEDLES:-32000,62000}" ;;
  pp) srv --pp "${PP:-8000,32000,62000}" --depths "" ;;
  needles) srv --pp "" --depths "" --needles "${NEEDLES:-32000,62000}" ;;
  load) : ;;
  code) python3 -I "$R/../scripts/codeeval.py" --url "$url" --out "$R/runs" --label "$LABEL" --max "${CODE_MAX:-2048}" ;;
  quality|refusal)
    [ "$mode" = quality ] && python3 -I "$R/../scripts/codeeval.py" --url "$url" --out "$R/runs" --label "$LABEL" --max "${CODE_MAX:-2048}"
    python3 -I "$R/../scripts/refusal_probe.py" --url "$url" --label "$LABEL" --out "$R/runs" --max-tokens "${REF_MAX:-1024}" ;;
  *) echo "mode: speed|deep|pp|needles|load|code|quality|refusal" >&2; exit 2 ;;
esac
host end
pid=$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
if [ -n "$pid" ]; then
  cg=$(cut -d: -f3 "/proc/$pid/cgroup"); f=/sys/fs/cgroup$cg/memory.peak
  peak=$(cat "$f" 2>/dev/null || echo 0); rss=$(awk '/VmHWM/{print $2}' "/proc/$pid/status")
  vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits)
  printf '{"label": "%s", "case": "mem-%s", "t": %s, "cgroup_peak_mib": %d, "rss_hwm_mib": %d, "vram_mib": %s}\n' \
    "$LABEL" "$mode" "$(date +%s)" $((peak/1048576)) $((rss/1024)) "$vram" | tee -a "$R/runs/ledger.jsonl"
fi
