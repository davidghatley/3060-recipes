#!/usr/bin/env bash
# SenseNova-Loop-9B (looped dense hybrid, 32 layers / 56 passes) on llama.cpp master + PR #32588, one RTX 3060 12 GB.
# OpenAI-compatible on 127.0.0.1:8103. See README.md / RESULTS.md; experiment log in PLAN.md.
#   ./serve.sh                       official Q5_K_M (sensenova), tuned default: 128k, q8_0 K/V, MTP n=2
#   VARIANT=uncensored ./serve.sh    satellitedown abliterated Q6_K (-upstream- file, no MTP head: 128k, q8_0 K/V)
#   SNL_PROFILE=long ./serve.sh      256k window, q4_0 K/V, no MTP (needles 3/3 at 130k and 247k, PLAN #13)
#   SNL_PROFILE=stock ./serve.sh     stock flags (the baseline of PLAN.md)
#   SNL_MMPROJ=auto ./serve.sh       image input with the official F16 projector (works with both variants)
# Every knob has an SNL_* env override; extra args go to llama-server. Holds the shared GPU lock (gpu_run) while serving.
set -euo pipefail
BIN=${SNL_BIN:-/mnt/scratch/llama.cpp/pr32588-0ba8e4adf/bin}
W=/mnt/models/llm/sensenova-loop-9b
VARIANT=${VARIANT:-default}
case "$VARIANT" in
  default)    d_model=$W/SenseNova-Loop-9B-Q5_K_M.gguf; d_spec=mtp ;;          # official file carries the MTP head
  uncensored) d_model=$W/abliterated/SenseNova-Loop-9B-abliterated-upstream-Q6_K.gguf; d_spec=none ;;   # no MTP head
  *) echo "VARIANT must be default or uncensored (or set SNL_MODEL)" >&2; exit 2 ;;
esac
MODEL=${SNL_MODEL:-$d_model}
# Sampling: the GGUF's own general.sampling (temp 1.0, top-p 0.95); thinking on, as in the chat template.
SAMP=${SNL_SAMPLING:---temp 1.0 --top-p 0.95 --top-k 20 --min-p 0}
THINK=${SNL_THINK:-on}

# Profiles (PLAN.md / RESULTS.md).
case "${SNL_PROFILE:-default}" in
  stock)   p_ctx=0;      p_kv=f16;  p_ub=512; p_fa=auto; p_fit=on;  p_spec=none ;;     # the card's command line (fit picks the window)
  default) p_ctx=131072; p_kv=q8_0; p_ub=512; p_fa=on;   p_fit=off; p_spec=$d_spec ;;  # tuned: MTP n=2 (official file), q8_0 K/V
  long)    p_ctx=262144; p_kv=q4_0; p_ub=512; p_fa=on;   p_fit=off; p_spec=none ;;     # largest window that loads (PLAN #8, needles PLAN #13); no MTP
  *) echo "SNL_PROFILE must be stock, default or long" >&2; exit 2 ;;
esac
CTX=${SNL_CTX:-$p_ctx}
KV=${SNL_KV:-$p_kv}
KV_V=${SNL_KV_V:-$KV}
FA=${SNL_FA:-$p_fa}
NGL_ARGS=(-ngl "${SNL_NGL:-99}"); [ "${SNL_PROFILE:-default}" = stock ] && [ -z "${SNL_NGL:-}" ] && NGL_ARGS=()
# Speculative decoding: none | mtp (the official file's own MTP head) | ngram (drafts copied from the prompt)
SPEC_ARGS=()
case "${SNL_SPEC:-$p_spec}" in
  none) ;;
  mtp)   SPEC_ARGS=(--spec-type draft-mtp --spec-draft-n-max "${SNL_DRAFT_N:-2}") ;;
  ngram) SPEC_ARGS=(--spec-type ngram-simple --spec-draft-n-max "${SNL_DRAFT_N:-16}") ;;
  *) echo "SNL_SPEC must be none, mtp or ngram" >&2; exit 2 ;;
esac
CTX_ARGS=(-c "$CTX"); [ "$CTX" = 0 ] && CTX_ARGS=()   # stock: no -c, llama-server's default and --fit decide
# Image input: SNL_MMPROJ=auto uses the official F16 projector (works with the abliterated file too, PLAN #12; +1.1 GB VRAM)
MMPROJ_ARGS=(--no-mmproj); [ -n "${SNL_MMPROJ:-}" ] && MMPROJ_ARGS=(--mmproj "$SNL_MMPROJ")
[ "${SNL_MMPROJ:-}" = auto ] && MMPROJ_ARGS=(--mmproj "$W/mmproj-SenseNova-Loop-9B-F16.gguf")

export LD_LIBRARY_PATH="/mnt/scratch/envs/llama-build-cuda/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# Everything sits in VRAM; the mmap'd file still counts in the page cache that memcap sees (AGENTS.md traps).
export GPU_RUN_MEM=${GPU_RUN_MEM:-24G}
# SNL_NO_GPU_RUN=1: start llama-server directly (already inside a gpu_run session, see tools/gpu_batch.sh)
RUN=("$HOME/anime-pipeline/tools/gpu_run" --free --need "${SNL_NEED:-9000}" --wait "${SNL_WAIT:-3600}")
[ -n "${SNL_NO_GPU_RUN:-}" ] && RUN=()
CMD=("$BIN/llama-server" -m "$MODEL" --alias "sensenova-loop-9b-$VARIANT" "${MMPROJ_ARGS[@]}"
  "${NGL_ARGS[@]}" --fit "${SNL_FIT:-$p_fit}"
  "${CTX_ARGS[@]}" -np 1 -t "${SNL_THREADS:-6}" -b "${SNL_BATCH:-2048}" -ub "${SNL_UBATCH:-$p_ub}"
  -fa "$FA" -ctk "$KV" -ctv "$KV_V" "${SPEC_ARGS[@]}"
  --jinja --reasoning-format deepseek --reasoning "$THINK" $SAMP
  --host 127.0.0.1 --port "${SNL_PORT:-8103}" ${SNL_EXTRA:-} "$@")
if [ "${SNL_DRY:-}" = 1 ]; then printf '%q ' "${CMD[@]}"; echo; exit 0; fi
exec "${RUN[@]}" prlimit --core=0 "${CMD[@]}"
