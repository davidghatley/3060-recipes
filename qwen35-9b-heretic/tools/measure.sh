#!/usr/bin/env bash
# Full measurement set against a running server on $PORT (run it as the test command of tools/srv.sh).
#   tools/measure.sh <label> <window-tokens> [noeval] [refusal]
# prefill at 8k / 32k / near the window (x2 cold), decode at empty context and near the window (x6 x256, thinking off),
# decode thinking on (x6 x512), needles at ~50% and ~95% of the window, codeeval (8 tasks, temp 0, thinking on as
# served, 6000-token cap; bare-code-accepted rescoring by tools/codeeval_lenient.py only if a strict fail had no
# fence), greedy prompts, memory, and the refusal probe when asked (thinking off at 400 tokens and thinking on at 3000).
set -u
cd "$(dirname "$0")/.."
l=$1; w=$2; shift 2
near=$(( w * 92 / 100 )); half=$(( w / 2 )); n95=$(( w * 95 / 100 - 600 ))
pp=8000; [ "$w" -gt 40000 ] && pp+=",32000"; pp+=",$near"
python3 -I tools/srvtest.py --label "$l" --reps 6 --max 256 --pp "$pp" --depths "0,$near" --needles "$half,$n95"
python3 -I tools/srvtest.py --label "$l-think" --think on --reps 6 --max 512 --depths 0
case " $* " in *" noeval "*) ;; *)
  python3 -I ../scripts/codeeval.py --url "http://127.0.0.1:$PORT" --out runs --label "$l" --max 6000 | tail -9
  if grep -q '"no code block"' "runs/codeeval-$l.json"; then
    python3 -I tools/codeeval_lenient.py --label "$l" --think on --max 6000 | tail -1; fi
  python3 -I tools/greedy.py --label "$l" --out runs/greedy --max 300 | cut -c1-120 ;; esac
case " $* " in *" refusal "*)
  python3 -I ../scripts/refusal_probe.py --url "http://127.0.0.1:$PORT" --label "$l-think" --out runs --max-tokens 3000 | tail -1 ;; esac
tools/mem.sh "$l"
