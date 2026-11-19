#!/usr/bin/env bash
cd "$(dirname "$0")/.."
until grep -q "chain done" runs/phaseCD.log 2>/dev/null; do sleep 15; done
tools/phaseB2.sh > runs/phaseB2.log 2>&1
