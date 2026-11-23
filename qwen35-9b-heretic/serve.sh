#!/usr/bin/env bash
# DavidAU Qwen3.5-9B "The Defiant Fable" Uncensored Heretic NEO-IMATRIX-MAX-MTP (Q6_K, BF16 output head, MTP head)
# on stock llama.cpp master, all in VRAM on one RTX 3060 12 GB. OpenAI-compatible on 127.0.0.1:8106.
# See README.md / RESULTS.md; experiment log in PLAN.md.
#   ./serve.sh                     tuned default on the published file: MTP n=2, 64k window, f16 K/V (96k: QH_CTX=98304 QH_KV=q8_0)
#   QH_PROFILE=fast ./serve.sh     local Q8_0-head copy (tools/requant_head.sh, lossy: KLD 0.0001) + MTP n=2, 128k q8_0
#   QH_PROFILE=nospec ./serve.sh   published file without MTP, 128k q8_0 (fastest prefill)
#   QH_PROFILE=long ./serve.sh     published file, 192k q4_0 K/V, no MTP (largest window that fits with the BF16 head)
#   QH_PROFILE=stock ./serve.sh    plain llama-server defaults (-ngl/-c/fit left to llama-server) + --jinja, the baseline
# Every knob has a QH_* env override; extra args go to llama-server. Holds the shared GPU lock (gpu_run) while serving.
set -euo pipefail
BIN=${QH_BIN:-/mnt/scratch/llama.cpp/master-225a5345b/bin}
W=/mnt/models/llm/qwen35-9b-heretic
PUB=$W/Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf
# Local copy with output.weight BF16 -> Q8_0, every other tensor byte-identical (tools/requant_head.sh, 48 s on the CPU)
HEADQ8=${QH_HEADQ8:-/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf}
# Sampling: the card's "thinking, general" settings (temp 1.0, top-p 0.95, top-k 20, min-p 0, no penalties).
SAMP=${QH_SAMPLING:---temp 1.0 --top-p 0.95 --top-k 20 --min-p 0 --repeat-penalty 1.0 --presence-penalty 0}
THINK=${QH_THINK:-on}

# Profiles (PLAN.md rows). p_ctx=0 and p_fit=on: llama-server's own defaults pick the window/layout (stock).
case "${QH_PROFILE:-default}" in
  stock)   p_m=$PUB;    p_ctx=0;      p_kv=f16;  p_ub=512; p_fa=auto; p_fit=on;  p_spec=none ;;
  default) p_m=$PUB;    p_ctx=65536;  p_kv=f16;  p_ub=512; p_fa=on;   p_fit=off; p_spec=mtp ;;
  fast)    p_m=$HEADQ8; p_ctx=131072; p_kv=q8_0; p_ub=512; p_fa=on;   p_fit=off; p_spec=mtp ;;
  nospec)  p_m=$PUB;    p_ctx=131072; p_kv=q8_0; p_ub=512; p_fa=on;   p_fit=off; p_spec=none ;;
  long)    p_m=$PUB;    p_ctx=196608; p_kv=q4_0; p_ub=512; p_fa=on;   p_fit=off; p_spec=none ;;
  *) echo "QH_PROFILE must be default, fast, nospec, long or stock" >&2; exit 2 ;;
esac
MODEL=${QH_MODEL:-$p_m}
[ -f "$MODEL" ] || { echo "model file not found: $MODEL (fast profile: run tools/requant_head.sh first)" >&2; exit 2; }
CTX=${QH_CTX:-$p_ctx}
KV=${QH_KV:-$p_kv}
KV_V=${QH_KV_V:-$KV}
NGL_ARGS=(-ngl "${QH_NGL:-99}"); [ "${QH_PROFILE:-default}" = stock ] && [ -z "${QH_NGL:-}" ] && NGL_ARGS=()
CTX_ARGS=(-c "$CTX"); [ "$CTX" = 0 ] && CTX_ARGS=()
# Speculative decoding: none | mtp (the file's own MTP head, blk.32) | ngram (drafts copied from the prompt)
SPEC_ARGS=()
case "${QH_SPEC:-$p_spec}" in
  none) ;;
  mtp)   SPEC_ARGS=(--spec-type draft-mtp --spec-draft-n-max "${QH_DRAFT_N:-2}") ;;
  ngram) SPEC_ARGS=(--spec-type ngram-simple --spec-draft-n-max "${QH_DRAFT_N:-16}") ;;
  *) echo "QH_SPEC must be none, mtp or ngram" >&2; exit 2 ;;
esac
NP_ARGS=(-np "${QH_NP:-1}"); [ "${QH_PROFILE:-default}" = stock ] && [ -z "${QH_NP:-}" ] && NP_ARGS=()
BS_ARGS=(); [ "${QH_BS:-0}" = 1 ] && BS_ARGS=(-bs)

export LD_LIBRARY_PATH="/mnt/scratch/envs/llama-build-cuda/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# Everything sits in VRAM; the mmap'd file still counts in the page cache that memcap sees (AGENTS.md traps).
export GPU_RUN_MEM=${GPU_RUN_MEM:-24G}
# QH_NO_GPU_RUN=1: start llama-server directly (already inside a gpu_run session, see tools/gpu_batch.sh)
RUN=("$HOME/anime-pipeline/tools/gpu_run" --free --need "${QH_NEED:-10000}" --wait "${QH_WAIT:-3600}")
[ -n "${QH_NO_GPU_RUN:-}" ] && RUN=()
CMD=("$BIN/llama-server" -m "$MODEL" --alias "${QH_ALIAS:-qwen35-9b-heretic}" --no-mmproj
  "${NGL_ARGS[@]}" --fit "${QH_FIT:-$p_fit}" "${CTX_ARGS[@]}" "${NP_ARGS[@]}" -t "${QH_THREADS:-6}"
  -b "${QH_BATCH:-2048}" -ub "${QH_UBATCH:-$p_ub}" -fa "${QH_FA:-$p_fa}" -ctk "$KV" -ctv "$KV_V"
  "${BS_ARGS[@]}" "${SPEC_ARGS[@]}"
  --jinja --reasoning-format deepseek --reasoning "$THINK" $SAMP
  --host 127.0.0.1 --port "${QH_PORT:-8106}" ${QH_EXTRA:-} "$@")
if [ "${QH_DRY:-}" = 1 ]; then printf '%q ' "${CMD[@]}"; echo; exit 0; fi
exec "${RUN[@]}" prlimit --core=0 "${CMD[@]}"
