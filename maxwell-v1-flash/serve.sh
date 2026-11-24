#!/usr/bin/env bash
# Maxwell-V1-Flash (35B-A3B MoE, AtomicChat AD-Q4_K-IQ4_XS) on llama-server with AtomicChat's maxwell-moe port.
# Routed experts split between the GPU and RAM; see PLAN.md / RESULTS.md for how each default was chosen.
#   VARIANT=base         the model as published (default)
#   VARIANT=uncensored   + AtomicChat's rank-1 uncensored LoRA at runtime (--lora-scaled, scale MX_LORA_SCALE, default 1)
# Every knob has an MX_* env override; extra args are passed to llama-server.
# Defaults (PLAN.md rows 6-13): every routed expert in RAM (--cpu-moe), 1900 MiB of the card as llama.cpp's MoE cache
# of hot experts, f16 KV (q8_0 KV decodes 35% slower at 32k on this engine), ub 1024, --load-mode none, 64k, 6 threads.
#   MX_PROFILE    default | short  (q8_0 KV, cache 4800, ub 512: +16% decode at empty context, -35% at 32k, -34% prefill)
#                         | prompt (ub 2048, cache 1100: +43% prefill over the default, -7% decode)
#   MX_PLACEMENT  cpu   (default: every routed expert in RAM, plus the MoE cache)
#                 ncmoe (experts of the first MX_NCMOE layers in RAM, the rest fixed on the GPU; no cache unless MX_MOE_CACHE_MIB)
#                 fit   (stock llama.cpp: no -ngl/-ot, --fit on picks the split)
#   MX_OT         raw -ot pattern (overrides MX_PLACEMENT)
#   MX_MOE_CACHE_MIB / MX_MOE_CACHE_SHARE   llama.cpp's MoE cache (VRAM cache of hot RAM-resident experts), 0 = off
#   MX_CONTEXT MX_KV MX_UBATCH MX_BATCH MX_THREADS MX_LOAD_MODE MX_OP_OFFLOAD(0|1) MX_THINK(0 = thinking off by default)
#   MX_MODEL MX_LORA MX_BIN MX_PORT MX_NEED MX_WAIT MX_NO_GPU_RUN=1 (already inside gpu_run)
set -euo pipefail
BIN=${MX_BIN:-/mnt/scratch/llama.cpp/maxwell-4f969ad24/bin}   # llama.cpp d3c3e242c + maxwell-moe-port.patch
D=/mnt/models/llm/maxwell-v1-flash
MODEL=${MX_MODEL:-$D/Maxwell-V1-Flash-AD-Q4_K-IQ4_XS.gguf}
VARIANT=${VARIANT:-base}
case "$VARIANT" in
  base)       d_lora="" ;;
  uncensored) d_lora=$D/uncensored/Maxwell-V1-Flash-Uncensored-LoRA.gguf ;;
  *) echo "VARIANT must be base or uncensored" >&2; exit 2 ;;
esac
LORA=${MX_LORA-$d_lora}
export LD_LIBRARY_PATH="/mnt/scratch/envs/llama-build-cuda/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# experts are read from RAM (mmap'd page cache or anonymous memory): gpu_run's memcap counts page cache, 20 GB would bind
export GPU_RUN_MEM=${GPU_RUN_MEM:-44G}

case "${MX_PROFILE:-default}" in
  default) p_kv=f16;  p_cache=1900; p_ub=1024 ;;
  short)   p_kv=q8_0; p_cache=4800; p_ub=512 ;;
  prompt)  p_kv=f16;  p_cache=1100; p_ub=2048 ;;
  *) echo "MX_PROFILE must be default, short or prompt" >&2; exit 2 ;;
esac
NCMOE=${MX_NCMOE:-33}
case "${MX_PLACEMENT:-cpu}" in
  ncmoe) PLACE=(-ngl 99 --n-cpu-moe "$NCMOE" --fit off) ;;
  cpu)   PLACE=(-ngl 99 --cpu-moe --fit off) ;;
  fit)   PLACE=() ;;
  *) echo "MX_PLACEMENT must be ncmoe, cpu or fit" >&2; exit 2 ;;
esac
[ -n "${MX_OT:-}" ] && PLACE=(-ngl 99 -ot "$MX_OT" --fit off)

ARGS=()
[ -n "$LORA" ] && ARGS+=(--lora-scaled "$LORA:${MX_LORA_SCALE:-1}")
# the cache only applies when experts live in RAM; MX_MOE_CACHE_MIB=0 turns it off
CACHE=${MX_MOE_CACHE_MIB-$p_cache}; [ "${MX_PLACEMENT:-cpu}" = cpu ] || CACHE=${MX_MOE_CACHE_MIB:-0}
[ "$CACHE" != 0 ] && ARGS+=(--moe-cache-mib "$CACHE" --moe-cache-cpu-share "${MX_MOE_CACHE_SHARE:-0.95}")
[ "${MX_OP_OFFLOAD:-1}" = 0 ] && ARGS+=(--no-op-offload)
LOAD_MODE=${MX_LOAD_MODE-none}; [ -n "$LOAD_MODE" ] && ARGS+=(--load-mode "$LOAD_MODE")
KV=${MX_KV:-$p_kv}; ARGS+=(-ctk "$KV" -ctv "$KV")
ARGS+=(-ub "${MX_UBATCH:-$p_ub}")
[ -n "${MX_BATCH:-}" ] && ARGS+=(-b "$MX_BATCH")
[ -n "${MX_THREADS:-}" ] && ARGS+=(-t "$MX_THREADS")
[ "${MX_THINK:-1}" = 0 ] && ARGS+=(--chat-template-kwargs '{"enable_thinking": false}')

RUN=("$HOME/anime-pipeline/tools/gpu_run" --need "${MX_NEED:-10500}" --wait "${MX_WAIT:-7200}")
[ -n "${MX_NO_GPU_RUN:-}" ] && RUN=()
exec "${RUN[@]}" \
  "$BIN/llama-server" -m "$MODEL" --alias maxwell-v1-flash \
  ${PLACE[@]+"${PLACE[@]}"} -c "${MX_CONTEXT:-65536}" -np 1 -fa on --jinja \
  --temp 0.6 --top-p 0.95 --top-k 20 \
  --host 127.0.0.1 --port "${MX_PORT:-8104}" ${ARGS[@]+"${ARGS[@]}"} "$@"
