#!/usr/bin/env bash
# Round 2 batch 7: ceiling-gap levers where there is VRAM: MoE cache (experts of the RAM layers kept hot in VRAM) and DSpark drafting.
# Decode only (6 capped coding answers at empty context), 32k context so there is room; a control on the same build before and after.
cd "$(dirname "$0")/../.."
L=/mnt/scratch/llama.cpp; U=/mnt/models/llm/inkling-2-mini/unsloth
run() { local label=$1; shift; echo "#### $(date +%T) $label"; env "$@" INK_CONTEXT=32768 tools/serverrun.sh "$label" --reps 6 --pp "" --depths 0 ${SARGS:+-- $SARGS}; echo "   exit $? $(grep -m1 -oE 'out of memory' runs/server-$label.log)"; grep -E "MoE cache size|llama_moe_cache:|draft" runs/server-$label.log | tail -4 | cut -c1-200; }
B=INK_BIN=$L/r2inkfix-19c41d2ff/bin
IQ3=(INK_MODEL=$U/Mainline_Support/Inkling-2-Mini-UD-IQ3_XXS.gguf 'INK_OT=blk\.([0-2]|2[0-3])\.ffn_.*_exps=CPU')
run r2-moe-iq4nl-32k-ctl1 $B
run r2-moe-iq4nl-32k-c768 $B INK_MOE_CACHE_MIB=768
run r2-moe-iq4nl-32k-ctl2 $B
run r2-nvfp4-32k $B INK_QUANT=nvfp4      # the NVFP4 option on the new build, between IQ4_NL controls
run r2-moe-iq4nl-32k-ctl3 $B
run r2-moe-iq3xxs-32k-ctl1 $B "${IQ3[@]}"
run r2-moe-iq3xxs-32k-c768 $B "${IQ3[@]}" INK_MOE_CACHE_MIB=768
run r2-moe-iq3xxs-32k-ctl2 $B "${IQ3[@]}"
D=INK_BIN=$L/dspark-61004ada8/bin
DS="-md $U/dspark-Inkling-2-Mini-Q8_0.gguf --spec-type draft-dspark --spec-draft-n-max 3 -ngld 99"
run r2-dspark-iq4nl-32k-ctl1 $D
SARGS=$DS run r2-dspark-iq4nl-32k-n3 $D
run r2-dspark-iq4nl-32k-ctl2 $D
G=(INK_MODEL=$U/Mainline_Support/Inkling-2-Mini-UD-IQ2_XXS.gguf INK_PLACEMENT=gpu)
run r2-dspark-iq2xxs-32k-ctl1 $D "${G[@]}"
SARGS=$DS run r2-dspark-iq2xxs-32k-n3 $D "${G[@]}"
echo "#### done $(date +%T)"
