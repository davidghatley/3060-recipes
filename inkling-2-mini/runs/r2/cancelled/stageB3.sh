#!/usr/bin/env bash
# Round 2, step 1: which builds run the shipped flags at 64k with a real request (stock master OOMs on the first request, B1).
# prlimit --core=1: a CUDA OOM aborts the server, and a core dump would land on / (almost full).
cd "$(dirname "$0")/../.."
until grep -q "^== done" runs/r2/stageC1.log; do sleep 10; done
L=/mnt/scratch/llama.cpp
run() { local label=$1 build=$2; shift 2; echo "== $(date +%T) $label ($build)"; INK_BIN=$L/$build/bin prlimit --core=1 tools/serverrun.sh "$label" "$@"; echo "   exit $?"; }
# is patch 0001 redundant? NVFP4 repack (per-expert scales) on the old pin (expected wrong), old inkfix, new stock master
for b in master-29b52d398 inkfix-4c836a8eb master-225a5345b; do
  NP_ROWS="core-opon" INK_MODEL=/mnt/models/llm/inkling-2-mini/own/Inkling-2-Mini-NVFP4.gguf INK_BIN=$L/$b/bin tools/nanprobe.sh r2-nvfp4-$b
done
run r2-inkfix-64k        r2inkfix-19c41d2ff --reps 3 --pp 8000,32000 --depths 0,32000 --needles 32000,62000
run r2-pr32740-64k-ub128 pr32740-3afe9c3c8  --reps 3 --pp 8000 --depths 0 --needles 62000
INK_UBATCH=512 run r2-pr32740-64k-ub512 pr32740-3afe9c3c8 --reps 3 --pp 8000 --depths 0 --needles 62000
INK_UBATCH=256 run r2-pr32752-64k-ub256 pr32752-d66e7bfe2 --reps 3 --pp 8000 --depths 0 --needles 62000
echo "== done $(date +%T)"
