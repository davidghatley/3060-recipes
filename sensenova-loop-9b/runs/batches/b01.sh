# b01: stock baseline, first tuned candidate (128k f16, fa on, no fit), MTP n=2, control again. Decode x6 x256 + pp 8k x2.
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000 --depths 0; tools/mem.sh $LABEL'
date; tools/srv.sh b01-stock SNL_PROFILE=stock -- bash -c "$T"
date; tools/srv.sh b01-ctl-a -- bash -c "$T"
date; tools/srv.sh b01-mtp2 SNL_SPEC=mtp SNL_DRAFT_N=2 -- bash -c "$T"
date; tools/srv.sh b01-ctl-b -- bash -c "$T"
date
