# b02: DFlash draft length (control = n7) and DFlash prefill vs ubatch. pp 8k+32k, decode d0 off/on x6.
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000,32000 --depths 0; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 6 --max 512 --depths 0; tools/mem.sh $LABEL'
date; tools/srv.sh b02-df7-a NB_SPEC=dflash -- bash -c "$T"
date; tools/srv.sh b02-df3 NB_SPEC=dflash NB_DRAFT_N=3 -- bash -c "$T"
date; tools/srv.sh b02-df5 NB_SPEC=dflash NB_DRAFT_N=5 -- bash -c "$T"
date; tools/srv.sh b02-df7-b NB_SPEC=dflash -- bash -c "$T"
date; tools/srv.sh b02-df7-ub2048 NB_SPEC=dflash NB_UBATCH=2048 -- bash -c "$T"
date; tools/srv.sh b02-df7-c NB_SPEC=dflash -- bash -c "$T"
date
