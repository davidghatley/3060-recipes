# b01: stock (card command) vs tuned-candidate control (fa on, np 1), DFlash n=7 (card), q8_0 K/V. Smoke + medians.
# Decode x6 x256 at depth 0 and 32k (thinking off), x6 x512 at depth 0 thinking on; pp 8k x2.
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000 --depths 0,32000; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 6 --max 512 --depths 0; python3 -I tools/greedy.py --label $LABEL --out runs/greedy --max 200 --n 3 | cut -c1-160; tools/mem.sh $LABEL'
date; tools/srv.sh b01-stock NB_PROFILE=stock -- bash -c "$T"
date; tools/srv.sh b01-ctl-a -- bash -c "$T"
date; tools/srv.sh b01-dflash7 NB_SPEC=dflash -- bash -c "$T"
date; tools/srv.sh b01-ctl-b -- bash -c "$T"
date; tools/srv.sh b01-q8 NB_KV=q8_0 -- bash -c "$T"
date
