cd "$(dirname "$0")/../.."
T='python3 -I tools/concurrent.py --label $LABEL --n 4 --rounds 3 --max 256 | tail -1; python3 -I tools/concurrent.py --label $LABEL-c1 --n 1 --rounds 3 --max 256 | tail -1; tools/mem.sh $LABEL'
date; tools/srv.sh b12-np4-ns QH_CTX=131072 QH_KV=q8_0 QH_NP=4 -- bash -c "$T"
date; tools/srv.sh b12-np4-mtp QH_CTX=98304 QH_KV=q8_0 QH_NP=4 QH_SPEC=mtp -- bash -c "$T"
date
