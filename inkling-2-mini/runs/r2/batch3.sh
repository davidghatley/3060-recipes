#!/usr/bin/env bash
# Round 2 batch 3: the same flags at 64k on stock master + PR #32740 (ub 128 and ub 512) and + PR #32752 (ub 256). Short gate.
cd "$(dirname "$0")/../.."
L=/mnt/scratch/llama.cpp
run() { local label=$1 build=$2; shift 2; echo "#### $(date +%T) $label ($build)"; INK_BIN=$L/$build/bin tools/serverrun.sh "$label" "$@"; echo "   exit $?"; }
run r2-pr32740-64k-ub128 pr32740-3afe9c3c8 --reps 3 --pp 8000 --depths 0 --needles 62000
INK_UBATCH=512 run r2-pr32740-64k-ub512 pr32740-3afe9c3c8 --reps 3 --pp 8000 --depths 0 --needles 62000
INK_UBATCH=256 run r2-pr32752-64k-ub256 pr32752-d66e7bfe2 --reps 3 --pp 8000 --depths 0 --needles 62000
echo "#### done $(date +%T)"
