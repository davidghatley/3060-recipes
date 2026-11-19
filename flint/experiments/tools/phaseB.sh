#!/usr/bin/env bash
# Phase B: hand-off profiling with the self-built 3b4d6ab3f + [FLINT-PROF] patch.
set -uo pipefail
cd "$(dirname "$0")/.."
C="-ncmoe 43 -b 4096 -ub 4096 -ctk f16 -ctv f16 -lm none"
b() { echo "== $(date +%T) $*"; tools/bench.sh "$@"; }
ENGINE=prof b B-prof-ctl1   $C -p 0 -n 128 -r 3
ENGINE=prof ENVS="GGML_SCHED_PROF=1" b B-prof-on $C -p 0 -n 128 -r 3
ENGINE=prof ENVS="GGML_SCHED_PROF=2" b B-prof-detail $C -p 0 -n 128 -r 1
ENGINE=prof ENVS="GGML_SCHED_DEBUG=2" b B-sched-debug $C -p 0 -n 4 -r 1
ENGINE=prof b B-prof-ctl2   $C -p 0 -n 128 -r 3
echo "== done $(date +%T)"
