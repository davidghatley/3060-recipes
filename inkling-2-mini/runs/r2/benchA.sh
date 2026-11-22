#!/usr/bin/env bash
# Round 2, step 1: tuned flags (IQ4_NL, core on GPU, q8_0 KV, ub 128) on each build, controls on the old pin at both ends.
cd "$(dirname "$0")/../.."
L=/mnt/scratch/llama.cpp
CORE='blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'
run() { echo "== $(date +%T) $1 ($2)"; INK_BIN=$L/$2/bin tools/bench.sh "$1" -ot "$CORE" -ctk q8_0 -ctv q8_0 -ub 128 -b 2048 -p 2048 -n 64 -r 6; }
run r2a-1-ctl-pin      master-29b52d398
run r2a-2-master225    master-225a5345b
run r2a-3-ctl-pin      master-29b52d398
run r2a-4-r2inkfix     r2inkfix-19c41d2ff
run r2a-5-pr32740      pr32740-3afe9c3c8
run r2a-6-pr32752      pr32752-d66e7bfe2
run r2a-7-master225    master-225a5345b
run r2a-8-ctl-pin      master-29b52d398
echo "== done $(date +%T)"
