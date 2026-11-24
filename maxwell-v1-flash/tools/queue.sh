#!/usr/bin/env bash
# Run batch files one after another, each its own gpu_run turn:  tools/queue.sh runs/batches/a.sh runs/batches/b.sh ...
# Each batch logs to runs/batches/<name>.log
R=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd); cd "$R"
for b in "$@"; do n=$(basename "$b" .sh); echo "== $n $(date +%T)"; tools/batch.sh "$b" > "runs/batches/$n.log" 2>&1; echo "== $n exit $? $(date +%T)"; done
