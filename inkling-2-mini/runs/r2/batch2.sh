#!/usr/bin/env bash
# Round 2 batch 2: the shipped flags (serve.sh defaults, IQ4_NL, 64k) on master 225a5345b + the two F16-mask patches. Full round-1 gate (#11).
cd "$(dirname "$0")/../.."
echo "#### $(date +%T) r2-inkfix-64k"
INK_BIN=/mnt/scratch/llama.cpp/r2inkfix-19c41d2ff/bin tools/serverrun.sh r2-inkfix-64k --reps 3 --pp 8000,32000 --depths 0,32000 --needles 32000,62000
echo "#### done $(date +%T) exit $?"
