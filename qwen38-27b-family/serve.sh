#!/usr/bin/env bash
# Qwen3.8-27B family (four finetunes of the same dense hybrid base) on stock llama.cpp master, one RTX 3060 12 GB.
# OpenAI-compatible on 127.0.0.1:8101. See README.md / RESULTS.md; experiment log in PLAN.md.
#   VARIANT=pi|heretic|daisyrose|huihui ./serve.sh      (default pi)
#   Q38_PROFILE=long ./serve.sh                          (long-context profile, see README)
# Every knob has a Q38_* env override; extra args go to llama-server. Holds the shared GPU lock (gpu_run) while serving.
set -euo pipefail
BIN=${Q38_BIN:-/mnt/scratch/llama.cpp/master-225a5345b/bin}
W=/mnt/models/llm/qwen38-27b-family
VARIANT=${VARIANT:-pi}
# Per variant: weights, the card's sampling, thinking default.
case "$VARIANT" in
  pi)        d_model=$W/pi-adapted/Qwen3.8-27B-pi-IQ3_XXS.gguf; d_mmproj=$W/pi-adapted/mmproj-Qwen3.8-27B-pi-F16.gguf
             d_samp="--temp 0.8 --top-p 1.0 --top-k 0 --min-p 0"; d_think=off; d_ffn_default=3; d_ffn_fast=0; d_ffn_long=26 ;;  # harness-hub card: thinking off, T 0.8, top-p 1.0
  heretic)   d_model=$W/davidau-heretic/Qwen3.8-27B-TurboFCFusion-735-882-Here-Uncen-NEO-CODER-MAX-MTP-IQ2_M.gguf; d_mmproj=
             d_samp="--temp 0.7 --top-p 0.95 --top-k 20 --min-p 0 --repeat-penalty 1.0"; d_think=on; d_ffn_default=10; d_ffn_fast=5; d_ffn_long=37 ;;  # DavidAU card: T .6/.7, rep pen off
  daisyrose) d_model=$W/daisyrose/RadixArk_DaisyRose-27B-IQ3_XXS.gguf; d_mmproj=
             d_samp="--temp 1.0 --top-p 0.95 --top-k 20 --min-p 0"; d_think=on; d_ffn_default=7; d_ffn_fast=4; d_ffn_long=28 ;;          # RadixArk card: T 1.0, top-p .95, top-k 20
  huihui)    d_model=$W/huihui-abliterated/Huihui-Qwen3.8-27B-abliterated-GSQ-RCO-IQ3_XXS-mtp.gguf; d_mmproj=
             d_samp="--temp 1.0 --top-p 0.95 --top-k 20 --min-p 0"; d_think=on; d_ffn_default=0; d_ffn_fast=0; d_ffn_long=22 ;;          # Qwen3.8 base card (thinking mode)
  *) echo "VARIANT must be pi, heretic, daisyrose or huihui (or set Q38_MODEL)" >&2; exit 2 ;;
esac
MODEL=${Q38_MODEL:-$d_model}
SAMP=${Q38_SAMPLING:-$d_samp}
THINK=${Q38_THINK:-$d_think}

# Profiles (tuned on pi, PLAN.md / RESULTS.md). FFN_CPU = how many leading layers keep their FFN matrices in RAM
# (the fewest that load next to the window's K/V and compute buffer; per variant, since the files differ in size).
#   default: 32k window, q4_0 K/V, ub 256          fast: 16k, everything on the GPU          long: 128k
case "${Q38_PROFILE:-default}" in
  default) p_ctx=32768;  p_kv=q4_0; p_ub=256; p_ffn=${d_ffn_default} ;;
  fast)    p_ctx=16384;  p_kv=q4_0; p_ub=256; p_ffn=${d_ffn_fast} ;;
  long)    p_ctx=131072; p_kv=q4_0; p_ub=256; p_ffn=${d_ffn_long} ;;
  *) echo "Q38_PROFILE must be default, fast or long" >&2; exit 2 ;;
esac
p_ngl=99
CTX=${Q38_CTX:-$p_ctx}
KV=${Q38_KV:-$p_kv}
KV_V=${Q38_KV_V:-$KV}   # V cache type (default: same as K)
FFN_CPU=${Q38_FFN_CPU:-$p_ffn}
p_ot=''
if [ "$FFN_CPU" -gt 0 ]; then p_ot="blk\\.($(seq -s'|' 0 $((FFN_CPU-1))))\\.ffn_(up|gate|down)=CPU"; fi
OT=${Q38_OT-$p_ot}
OT_ARGS=(); [ -n "$OT" ] && OT_ARGS=(-ot "$OT")
# Speculative decoding: none | mtp (the file's own MTP head) | dflash2 (z-lab-style DFlash2 drafter on disk from kintsugi-27b)
SPEC_ARGS=()
case "${Q38_SPEC:-none}" in
  none) ;;
  mtp) SPEC_ARGS=(--spec-type draft-mtp --spec-draft-n-max "${Q38_DRAFT_N:-2}") ;;
  dflash2) SPEC_ARGS=(--spec-type draft-dflash2 -md "${Q38_DRAFT_MODEL:-/mnt/models/llm/kintsugi-27b/dflash-Qwen3.8-27B-Q4_0.gguf}"
                      --spec-draft-n-max "${Q38_DRAFT_N:-8}" -ngld "${Q38_DRAFT_NGL:-99}") ;;
  *) echo "Q38_SPEC must be none, mtp or dflash2" >&2; exit 2 ;;
esac
MMPROJ_ARGS=(--no-mmproj)
[ -n "${Q38_MMPROJ:-}" ] && MMPROJ_ARGS=(--mmproj "$Q38_MMPROJ")
[ "${Q38_MMPROJ:-}" = auto ] && MMPROJ_ARGS=(--mmproj "$d_mmproj")
LORA_ARGS=(); [ -n "${Q38_LORA:-}" ] && LORA_ARGS=(--lora "$Q38_LORA")

export LD_LIBRARY_PATH="/mnt/scratch/envs/llama-build-cuda/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# Layers that stay in RAM are mmap'd from the page cache, which gpu_run's memcap counts (AGENTS.md traps).
export GPU_RUN_MEM=${GPU_RUN_MEM:-44G}
# Q38_NO_GPU_RUN=1: start llama-server directly (already inside a gpu_run session, see tools/gpu_batch.sh)
RUN=("$HOME/anime-pipeline/tools/gpu_run" --free --need "${Q38_NEED:-10800}" --wait "${Q38_WAIT:-3600}")
[ -n "${Q38_NO_GPU_RUN:-}" ] && RUN=()
CMD=("$BIN/llama-server" -m "$MODEL" --alias "qwen38-$VARIANT" "${MMPROJ_ARGS[@]}" "${LORA_ARGS[@]}"
  -ngl "${Q38_NGL:-$p_ngl}" "${OT_ARGS[@]}" --fit "${Q38_FIT:-off}"
  -c "$CTX" -np 1 -t "${Q38_THREADS:-6}" -b "${Q38_BATCH:-2048}" -ub "${Q38_UBATCH:-$p_ub}"
  -fa on -ctk "$KV" -ctv "$KV_V" "${SPEC_ARGS[@]}"
  --jinja --reasoning-format deepseek --reasoning "$THINK" $SAMP
  --host 127.0.0.1 --port "${Q38_PORT:-8101}" ${Q38_EXTRA:-} "$@")
if [ "${Q38_DRY:-}" = 1 ]; then printf '%q ' "${CMD[@]}"; echo; exit 0; fi
exec "${RUN[@]}" prlimit --core=0 "${CMD[@]}"
