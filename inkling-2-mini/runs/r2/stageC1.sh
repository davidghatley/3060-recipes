#!/usr/bin/env bash
# Round 2, step 2: llama-bench of the 2-bit quants fully on the GPU, stock master 225a5345b, IQ4_NL tuned controls at both ends.
cd "$(dirname "$0")/../.."
until grep -q "^== done" runs/r2/stageB2.log; do sleep 10; done
export INK_BIN=/mnt/scratch/llama.cpp/master-225a5345b/bin
U=/mnt/models/llm/inkling-2-mini/unsloth/Mainline_Support
CORE='blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'
KV="-ctk q8_0 -ctv q8_0 -b 2048 -p 2048 -n 64 -r 6"
echo "== $(date +%T) ctl";  tools/bench.sh r2c-1-ctl-iq4nl -ot "$CORE" $KV -ub 128
for q in IQ2_XXS Q2_K_XL; do
  echo "== $(date +%T) $q ub128"; INK_MODEL=$U/Inkling-2-Mini-UD-$q.gguf tools/bench.sh r2c-$q-gpu-ub128 $KV -ub 128
  echo "== $(date +%T) $q ub512"; INK_MODEL=$U/Inkling-2-Mini-UD-$q.gguf tools/bench.sh r2c-$q-gpu-ub512 $KV -ub 512
done
echo "== $(date +%T) ctl";  tools/bench.sh r2c-9-ctl-iq4nl -ot "$CORE" $KV -ub 128
echo "== done $(date +%T)"
