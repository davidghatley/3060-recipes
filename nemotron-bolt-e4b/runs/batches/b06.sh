# b06: drafter BF16 (card file) vs a local Q8_0 copy of it, on the default profile (DFlash n7, ub 1024, -bs). 12 reps.
cd "$(dirname "$0")/../.."
Q8=/mnt/models/llm/nemotron-bolt-e4b/dflash/Nemotron-3.5-Bolt-E4B-DFlash-Q8_0-local.gguf
T='python3 -I tools/srvtest.py --label $LABEL --reps 12 --max 256 --depths 0; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 12 --max 512 --depths 0; python3 -I tools/greedy.py --label $LABEL --out runs/greedy --max 300 | cut -c1-120; tools/mem.sh $LABEL'
date; tools/srv.sh b06-bf16-a -- bash -c "$T"
date; tools/srv.sh b06-q8-a NB_DRAFT=$Q8 -- bash -c "$T"
date; tools/srv.sh b06-bf16-b -- bash -c "$T"
date; tools/srv.sh b06-q8-b NB_DRAFT=$Q8 -- bash -c "$T"
date
echo BATCH-DONE
