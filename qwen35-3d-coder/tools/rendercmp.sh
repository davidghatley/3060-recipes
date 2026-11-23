#!/usr/bin/env bash
# Render comparison (2026-11-22): do MTP pages work as often as no-spec pages? Same 8 subset prompts as the first
# qualify split (1/8 vs 6/8), now 2 seeds per arm, through serve.sh as shipped (64k, one slot, card sampling,
# server min-p 0.05), 24k cap. Arms interleave per seed. Each server session stops starting new prompts after
# 27 min (gpu-share rule); gen.py skips finished ids, so a seed is resumed in the next session until all 8 are done.
# Pages are rendered and scored on the CPU after all GPU work (render eval: tools/render.mjs + tools/score.py).
#   tools/rendercmp.sh          # generate, render, score
#   SMOKE=1 tools/rendercmp.sh  # 64 tokens, one prompt, one seed per arm (generation only)
set -uo pipefail
cd "$(dirname "$0")/.."
IDS=scene-000048,scene-000049,scene-000144,scene-000145,scene-000238,scene-000239,scene-000334,scene-000335
SEEDS="1 2" MAX=24000 PRE=runs/eval-rc
export QC_GPU_WAIT=${QC_GPU_WAIT:-3600}
[ -n "${SMOKE:-}" ] && { IDS=${IDS%%,*} SEEDS=1 MAX=64 PRE=runs/eval-rcsmoke; }
n_ids=$(tr ',' '\n' <<< "$IDS" | wc -l)
done_n() { ls "$1"/scene-*.json 2>/dev/null | wc -l; }
for seed in $SEEDS; do
  for arm in mtp none; do
    out=$PRE-$arm-s$seed; mkdir -p "$out"; spec=none; [ "$arm" = mtp ] && spec=draft-mtp
    for attempt in 1 2 3 4; do
      [ "$(done_n "$out")" -ge "$n_ids" ] && break
      echo "== $(date +%T) $arm seed $seed session $attempt ($(done_n "$out")/$n_ids done)"
      QC_SPEC=$spec tools/with_server.sh "$out/server-$attempt.log" -- python3 -I tools/gen.py \
        --subset runs/data/subset-40.jsonl --out "$out" --url "http://127.0.0.1:${QC_PORT:-8090}" \
        --max-tokens "$MAX" --seed "$seed" --only "$IDS" --deadline-min 27
    done
    echo "== $arm seed $seed: $(done_n "$out")/$n_ids answers"
  done
done
[ -n "${SMOKE:-}" ] && exit 0
for d in $PRE-*-s*; do
  (cd "$d" && node "$OLDPWD/tools/render.mjs" render $(ls scene-*.html 2>/dev/null) > render.log 2>&1) || true
  /mnt/scratch/envs/llama-convert-b12242/bin/python -I tools/score.py "$d"
done
echo "== rendercmp done $(date +%T)"
