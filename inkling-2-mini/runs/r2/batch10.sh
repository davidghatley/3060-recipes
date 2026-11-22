#!/usr/bin/env bash
# Round 2 batch 10: gate for the MoE cache at 32k (IQ4_NL, shipped build): pp 8k, decode, needles in a 30k prompt; control without the cache.
cd "$(dirname "$0")/../.."
export INK_BIN=/mnt/scratch/llama.cpp/r2inkfix-19c41d2ff/bin INK_CONTEXT=32768
run() { local label=$1; shift; echo "#### $(date +%T) $label"; env "$@" tools/serverrun.sh "$label" --reps 3 --pp 8000 --depths 0 --needles 30000; echo "   exit $?"; }
run r2-moe-iq4nl-32k-gate-ctl INK_X=0
run r2-moe-iq4nl-32k-gate-c768 INK_MOE_CACHE_MIB=768
echo "#### done $(date +%T)"
