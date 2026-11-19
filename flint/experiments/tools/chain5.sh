#!/usr/bin/env bash
cd "$(dirname "$0")/.."
until grep -q "B3 done" runs/phaseB3.log 2>/dev/null; do sleep 15; done
tools/phaseB2b.sh > runs/phaseB2b.log 2>&1
