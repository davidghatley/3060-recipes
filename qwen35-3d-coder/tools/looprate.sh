#!/usr/bin/env bash
# Session D (2026-11-21): does MTP loop more than no speculation? Same Q5_K_M, same sampling (T 0.6, top-p 0.95,
# top-k 20, server min-p 0.05), 4 prompts that looped before x 4 seeds per arm, 16k-token cap (loops start ~9k).
# Arms are interleaved per prompt pair; each server session stays under ~30 min (gpu-share rule).
#   tools/looprate.sh            # all four batches
#   SMOKE=1 tools/looprate.sh    # 64 tokens, one prompt and seed per arm
#   ONLY="mtp-b" tools/looprate.sh  # rerun only the named batches (arm-tag, space-separated)
set -uo pipefail
cd "$(dirname "$0")/.."
S=runs/mtprepro/D-looprate; mkdir -p "$S"
export QC_GPU_WAIT=${QC_GPU_WAIT:-1800}
MAX=16000 SEEDS=1,2,3,4
[ -n "${SMOKE:-}" ] && { S=$S/smoke; mkdir -p "$S"; MAX=64 SEEDS=1; }
batch() {  # arm ids tag
  local arm=$1 ids=$2 tag=$3 spec=none
  [ -n "${ONLY:-}" ] && [[ " $ONLY " != *" $arm-$tag "* ]] && return 0
  [ "$arm" = mtp ] && spec=draft-mtp
  [ -n "${SMOKE:-}" ] && ids=${ids%%,*}
  echo "== $(date +%T) $arm $tag ($ids, seeds $SEEDS)"
  QC_SPEC=$spec tools/with_server.sh "$S/$arm-$tag-server.log" -- python3 -I tools/mtp_repro.py gen --temp 0.6 \
    --min-p -1 --n-probs 0 --max "$MAX" --ids "$ids" --seeds "$SEEDS" --out "$S/$arm"
}
batch mtp  scene-000238,scene-000335 a
batch none scene-000238,scene-000335 a
[ -n "${SMOKE:-}" ] && exit 0
batch mtp  scene-000048,scene-000334 b
batch none scene-000048,scene-000334 b
echo "== D done $(date +%T)"
