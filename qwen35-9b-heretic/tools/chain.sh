#!/usr/bin/env bash
# Launch batches one after another (each its own gpu_run hold, so other recipes can take the lock in between).
#   tools/chain.sh b06 b07 ...   (detached; each waits for the previous log's "end rc=" line)
cd "$(dirname "$0")/.."
setsid nohup bash -c 'for b in "$@"; do tools/launch.sh "$b" >/dev/null; until grep -q "^end rc=" "runs/batches/$b.log" 2>/dev/null; do sleep 20; done; done' _ "$@" > /dev/null 2>&1 < /dev/null &
echo "chain $* pid $!"
