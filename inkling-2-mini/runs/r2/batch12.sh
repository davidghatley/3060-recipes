#!/usr/bin/env bash
# Round 2 batch 12: chat / math / code / image smoke test on the new shipped build (IQ4_NL, 32k, mmproj Q8_0), as round-1 row 13.
cd "$(dirname "$0")/../.."
label=r2-smoke-iq4nl-32k
echo "#### $(date +%T) $label"
INK_CONTEXT=32768 INK_MMPROJ=/mnt/models/llm/inkling-2-mini/mmproj-Inkling-2-Mini-Q8_0.gguf \
  INK_TEST="python3 -I tools/smoke.py --url http://127.0.0.1:8097 --image > runs/smoke-$label.json" tools/serverrun.sh "$label"; echo "   exit $?"
echo "#### done $(date +%T)"
