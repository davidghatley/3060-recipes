#!/usr/bin/env bash
# NVIDIA-Nemotron-3.5-Bolt-E4B-4GB (Gemma-4-E4B layout, Q4_K_M) on stock llama.cpp master, all in VRAM on one RTX 3060 12 GB.
# OpenAI-compatible on 127.0.0.1:8105. See README.md / RESULTS.md; experiment log in PLAN.md.
#   ./serve.sh                     tuned default (see the profile table below and PLAN.md STATUS)
#   NB_PROFILE=nospec ./serve.sh   tuned without the drafter (fastest prefill, 1.3 GB less VRAM)
#   NB_PROFILE=multi ./serve.sh    4 parallel 32k slots with the drafter (aggregate throughput); 4 x 64k: NB_CTX=262144 NB_SPEC=none
#   NB_PROFILE=stock ./serve.sh    the model card's command line (-c 65536 -ngl 999 --jinja), the baseline
# Every knob has an NB_* env override; extra args go to llama-server. Holds the shared GPU lock (gpu_run) while serving.
set -euo pipefail
BIN=${NB_BIN:-/mnt/scratch/llama.cpp/master-225a5345b/bin}
W=/mnt/models/llm/nemotron-bolt-e4b
MODEL=${NB_MODEL:-$W/Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf}
DRAFT=${NB_DRAFT:-$W/dflash/Nemotron-3.5-Bolt-E4B-DFlash-BF16.gguf}
# NB_DRAFT_Q8=1: a local Q8_0 copy of the drafter (tools/quantize_drafter.sh): +5-7% decode, same acceptance (PLAN row 20)
[ "${NB_DRAFT_Q8:-}" = 1 ] && [ -z "${NB_DRAFT:-}" ] && DRAFT=$W/dflash/Nemotron-3.5-Bolt-E4B-DFlash-Q8_0-local.gguf
# Sampling: the card's recommendation (temp 1.0, top-p 0.95) plus the GGUF's top-k 64. Thinking on by default (card).
SAMP=${NB_SAMPLING:---temp 1.0 --top-p 0.95 --top-k 64 --min-p 0}
THINK=${NB_THINK:-on}

# Profiles (PLAN.md rows). p_np=0 leaves llama-server's default slot count (stock). p_bs=1 adds -bs (backend sampling,
# experimental in llama.cpp; greedy output identical, PLAN row 19).
case "${NB_PROFILE:-default}" in
  stock)   p_ctx=65536;  p_kv=f16; p_ub=512;  p_b=2048; p_fa=auto; p_np=0; p_spec=none;   p_bs=0 ;;  # card's command line
  default) p_ctx=65536;  p_kv=f16; p_ub=1024; p_b=2048; p_fa=on;   p_np=1; p_spec=dflash; p_bs=1 ;;  # tuned: DFlash n=7 + ub 1024 + -bs
  nospec)  p_ctx=65536;  p_kv=f16; p_ub=1024; p_b=2048; p_fa=on;   p_np=1; p_spec=none;   p_bs=1 ;;  # tuned, no drafter
  multi)   p_ctx=131072; p_kv=f16; p_ub=512;  p_b=2048; p_fa=on;   p_np=4; p_spec=dflash; p_bs=1 ;;  # 4 slots x 32k (PLAN b09)
  *) echo "NB_PROFILE must be default, nospec, multi or stock" >&2; exit 2 ;;
esac
BS_ARGS=(); [ "${NB_BS:-$p_bs}" = 1 ] && BS_ARGS=(-bs)
CTX=${NB_CTX:-$p_ctx}
KV=${NB_KV:-$p_kv}
KV_V=${NB_KV_V:-$KV}
NP=${NB_NP:-$p_np}
NP_ARGS=(-np "$NP"); [ "$NP" = 0 ] && NP_ARGS=()
# Speculative decoding: none | dflash (the card's companion drafter) | ngram (drafts copied from the prompt)
SPEC_ARGS=()
case "${NB_SPEC:-$p_spec}" in
  none) ;;
  dflash) SPEC_ARGS=(--spec-draft-model "$DRAFT" --spec-type draft-dflash --spec-draft-n-max "${NB_DRAFT_N:-7}"
                     --spec-draft-ngl 999 ${NB_DRAFT_EXTRA:-}) ;;
  ngram)  SPEC_ARGS=(--spec-type ngram-simple --spec-draft-n-max "${NB_DRAFT_N:-16}") ;;
  *) echo "NB_SPEC must be none, dflash or ngram" >&2; exit 2 ;;
esac

export LD_LIBRARY_PATH="/mnt/scratch/envs/llama-build-cuda/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# Everything sits in VRAM; the mmap'd file (incl. the 3 GB per-layer embedding table) counts in the page cache memcap sees.
export GPU_RUN_MEM=${GPU_RUN_MEM:-24G}
# NB_NO_GPU_RUN=1: start llama-server directly (already inside a gpu_run session, see tools/gpu_batch.sh)
RUN=("$HOME/anime-pipeline/tools/gpu_run" --free --need "${NB_NEED:-8000}" --wait "${NB_WAIT:-3600}")
[ -n "${NB_NO_GPU_RUN:-}" ] && RUN=()
CMD=("$BIN/llama-server" -m "$MODEL" --alias "${NB_ALIAS:-nemotron-bolt}"
  -ngl "${NB_NGL:-999}" -c "$CTX" "${NP_ARGS[@]}" -t "${NB_THREADS:-6}" -b "${NB_BATCH:-$p_b}" -ub "${NB_UBATCH:-$p_ub}"
  -fa "${NB_FA:-$p_fa}" -ctk "$KV" -ctv "$KV_V" "${BS_ARGS[@]}" "${SPEC_ARGS[@]}"
  --jinja --reasoning-format deepseek --reasoning "$THINK" $SAMP
  --host 127.0.0.1 --port "${NB_PORT:-8105}" ${NB_EXTRA:-} "$@")
if [ "${NB_DRY:-}" = 1 ]; then printf '%q ' "${CMD[@]}"; echo; exit 0; fi
exec "${RUN[@]}" prlimit --core=0 "${CMD[@]}"
