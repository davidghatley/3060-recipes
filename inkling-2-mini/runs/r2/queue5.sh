#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
until [ -e runs/r2/queue4.done ]; do sleep 10; done
tools/gpu_batch.sh runs/r2/batch9.sh > runs/r2/batch9.log 2>&1
echo done > runs/r2/queue5.done
