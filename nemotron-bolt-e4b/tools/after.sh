#!/usr/bin/env bash
# Run a GPU batch after another batch's gpu_run (given by PID) has exited:  tools/after.sh <pid> <batch.sh>
pid=$1; shift
while kill -0 "$pid" 2>/dev/null; do sleep 15; done
exec "$(dirname "$0")/gpu_batch.sh" "$@"
