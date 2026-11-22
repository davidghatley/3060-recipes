#!/usr/bin/env bash
# Round 2 batch 8: output check for the two PR builds (same PPL rows as #18): core on GPU with and without op offload, and the NaN row.
cd "$(dirname "$0")/../.."
for b in pr32740-3afe9c3c8 pr32752-d66e7bfe2; do
  NP_ROWS="core-opon core-nopo all-opon" INK_BIN=/mnt/scratch/llama.cpp/$b/bin tools/nanprobe.sh r2-$b
done
echo "#### done $(date +%T)"
