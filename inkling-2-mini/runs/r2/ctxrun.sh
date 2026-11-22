#!/usr/bin/env bash
# Round 2: does a context size RUN (a real long request, not just a load)? One or more specs inside a gpu_batch session.
#   ctxrun.sh <label>:<build>:<quant>:<placement>:<ctx>:<kv>:<ub>:<needle sizes, + separated>[:<ot>[:<extra server args>]] ...
# quant: iq4nl | IQ2_XXS | Q2_K_XL | IQ3_XXS.   Each run: 3 capped coding answers at empty context, then the needle prompts.
cd "$(dirname "$0")/../.."
U=/mnt/models/llm/inkling-2-mini/unsloth/Mainline_Support
for spec in "$@"; do
  IFS=: read -r label build q place ctx kv ub needles ot extra <<< "$spec"
  model=$U/Inkling-2-Mini-UD-$q.gguf; [ "$q" = iq4nl ] && model=/mnt/models/llm/inkling-2-mini/Inkling-2-Mini-IQ4_NL.gguf
  echo "#### $(date +%T) $label ($build, $q, $place, ctx $ctx, kv $kv, ub $ub)"
  e=(INK_BIN=/mnt/scratch/llama.cpp/$build/bin INK_MODEL="$model" INK_PLACEMENT="$place" INK_CONTEXT="$ctx" INK_KV="$kv" INK_UBATCH="$ub")
  [ -n "${ot:-}" ] && e+=(INK_OT="$ot")
  # shellcheck disable=SC2086
  env "${e[@]}" tools/serverrun.sh "$label" --reps 3 --pp "${CTX_PP:-}" --depths 0 --needles "${needles//+/,}" -- $extra
  rc=$?; echo "   exit $rc $(grep -m1 -oE 'out of memory|cudaGraphInstantiate' runs/server-$label.log | tr '\n' ' ')"
done
echo "#### done $(date +%T)"
