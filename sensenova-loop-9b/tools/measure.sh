#!/usr/bin/env bash
# Full measurement set against a running server on $PORT (run it as the test command of tools/srv.sh).
#   tools/measure.sh <label> <window-tokens> [refusal] [noeval]
# prefill at 8k / 32k (if it fits) / near the window, decode at empty context and near the window (x6), needles at
# ~50% and ~95% of the window, codeeval (8 tasks, temp 0), greedy prompts, and the refusal probe when asked.
set -u
cd "$(dirname "$0")/.."
l=$1; w=$2; shift 2
near=$(( w * 92 / 100 )); half=$(( w / 2 )); n95=$(( w * 95 / 100 - 600 ))
pp=8000; [ "$w" -gt 40000 ] && pp+=",32000"; pp+=",$near"
python3 -I tools/srvtest.py --label "$l" --reps 6 --max 256 --pp "$pp" --depths "0,$near" --needles "$half,$n95"
case " $* " in *" noeval "*) ;; *)
  python3 -I ../scripts/codeeval.py --url "http://127.0.0.1:$PORT" --out runs --label "$l" --max 2048 | tail -3
  python3 -I tools/greedy.py --label "$l" --out runs/greedy --max 300 | cut -c1-120 ;; esac
case " $* " in *" refusal "*) python3 -I ../scripts/refusal_probe.py --url "http://127.0.0.1:$PORT" --label "$l" --out runs | tail -3 ;; esac
tools/mem.sh "$l"
