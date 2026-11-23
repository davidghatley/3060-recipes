# b05: window probes with the Q8_0-head copy; ubatch 1024 and backend sampling (-bs) on MTP n=2 (32k f16) between
# MTP controls; KLD of q4_0 K/V.
cd "$(dirname "$0")/../.."
P='python3 -I tools/srvtest.py --label $LABEL --reps 2 --max 64 --pp 3000 --depths 0; tools/mem.sh $LABEL'
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000 --depths 0; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 6 --max 512 --depths 0; python3 -I tools/greedy.py --label $LABEL --out runs/greedy --max 200 --n 3 | cut -c1-120; tools/mem.sh $LABEL'
C="QH_CTX=32768 QH_KV=f16 QH_SPEC=mtp"
date; tools/srv.sh b05-h8-mtp-128k-q8 QH_MODEL=/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf QH_CTX=131072 QH_KV=q8_0 QH_SPEC=mtp -- bash -c "$P"
date; tools/srv.sh b05-h8-mtp-192k-q4 QH_MODEL=/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf QH_CTX=196608 QH_KV=q4_0 QH_SPEC=mtp -- bash -c "$P"
date; tools/srv.sh b05-h8-256k-q4 QH_MODEL=/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf QH_CTX=262144 QH_KV=q4_0 -- bash -c "$P"
date; tools/srv.sh b05-h8-mtp-256k-q4 QH_MODEL=/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf QH_CTX=262144 QH_KV=q4_0 QH_SPEC=mtp -- bash -c "$P"
date; tools/srv.sh b05-mctl-a $C -- bash -c "$T"
date; tools/srv.sh b05-ub1024 $C QH_UBATCH=1024 -- bash -c "$T"
date; tools/srv.sh b05-mctl-b $C -- bash -c "$T"
date; tools/srv.sh b05-bs $C QH_BS=1 -- bash -c "$T"
date; tools/srv.sh b05-mctl-c $C -- bash -c "$T"
date; tools/kld.sh kv-q4 /mnt/models/llm/qwen35-9b-heretic/Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf -ctk q4_0 -ctv q4_0
date
