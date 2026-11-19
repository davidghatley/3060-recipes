#!/usr/bin/env bash
cd "$(dirname "$0")/.."
until grep -q "B2 done" runs/phaseB2.log 2>/dev/null; do sleep 15; done
tools/phaseB3.sh > runs/phaseB3.log 2>&1
