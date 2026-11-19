#!/usr/bin/env bash
cd "$(dirname "$0")/.."
tools/moetune.sh cmoe-128k all 131072
tools/moetune.sh cmoe-64k  all 65536
echo "== tunes done"
