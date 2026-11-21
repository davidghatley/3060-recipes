#!/usr/bin/env bash
# Phase 2: Inkling, serve.sh defaults (3 passes, cached prefix), calib split then test split.
# Batches of <= 1700 s; the GPU lock is released between batches.
set -uo pipefail
here=$(cd "$(dirname "$0")/../.." && pwd)
for s in calib test; do
  out=/mnt/work/jev-index/runs/inkling-3pass-$s
  for b in $(seq 1 30); do
    echo "== $s batch $b $(date +%T)"
    "$here/eval/run_batch.sh" /mnt/work/jev-index/splits-ink/$s.jsonl.gz "$out" label=inkling-3pass
    rc=$?; echo "rc $rc $(date +%T)"
    [ $rc -eq 0 ] && break
    [ $rc -ne 10 ] && { echo "stopping: rc $rc"; exit $rc; }
    sleep 20
  done
done
echo "phase2 done $(date +%T)"
