#!/usr/bin/env bash
# Inkling-2-Mini on llama-server: loop-core experts on the GPU, the rest in RAM, 64k context. See PLAN.md / RESULTS.md.
# Build: llama.cpp master 225a5345b + patches/0001 and 0002 (F16 relative-bias mask, what makes 64k fit), see README.md.
# Every knob has an INK_* env override; extra args are passed to llama-server.
set -euo pipefail
BIN=${INK_BIN:-/mnt/scratch/llama.cpp/r2inkfix-19c41d2ff/bin}
D=/mnt/models/llm/inkling-2-mini
case "${INK_QUANT:-iq4nl}" in
  iq4nl) d_model=$D/Inkling-2-Mini-IQ4_NL.gguf ;;            # the default (ggml-org IQ4_NL)
  nvfp4) d_model=$D/own/Inkling-2-Mini-NVFP4.gguf ;;         # the checkpoint's own NVFP4 experts: ~3x lower KLD, ~7% slower
  iq2xxs) d_model=$D/unsloth/Mainline_Support/Inkling-2-Mini-UD-IQ2_XXS.gguf; d_place=gpu ;;   # 2-bit, fits whole on the GPU: fastest, lowest quality (RESULTS.md, Round 2)
  iq3xxs) d_model=$D/unsloth/Mainline_Support/Inkling-2-Mini-UD-IQ3_XXS.gguf; d_place=wide ;;  # 3-bit: layers 3-19 on the GPU; +7% decode, +42% prefill, KLD 3.3x IQ4_NL
  q2kxl) d_model=$D/unsloth/Mainline_Support/Inkling-2-Mini-UD-Q2_K_XL.gguf; d_place=gpu; d_ub=64 ;;  # 2-bit, whole on the GPU, ub 64 to fit 64k
  *) echo "INK_QUANT must be iq4nl, nvfp4, iq3xxs, q2kxl or iq2xxs (or set INK_MODEL)" >&2; exit 2 ;;
esac
MODEL=${INK_MODEL:-$d_model}
export LD_LIBRARY_PATH="/mnt/scratch/envs/llama-build-cuda/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# experts may be mmap'd from RAM: gpu_run's memcap counts page cache, 20 GB would bind
export GPU_RUN_MEM=${GPU_RUN_MEM:-44G}

# Expert placement (-ot). Layers 6-17 are the loop core and run 3x per token, so their experts go on the GPU first.
# INK_PROFILE=128k: core layers 16-17 back to RAM (6-15 on the GPU), ub 64, no op offload (a core layer in RAM + op offload
# gives NaN, PLAN #7 and #18). Use the default 6-17 layout for speed up to 64k, and this one only for 128k.
# The 128k boundary on this build with ~0.95 GB of the card on the desktop (PLAN #31/#32, RESULTS "The 128k boundary"):
#   6-15 ub 64   runs (124k prompt, needles 3/3)        6-15 ub 128/192/256   do not load
#   6-16 ub 64   loads, OOM on the first request         6-16 ub 128           does not load
# On master + PR #32740: 6-15 ub 256 and 6-16 ub 128 both run a 104k prompt (INK_BIN=<that build> INK_OT=... INK_UBATCH=...).
EXTRA=()
if [ "${INK_PROFILE:-64k}" = 128k ]; then
  : "${INK_OT:=blk\.([0-5]|1[6-9]|2[0-3])\.ffn_.*_exps=CPU}" "${INK_CONTEXT:=131072}" "${INK_UBATCH:=64}"
  EXTRA=(--no-op-offload)
fi
case "${INK_PLACEMENT:-${d_place:-core}}" in
  cpu)  d_ot='exps=CPU' ;;                                          # baseline: every routed expert in RAM (needs --no-op-offload, see PLAN #7)
  core) d_ot='blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU' ;;       # core 6-17 experts on GPU, the rest in RAM
  wide) d_ot='blk\.([0-2]|2[0-3])\.ffn_.*_exps=CPU' ;;             # layers 3-19 on GPU (fits with UD-IQ3_XXS at 64k)
  gpu)  d_ot='' ;;                                                  # everything on the GPU (only the 2-bit quants fit)
  *) echo "INK_PLACEMENT must be cpu, core, wide or gpu (or set INK_OT)" >&2; exit 2 ;;
esac
OT=${INK_OT:-$d_ot}
OT_ARGS=(); [ -n "$OT" ] && OT_ARGS=(-ot "$OT")
KV=${INK_KV:-q8_0}
UB=${INK_UBATCH:-${d_ub:-128}}            # the per-head relative-bias mask is n_kv x ubatch x 24 heads: ub 128 is what fits at 64k
MMPROJ_ARGS=()
[ -n "${INK_MMPROJ:-}" ] && MMPROJ_ARGS=(--mmproj "$INK_MMPROJ")
CACHE_ARGS=()
[ "${INK_MOE_CACHE_MIB:-0}" != 0 ] && CACHE_ARGS=(--moe-cache-mib "$INK_MOE_CACHE_MIB" --moe-cache-cpu-share "${INK_MOE_CACHE_SHARE:-0.95}")

# INK_NO_GPU_RUN=1: start llama-server directly (already inside a gpu_run session, or a box without the shared GPU queue)
RUN=("$HOME/anime-pipeline/tools/gpu_run" --need "${INK_NEED:-10000}" --wait "${INK_WAIT:-3600}")
[ -n "${INK_NO_GPU_RUN:-}" ] && RUN=()
exec "${RUN[@]}" \
  "$BIN/llama-server" -m "$MODEL" --alias inkling-2-mini "${MMPROJ_ARGS[@]}" \
  -ngl 99 "${OT_ARGS[@]}" "${CACHE_ARGS[@]}" --fit off \
  -c "${INK_CONTEXT:-65536}" -np 1 -t "${INK_THREADS:-6}" \
  -b "${INK_BATCH:-2048}" -ub "$UB" ${INK_LOAD_MODE:+--load-mode "$INK_LOAD_MODE"} \
  -fa on -ctk "$KV" -ctv "$KV" --jinja --reasoning-format deepseek \
  --temp 1.0 \
  --host 127.0.0.1 --port "${INK_PORT:-8085}" "${EXTRA[@]}" "$@"
