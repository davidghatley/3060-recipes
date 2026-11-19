#!/usr/bin/env bash
# 64k cache profile: rerun with ngram spec on, and once with spec off, code + prose only.
cd "$(dirname "$0")/.."
export TESTS="warmup|--reps 3 --skip cold11k|" FLINT_CONTEXT=65536 FLINT_CPU_MOE=49
echo "== $(date +%T) F2-c5248-64k-spec"
FLINT_SPEC=ngram-map-k tools/srv.sh F2-c5248-64k-spec -- -lv 4 --moe-cache-mib 5248 --moe-cache-cpu-share 0.95
echo "== $(date +%T) F2-c5248-64k-nospec"
FLINT_SPEC=none tools/srv.sh F2-c5248-64k-nospec -- -lv 4 --moe-cache-mib 5248 --moe-cache-cpu-share 0.95
echo "== F2 done $(date +%T)"
