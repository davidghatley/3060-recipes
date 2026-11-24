# b01: stock (llama-server defaults, fit on) vs control (32k f16, fa on, np 1), MTP n=1/2/3, q8_0 K/V.
# Decode x6 x256 at depth 0 (thinking off), x6 x512 thinking on; pp 8k x2. Greedy 3 prompts x200.
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000 --depths 0; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 6 --max 512 --depths 0; python3 -I tools/greedy.py --label $LABEL --out runs/greedy --max 200 --n 3 | cut -c1-160; tools/mem.sh $LABEL'
C="QH_CTX=32768 QH_KV=f16"
date; tools/srv.sh b01-stock QH_PROFILE=stock -- bash -c "$T"
date; tools/srv.sh b01-ctl-a $C -- bash -c "$T"
date; tools/srv.sh b01-mtp2 $C QH_SPEC=mtp QH_DRAFT_N=2 -- bash -c "$T"
date; tools/srv.sh b01-ctl-b $C -- bash -c "$T"
date; tools/srv.sh b01-mtp1 $C QH_SPEC=mtp QH_DRAFT_N=1 -- bash -c "$T"
date; tools/srv.sh b01-mtp3 $C QH_SPEC=mtp QH_DRAFT_N=3 -- bash -c "$T"
date; tools/srv.sh b01-ctl-c $C -- bash -c "$T"
date
