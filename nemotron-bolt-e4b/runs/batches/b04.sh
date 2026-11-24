# b04: DFlash + ub 1024 (prefill), DFlash probabilistic draft sampling (acceptance at temp 1.0). 12 reps.
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 12 --max 256 --pp 8000,32000 --depths 0; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 12 --max 512 --depths 0; tools/mem.sh $LABEL'
date; tools/srv.sh b04-df-a NB_SPEC=dflash -- bash -c "$T"
date; tools/srv.sh b04-df-ub1024 NB_SPEC=dflash NB_UBATCH=1024 -- bash -c "$T"
date; tools/srv.sh b04-df-prob NB_SPEC=dflash "NB_DRAFT_EXTRA=--spec-draft-sampling probabilistic" -- bash -c "$T"
date; tools/srv.sh b04-df-b NB_SPEC=dflash -- bash -c "$T"
date
echo BATCH-DONE
