# b03: no speculation. ubatch 1024/2048 (prefill), fa off (deep decode), 4 parallel slots (aggregate decode).
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000,32000 --depths 0,32000; tools/mem.sh $LABEL'
C='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --depths 0; python3 -I tools/concurrent.py --label $LABEL --n 4 --rounds 3 --max 256; tools/mem.sh $LABEL'
date; tools/srv.sh b03-ctl-a -- bash -c "$T"
date; tools/srv.sh b03-ub1024 NB_UBATCH=1024 -- bash -c "$T"
date; tools/srv.sh b03-ub2048 NB_UBATCH=2048 -- bash -c "$T"
date; tools/srv.sh b03-faoff NB_FA=off -- bash -c "$T"
date; tools/srv.sh b03-ctl-b -- bash -c "$T"
date; tools/srv.sh b03-np4 NB_NP=4 NB_CTX=262144 -- bash -c "$C"
date; tools/srv.sh b03-np4-df NB_NP=4 NB_CTX=262144 NB_SPEC=dflash -- bash -c "$C"
date
