#!/usr/bin/env bash
# Round 2 batch 6: KLD vs Q8_0 (tools/kld.sh, 24 x 512 wiki + code, experts on the CPU) for IQ4_NL (same-day control) and the Unsloth quants.
cd "$(dirname "$0")/../.."
U=/mnt/models/llm/inkling-2-mini/unsloth/Mainline_Support
INK_BIN=/mnt/scratch/llama.cpp/r2inkfix-19c41d2ff/bin KLD_TAG=r2 tools/kld.sh /mnt/models/llm/inkling-2-mini/Inkling-2-Mini-IQ4_NL.gguf \
  $U/Inkling-2-Mini-UD-IQ2_XXS.gguf $U/Inkling-2-Mini-UD-Q2_K_XL.gguf $U/Inkling-2-Mini-UD-IQ3_XXS.gguf
echo "#### done $(date +%T)"
