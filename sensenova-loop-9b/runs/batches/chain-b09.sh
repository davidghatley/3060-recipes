#!/usr/bin/env bash
# Run b09 after the b05-b08 chain (pid $1) has finished.
cd "$(dirname "$0")/../.."
while kill -0 "$1" 2>/dev/null; do sleep 15; done
echo "b09 start $(date)"; tools/gpu_batch.sh runs/batches/b09.sh > runs/batches/b09.log 2>&1; echo "b09 end rc=$? $(date)"
