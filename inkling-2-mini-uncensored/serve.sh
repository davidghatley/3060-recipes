#!/usr/bin/env bash
# Uncensored Inkling-2-Mini: picks the weights / LoRA for a VARIANT, then execs ../inkling-2-mini/serve.sh,
# so engine build, expert placement, context and KV settings come from the base recipe and cannot drift.
#   VARIANT=atomicchat       AtomicChat's baked AD-Q4_K GGUF, ub 96   [default: 29.6 tok/s, lowest KLD, see RESULTS.md]
#   VARIANT=nokeepai         base IQ4_NL + nokeepai Unbound v2 rank-64 LoRA at runtime (attention only): 27.0 tok/s
#   VARIANT=nokeepai-merged  the same LoRA merged offline into the base IQ4_NL (tools/merge_lora.py): base speed
#   VARIANT=atomicchat-lora  base IQ4_NL + AtomicChat's rank-1 LoRA (attention output + routed experts + token embd)
#   VARIANT=base             base IQ4_NL, no edit (the control)
# Env overrides: UNC_LORA (adapter path), UNC_LORA_SCALE (default 1), UNC_MMPROJ=1 (load the variant's mmproj),
# and everything the base serve.sh honours (INK_MODEL, INK_PORT, INK_BIN, INK_PLACEMENT, INK_OT, INK_UBATCH,
# INK_CONTEXT, INK_KV, INK_MMPROJ, INK_NO_GPU_RUN, ...). Extra args are passed to llama-server.
set -euo pipefail
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
U=/mnt/models/llm/inkling-2-mini-uncensored
B=/mnt/models/llm/inkling-2-mini
VARIANT=${VARIANT:-atomicchat}
d_lora=""; d_ub=""; d_mmproj=$B/mmproj-Inkling-2-Mini-Q8_0.gguf
case "$VARIANT" in
  nokeepai)        d_model=$B/Inkling-2-Mini-IQ4_NL.gguf; d_lora=$U/nokeepai/Inkling-2-Mini-Unbound-v2-LoRA-r64.gguf ;;
  nokeepai-merged) d_model=$U/nokeepai/Inkling-2-Mini-Unbound-v2-r64-merged-IQ4_NL.gguf ;;   # same LoRA merged into the Q8_0 attention tensors (tools/merge_lora.py)
  atomicchat)      d_model=$U/atomicchat/Inkling-2-Mini-Uncensored-AD-Q4_K.gguf
                   d_ub=96   # its core experts are 0.47 GiB bigger than IQ4_NL's: ub 128 runs out of VRAM at load, ub 96 passes 62k
                   # image input at 64k: AtomicChat's F16 projector (610 MiB) does not fit (OOM at load); the base's Q8_0
                   # projector (330 MiB, same vision tower) at ub 64 does, and passes the image test and a 62k needle.
                   # At INK_CONTEXT=32768 (ub 64) the F16 one was tested too: INK_MMPROJ=$U/atomicchat/mmproj-Inkling-2-Mini-Uncensored-F16.gguf
                   [ -n "${UNC_MMPROJ:-}" ] && d_ub=64 ;;
  atomicchat-lora) d_model=$B/Inkling-2-Mini-IQ4_NL.gguf; d_lora=$U/atomicchat/Inkling-2-Mini-Uncensored-LoRA.gguf ;;
  base)            d_model=$B/Inkling-2-Mini-IQ4_NL.gguf ;;
  *) echo "VARIANT must be nokeepai, nokeepai-merged, atomicchat, atomicchat-lora or base" >&2; exit 2 ;;
esac
export INK_MODEL=${INK_MODEL:-$d_model}
export INK_PORT=${INK_PORT:-8102}
[ -n "$d_ub" ] && export INK_UBATCH=${INK_UBATCH:-$d_ub}
LORA=${UNC_LORA-$d_lora}
ARGS=()   # the alias stays the base recipe's (inkling-2-mini); a second --alias is deprecated in llama-server
[ -n "$LORA" ] && ARGS+=(--lora-scaled "$LORA:${UNC_LORA_SCALE:-1}")
[ -n "${UNC_MMPROJ:-}" ] && export INK_MMPROJ=${INK_MMPROJ:-$d_mmproj}
exec "$HERE/../inkling-2-mini/serve.sh" ${ARGS[@]+"${ARGS[@]}"} "$@"
