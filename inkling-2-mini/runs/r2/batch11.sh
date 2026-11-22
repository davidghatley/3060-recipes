#!/usr/bin/env bash
# Round 2 batch 11: full round-1 gate + coding eval for the NVFP4 repack at 64k on the shipped build (the "best quality" config).
cd "$(dirname "$0")/../.."
label=r2-nvfp4-64k
echo "#### $(date +%T) $label"
INK_QUANT=nvfp4 INK_TEST="python3 -I tools/srvtest.py --label $label --reps 3 --pp 8000,32000 --depths 0,32000 --needles 32000,62000 && python3 -I tools/codeeval.py --label $label" \
  tools/serverrun.sh "$label"; echo "   exit $?"
echo "#### done $(date +%T)"
