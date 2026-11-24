#!/usr/bin/env bash
# Test command for ../scripts/with_server.sh (reads PORT and LABEL). One mode per GPU-lock hold, each under ~30 min.
#   speed   : 2 cold 8k prompts (prefill, TTFT) + 6 capped coding answers at empty context (decode)
#   deep    : 6 capped coding answers after 32k of context + needles in a ~32k and a ~62k prompt (50% / 95% of 64k)
#   quality : scripts/codeeval.py + scripts/refusal_probe.py (+ tools/smoke.py --image when MMPROJ_SMOKE=1)
#   code    : scripts/codeeval.py only
#   refusal : refusal_probe only
# Speed and needles use ../inkling-2-mini/tools/srvtest.py unchanged, so numbers compare with the base recipe's.
# At the end it records the server's cgroup memory peak (gpu_run's memcap scope, page cache included) and VRAM.
set -euo pipefail
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
mode=${1:?mode}; url=http://127.0.0.1:$PORT
# host state: other sessions compile CUDA here (cicc/ptxas/cc1plus); a speed run with them active is void
host() { printf '{"label": "%s", "case": "host-%s", "t": %s, "loadavg": "%s", "compilers": %d}\n' "$LABEL" "$1" "$(date +%s)" \
  "$(cut -d' ' -f1-3 /proc/loadavg)" "$(ps -eo comm= | grep -cE '^(cicc|ptxas|cc1plus|nvcc|ninja)$' || true)" | tee -a "$R/runs/ledger.jsonl"; }
host start
# which adapters the server really applies (llama-server lists them with their scales)
printf '{"label": "%s", "case": "lora-adapters", "t": %s, "adapters": %s}\n' "$LABEL" "$(date +%s)" "$(curl -sf "$url/lora-adapters" || echo null)" | tee -a "$R/runs/ledger.jsonl"
srv() { python3 -I "$R/../inkling-2-mini/tools/srvtest.py" --url "$url" --label "$LABEL" --ledger "$R/runs/ledger.jsonl" "$@"; }
case "$mode" in
  speed) srv --pp 8000 --depths 0 --reps "${REPS:-6}" ;;
  deep) srv --pp "" --depths 32000 --reps "${REPS:-6}" --needles "${NEEDLES:-32000,62000}" ;;
  needles) srv --pp "" --depths "" --needles "${NEEDLES:-32000,62000}" ;;
  code) python3 -I "$R/../scripts/codeeval.py" --url "$url" --out "$R/runs" --label "$LABEL" ;;
  quality|refusal)
    [ "$mode" = quality ] && python3 -I "$R/../scripts/codeeval.py" --url "$url" --out "$R/runs" --label "$LABEL"
    python3 -I "$R/../scripts/refusal_probe.py" --url "$url" --label "$LABEL" --out "$R/runs" --max-tokens "${REF_MAX:-1024}"
    if [ -n "${MMPROJ_SMOKE:-}" ]; then python3 -I "$R/../inkling-2-mini/tools/smoke.py" --url "$url" --image > "$R/runs/smoke-$LABEL.json"; fi ;;
  smoke) python3 -I "$R/../inkling-2-mini/tools/smoke.py" --url "$url" ${MMPROJ_SMOKE:+--image} > "$R/runs/smoke-$LABEL.json"; cat "$R/runs/smoke-$LABEL.json" ;;
  *) echo "mode: speed|deep|needles|code|quality|refusal|smoke" >&2; exit 2 ;;
esac
host end
# cgroup peak of our llama-server (the one listening on $PORT)
pid=$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
if [ -n "$pid" ]; then
  cg=$(cut -d: -f3 "/proc/$pid/cgroup"); f=/sys/fs/cgroup$cg/memory.peak
  peak=$(cat "$f" 2>/dev/null || echo 0); rss=$(awk '/VmHWM/{print $2}' "/proc/$pid/status")
  vram=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits)
  printf '{"label": "%s", "case": "mem-%s", "t": %s, "cgroup_peak_mib": %d, "rss_hwm_mib": %d, "vram_mib": %s}\n' \
    "$LABEL" "$mode" "$(date +%s)" $((peak/1048576)) $((rss/1024)) "$vram" | tee -a "$R/runs/ledger.jsonl"
fi
