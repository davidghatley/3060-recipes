#!/usr/bin/env bash
# Round 2 batch 4/5: round-1 server gate (pp 8k/32k, decode at 0/32k, needles 32k/62k) + 8-task coding eval for one or more
# Unsloth quants at 64k, on the build of the shipped IQ4_NL config (master 225a5345b + F16 mask patches).
#   batch4.sh <label>:<quant>:<placement>:<ubatch>[:<ot>] ...
cd "$(dirname "$0")/../.."
export INK_BIN=${INK_BIN:-/mnt/scratch/llama.cpp/r2inkfix-19c41d2ff/bin}
U=/mnt/models/llm/inkling-2-mini/unsloth/Mainline_Support
for spec in "$@"; do
  IFS=: read -r label q place ub ot <<< "$spec"
  echo "#### $(date +%T) $label"
  e=(INK_MODEL="$U/Inkling-2-Mini-UD-$q.gguf" INK_PLACEMENT="$place" INK_UBATCH="$ub"); [ -n "${ot:-}" ] && e+=(INK_OT="$ot")
  env "${e[@]}" INK_TEST="python3 -I tools/srvtest.py --label $label --reps 3 --pp 8000,32000 --depths 0,32000 --needles 32000,62000 && python3 -I tools/codeeval.py --label $label" \
    tools/serverrun.sh "$label"; echo "   exit $?"
done
echo "#### done $(date +%T)"
