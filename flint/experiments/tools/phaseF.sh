#!/usr/bin/env bash
# MoE cache profiles with ngram-map-k speculation on (serve.sh's default), vs the shipped no-cache control.
cd "$(dirname "$0")/.."
export FLINT_SPEC=ngram-map-k TESTS="warmup|--reps 3|depth"
echo "== $(date +%T) F-ctl-128k-spec"
tools/srv.sh F-ctl-128k-spec -- -lv 4
echo "== $(date +%T) F-c2944-128k-spec"
FLINT_CPU_MOE=49 tools/srv.sh F-c2944-128k-spec -- -lv 4 --moe-cache-mib 2944 --moe-cache-cpu-share 0.95
echo "== $(date +%T) F-c5248-64k-spec"
FLINT_CONTEXT=65536 FLINT_CPU_MOE=49 tools/srv.sh F-c5248-64k-spec -- -lv 4 --moe-cache-mib 5248 --moe-cache-cpu-share 0.95
echo "== F done $(date +%T)"
