#!/usr/bin/env bash
cd "$(dirname "$0")/.."
tools/queue2.sh > runs/queue2.log 2>&1
tools/phaseCD2.sh > runs/phaseCD.log 2>&1
echo "== chain done $(date +%T)" >> runs/phaseCD.log
