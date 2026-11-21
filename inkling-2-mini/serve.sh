#!/usr/bin/env bash
# Inkling-2-Mini on llama-server: loop-core experts on the GPU, the rest in RAM, 64k context. See PLAN.md / RESULTS.md.
# Build: llama.cpp master 29b52d398 + the inkfix branch (loop-pass expert scales, F16 relative-bias mask), see README.md.
# Every knob has an INK_* env override; extra args are passed to llama-server.
set -euo pipefail
BIN=${INK_BIN:-/mnt/scratch/llama.cpp/inkfix-4c836a8eb/bin}
D=/mnt/models/llm/inkling-2-mini
case "${INK_QUANT:-iq4nl}" in
  iq4nl) d_model=$D/Inkling-2-Mini-IQ4_NL.gguf ;;            # fastest (ggml-org IQ4_NL)
  nvfp4) d_model=$D/own/Inkling-2-Mini-NVFP4.gguf ;;         # the checkpoint's own NVFP4 experts: ~3x lower KLD, ~7% slower
  *) echo "INK_QUANT must be iq4nl or nvfp4 (or set INK_MODEL)" >&2; exit 2 ;;
esac
MODEL=${INK_MODEL:-$d_model}
export LD_LIBRARY_PATH="/mnt/scratch/envs/llama-build-cuda/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# experts may be mmap'd from RAM: gpu_run's memcap counts page cache, 20 GB would bind
export GPU_RUN_MEM=${GPU_RUN_MEM:-44G}

# Expert placement (-ot). Layers 6-17 are the loop core and run 3x per token, so their experts go on the GPU first.
# INK_PROFILE=128k: core layers 16-17 back to RAM, ub 64, no op offload (a core layer in RAM + op offload gives NaN, PLAN #7)
EXTRA=()
if [ "${INK_PROFILE:-64k}" = 128k ]; then
  : "${INK_OT:=blk\.([0-5]|1[6-9]|2[0-3])\.ffn_.*_exps=CPU}" "${INK_CONTEXT:=131072}" "${INK_UBATCH:=64}"
  EXTRA=(--no-op-offload)
fi
case "${INK_PLACEMENT:-core}" in
  cpu)  d_ot='exps=CPU' ;;                                          # baseline: every routed expert in RAM (needs --no-op-offload, see PLAN #7)
  core) d_ot='blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU' ;;       # core 6-17 experts on GPU, the rest in RAM
  *) echo "INK_PLACEMENT must be cpu or core (or set INK_OT)" >&2; exit 2 ;;
esac
OT=${INK_OT:-$d_ot}
KV=${INK_KV:-q8_0}
UB=${INK_UBATCH:-128}            # the per-head relative-bias mask is n_kv x ubatch x 24 heads: ub 128 is what fits at 64k
MMPROJ_ARGS=()
[ -n "${INK_MMPROJ:-}" ] && MMPROJ_ARGS=(--mmproj "$INK_MMPROJ")
CACHE_ARGS=()
[ "${INK_MOE_CACHE_MIB:-0}" != 0 ] && CACHE_ARGS=(--moe-cache-mib "$INK_MOE_CACHE_MIB" --moe-cache-cpu-share "${INK_MOE_CACHE_SHARE:-0.95}")

exec "$HOME/anime-pipeline/tools/gpu_run" --need "${INK_NEED:-10000}" --wait "${INK_WAIT:-3600}" \
  "$BIN/llama-server" -m "$MODEL" --alias inkling-2-mini "${MMPROJ_ARGS[@]}" \
  -ngl 99 -ot "$OT" "${CACHE_ARGS[@]}" --fit off \
  -c "${INK_CONTEXT:-65536}" -np 1 -t "${INK_THREADS:-6}" \
  -b "${INK_BATCH:-2048}" -ub "$UB" ${INK_LOAD_MODE:+--load-mode "$INK_LOAD_MODE"} \
  -fa on -ctk "$KV" -ctv "$KV" --jinja --reasoning-format deepseek \
  --temp 1.0 \
  --host 127.0.0.1 --port "${INK_PORT:-8085}" "${EXTRA[@]}" "$@"
