#!/usr/bin/env bash
# Detached GPU batch: tools/launch.sh bNN  ->  runs/batches/bNN.sh inside one gpu_run hold, log runs/batches/bNN.log,
# last line "end rc=N" (wait for that line, not for a process name).
cd "$(dirname "$0")/.."
b=$1
setsid nohup bash -c "tools/gpu_batch.sh runs/batches/$b.sh; echo \"end rc=\$? \$(date)\"" > "runs/batches/$b.log" 2>&1 < /dev/null &
echo "launched $b pid $!"
