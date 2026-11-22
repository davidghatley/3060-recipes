#!/usr/bin/env bash
# Round 2, step 2: the round-1 server gate (pp 8k/32k, decode at 0/32k, needles 32k/62k) + the 8-task coding eval for each
# Unsloth quant at 64k, on the same build as the shipped IQ4_NL config (master 225a5345b + F16 mask patches).
cd "$(dirname "$0")/../.."
until grep -q "^== done" runs/r2/stageB3.log; do sleep 10; done
export INK_BIN=/mnt/scratch/llama.cpp/r2inkfix-19c41d2ff/bin
U=/mnt/models/llm/inkling-2-mini/unsloth/Mainline_Support
gate() { # label model placement ubatch [ot]
  local label=$1; echo "== $(date +%T) $label"
  local e=(INK_MODEL="$2" INK_PLACEMENT="$3" INK_UBATCH="$4"); [ -n "${5:-}" ] && e+=(INK_OT="$5")
  env "${e[@]}" \
  INK_TEST="python3 -I tools/srvtest.py --label $label --reps 3 --pp 8000,32000 --depths 0,32000 --needles 32000,62000 && python3 -I tools/codeeval.py --label $label" \
    prlimit --core=1 tools/serverrun.sh "$label"; echo "   exit $?"
}
gate r2-iq2xxs-gpu-64k  $U/Inkling-2-Mini-UD-IQ2_XXS.gguf gpu 128
gate r2-q2kxl-gpu-64k   $U/Inkling-2-Mini-UD-Q2_K_XL.gguf gpu 128
grep -q "needle-62k" <(grep '"r2-q2kxl-gpu-64k"' runs/ledger.jsonl) || gate r2-q2kxl-gpu-64k-ub64 $U/Inkling-2-Mini-UD-Q2_K_XL.gguf gpu 64
# IQ3_XXS: core 6-17 + layers 3-5, 18-19 on the GPU, layers 0-2 and 20-23 in RAM
gate r2-iq3xxs-core-64k $U/Inkling-2-Mini-UD-IQ3_XXS.gguf core 128 'blk\.([0-2]|2[0-3])\.ffn_.*_exps=CPU'
echo "== done $(date +%T)"
