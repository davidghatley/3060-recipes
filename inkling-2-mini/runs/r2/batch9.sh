#!/usr/bin/env bash
# Round 2 batch 9: full round-1 gate + coding eval for IQ4_NL (shipped placement, 64k) on master + PR #32740 at ub 512.
cd "$(dirname "$0")/../.."
label=r2-pr32740-64k-ub512-full
echo "#### $(date +%T) $label"
INK_BIN=/mnt/scratch/llama.cpp/pr32740-3afe9c3c8/bin INK_UBATCH=512 \
  INK_TEST="python3 -I tools/srvtest.py --label $label --reps 3 --pp 8000,32000 --depths 0,32000 --needles 32000,62000 && python3 -I tools/codeeval.py --label $label" \
  tools/serverrun.sh "$label"; echo "   exit $?"
echo "#### done $(date +%T)"
