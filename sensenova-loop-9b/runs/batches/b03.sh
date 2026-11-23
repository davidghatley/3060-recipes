# b03: confirm MTP n=2 (128k q8_0 K/V) against its own control, thinking off and on; greedy output check; MTP + ub 1024.
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000 --depths 0; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 6 --max 512 --depths 0; tools/mem.sh $LABEL'
G='python3 -I tools/greedy.py --label $LABEL --out runs/greedy --max 400 | cut -c1-150'
Q="SNL_KV=q8_0"; M="SNL_SPEC=mtp SNL_DRAFT_N=2"
date; tools/srv.sh b03-q8-ctl-a $Q -- bash -c "$T; $G"
date; tools/srv.sh b03-q8-mtp2-a $Q $M -- bash -c "$T; $G"
date; tools/srv.sh b03-q8-ctl-b $Q -- bash -c "$T"
date; tools/srv.sh b03-q8-mtp2-ub1024 $Q $M SNL_UBATCH=1024 -- bash -c "$T"
date; tools/srv.sh b03-q8-ctl-c $Q -- bash -c "$T"
date
