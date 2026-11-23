# b05: backend sampling (-bs, experimental) on the two candidates: no-spec ub1024 and DFlash ub1024.
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 12 --max 256 --depths 0; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 12 --max 512 --depths 0; python3 -I tools/greedy.py --label $LABEL --out runs/greedy --max 200 --n 4 | cut -c1-140; tools/mem.sh $LABEL'
date; tools/srv.sh b05-ns-a NB_UBATCH=1024 -- bash -c "$T"
date; tools/srv.sh b05-ns-bs NB_UBATCH=1024 NB_EXTRA=-bs -- bash -c "$T"
date; tools/srv.sh b05-ns-b NB_UBATCH=1024 -- bash -c "$T"
date; tools/srv.sh b05-df-a NB_UBATCH=1024 NB_SPEC=dflash -- bash -c "$T"
date; tools/srv.sh b05-df-bs NB_UBATCH=1024 NB_SPEC=dflash NB_EXTRA=-bs -- bash -c "$T"
date; tools/srv.sh b05-df-b NB_UBATCH=1024 NB_SPEC=dflash -- bash -c "$T"
date
echo BATCH-DONE
