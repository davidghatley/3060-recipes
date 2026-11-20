#!/usr/bin/env bash
# Run a list of llama-bench invocations inside ONE gpu_run session, with nvidia-smi telemetry.
#   tools/benchsession.sh <name> <planfile>
# planfile: one llama-bench run per line: "<label> | <ENV=val ...> | <llama-bench args>" (# comments ok).
# Model paths may use $D (/mnt/models/llm/qwen3.5-4b-3d-coder). -ngl 99 and -o jsonl are always added.
# Output: runs/bench-<name>/<label>.jsonl, dmon.txt, and a summary via tools/summarize.py.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
name=${1:?name}; plan=${2:?planfile}
BIN=${QC_BIN:-/mnt/scratch/llama.cpp/b12242/bin/llama-b12242}
CUDA_LIB=${QC_CUDA_LIB:-/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64}
out=$ROOT/runs/bench-$name; mkdir -p "$out"
cp "$plan" "$out/plan.txt"
if [[ -z ${QC_INSIDE:-} ]]; then
  exec env QC_INSIDE=1 GPU_RUN_MEM=${GPU_RUN_MEM:-24G} "$HOME/anime-pipeline/tools/gpu_run" --need 10000 --wait 7200 "$0" "$@"
fi
export D=${QC_MODELS:-/mnt/models/llm/qwen3.5-4b-3d-coder}
nvidia-smi dmon -s pucm -d 1 > "$out/dmon.txt" 2>&1 &
dmon=$!
trap 'kill $dmon 2>/dev/null || true' EXIT
echo "start $(date -Is) $(nvidia-smi --query-gpu=temperature.gpu,clocks.sm,clocks.mem,pstate --format=csv,noheader)" | tee "$out/session.log"
python3 -I "$ROOT/tools/gpubw.py" "$CUDA_LIB" 2>&1 | tee -a "$out/session.log"
while IFS= read -r line; do
  [[ -z ${line// } || $line == \#* ]] && continue
  label=$(echo "${line%%|*}" | xargs); rest=${line#*|}
  envs=$(echo "${rest%%|*}" | xargs); args=$(eval echo "${rest#*|}")
  echo "== $label :: $envs :: $args" | tee -a "$out/session.log"
  env LD_LIBRARY_PATH="$BIN:$CUDA_LIB" $envs "$BIN/llama-bench" -ngl 99 -o jsonl $args < /dev/null > "$out/$label.jsonl" 2> "$out/$label.err" \
    || echo "FAILED $label (see $label.err)" | tee -a "$out/session.log"
done < "$plan"
echo "end $(date -Is) $(nvidia-smi --query-gpu=temperature.gpu,clocks.sm,clocks.mem,pstate --format=csv,noheader)" | tee -a "$out/session.log"
python3 -I "$ROOT/tools/summarize.py" "$out"/*.jsonl | tee "$out/summary.txt"
