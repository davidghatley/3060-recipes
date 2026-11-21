#!/usr/bin/env bash
# Phase 3: test split at 2 and 1 loop passes on the patched build (out of distribution), same settings otherwise.
set -uo pipefail
here=$(cd "$(dirname "$0")/../.." && pwd)
export INK_BIN=/mnt/scratch/llama.cpp/inkfix-loop-73e22d20a/bin
for n in 2 1; do
  out=/mnt/work/jev-index/runs/inkling-${n}pass-test
  for b in $(seq 1 30); do
    echo "== ${n}pass batch $b $(date +%T)"
    "$here/eval/run_batch.sh" /mnt/work/jev-index/splits-ink/test.jsonl.gz "$out" label=inkling-${n}pass -- --override-kv inkling2_loop.loop.count=int:$n
    rc=$?; echo "rc $rc $(date +%T)"
    [ $rc -eq 0 ] && break
    [ $rc -ne 10 ] && { echo "stopping: rc $rc"; exit $rc; }
    sleep 20
  done
done
echo "phase3 done $(date +%T)"
