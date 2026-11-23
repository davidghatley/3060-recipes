#!/usr/bin/env bash
# After b04b's gpu_run (pid $1) exits: install the tuned serve.sh defaults (old file moved aside), then run b05..b08,
# each in its own gpu_run hold (the lock is released between batches for the other recipe agent).
cd "$(dirname "$0")/../.."
while kill -0 "$1" 2>/dev/null; do sleep 15; done
T=/mnt/scratch/tmp-sensenova-loop-9b
mv serve.sh "$T/serve.sh.pre-b05" && cp "$T/serve.sh.new" serve.sh && chmod +x serve.sh
echo "serve.sh defaults installed $(date)"
for b in b05 b06 b07 b08; do
  echo "$b start $(date)"; tools/gpu_batch.sh runs/batches/$b.sh > runs/batches/$b.log 2>&1; echo "$b end rc=$? $(date)"
done
