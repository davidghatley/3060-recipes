#!/usr/bin/env bash
cd "$(dirname "$0")/.."
until grep -q "sweep done" runs/sweepE-a.log; do sleep 10; done
tools/queue2.sh > runs/queue2.log 2>&1
tools/phaseCD2.sh > runs/phaseCD.log 2>&1
echo "== chain done $(date +%T)" >> runs/phaseCD.log
