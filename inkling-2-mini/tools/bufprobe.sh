#!/usr/bin/env bash
# Start llama-server for each (ctx, ub[, extra]) combo, record the KV / compute buffer sizes it reserves, stop it.
#   tools/bufprobe.sh "4096 512" "16384 256" ...   (runs inside one gpu_run session)
set -uo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ -z ${BP_INSIDE:-} ]]; then
  exec env BP_INSIDE=1 GPU_RUN_MEM=44G "$HOME/anime-pipeline/tools/gpu_run" --need ${INK_NEED:-11500} --wait 7200 "$0" "$@"
fi
BIN=${INK_BIN:-/mnt/scratch/llama.cpp/master-29b52d398/bin}
MODEL=${INK_MODEL:-/mnt/models/llm/inkling-2-mini/Inkling-2-Mini-IQ4_NL.gguf}
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
for combo in "$@"; do
  read -r ctx ub extra <<< "$combo"
  log=$ROOT/runs/membuf/ctx$ctx-ub$ub${extra:+-$(echo "$extra" | tr -c 'a-zA-Z0-9' _)}.log
  "$BIN/llama-server" -m "$MODEL" -ngl 99 -ot "${INK_OT:-exps=CPU}" --fit off -c "$ctx" -b "$ub" -ub "$ub" -fa on \
    -np 1 -t 6 --port 8086 -lv 4 $extra > "$log" 2>&1 &
  pid=$!
  for _ in $(seq 240); do grep -qE "listening on|failed to|error:" "$log" && break; kill -0 $pid 2>/dev/null || break; sleep 1; done
  kill -INT $pid 2>/dev/null; wait $pid 2>/dev/null
  echo "ctx=$ctx ub=$ub $extra :: $(grep -E 'KV buffer size|RS buffer|compute buffer size|CUDA0 model buffer' "$log" | sed -E 's/.*(CUDA0|CUDA_Host)/\1/' | tr '\n' ';')"
  grep -m2 -iE "out of memory|failed to" "$log"
done
