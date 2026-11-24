#!/usr/bin/env bash
# Soak for the multi profile: N simultaneous needle requests of ~T tokens each (one per slot), all must be 3/3.
#   tools/soak.sh <label> [N=4] [T=60000]     (test command of tools/srv.sh, server on $PORT)
cd "$(dirname "$0")/.."
l=$1; n=${2:-4}; t=${3:-60000}
for i in $(seq "$n"); do python3 -I tools/srvtest.py --label "$l-soak$i" --reps 0 --depths "" --needles "$t" & done
wait
python3 -I tools/concurrent.py --label "$l" --n "$n" --rounds 3 --max 256 | tail -1
tools/mem.sh "$l"
