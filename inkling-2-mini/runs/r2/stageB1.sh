#!/usr/bin/env bash
# Round 2, step 1: the shipped flags (serve.sh defaults, IQ4_NL, 64k) on STOCK master 225a5345b, full round-1 gate (#11).
cd "$(dirname "$0")/../.."
until grep -q "^== done" runs/r2/benchA.log; do sleep 10; done
echo "== $(date +%T) r2-master225-64k"
INK_BIN=/mnt/scratch/llama.cpp/master-225a5345b/bin tools/serverrun.sh r2-master225-64k --reps 3 --pp 8000,32000 --depths 0,32000 --needles 32000,62000
echo "== done $(date +%T) exit $?"
