# b04: window probes (load + 3k prompt + 2 decodes), then the local Q8_0-head copy (lossy, labelled) vs controls
# with and without MTP n=2 (32k f16), then KLD of the Q8_0 head and of q8_0 K/V against the published file.
cd "$(dirname "$0")/../.."
P='python3 -I tools/srvtest.py --label $LABEL --reps 2 --max 64 --pp 3000 --depths 0; tools/mem.sh $LABEL'
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000 --depths 0; python3 -I tools/srvtest.py --label $LABEL-think --think on --reps 6 --max 512 --depths 0; tools/mem.sh $LABEL'
C="QH_CTX=32768 QH_KV=f16"
date; tools/srv.sh b04-mtp-96k-q8 QH_CTX=98304 QH_KV=q8_0 QH_SPEC=mtp -- bash -c "$P"
date; tools/srv.sh b04-mtp-128k-q4 QH_CTX=131072 QH_KV=q4_0 QH_SPEC=mtp -- bash -c "$P"
date; tools/srv.sh b04-128k-q8 QH_CTX=131072 QH_KV=q8_0 -- bash -c "$P"
date; tools/srv.sh b04-192k-q4 QH_CTX=196608 QH_KV=q4_0 -- bash -c "$P"
date; tools/srv.sh b04-256k-q4-ub256 QH_CTX=262144 QH_KV=q4_0 QH_UBATCH=256 -- bash -c "$P"
date; tools/srv.sh b04-ctl-a $C -- bash -c "$T"
date; tools/srv.sh b04-headq8 $C QH_MODEL=/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf -- bash -c "$T"
date; tools/srv.sh b04-ctl-b $C -- bash -c "$T"
date; tools/srv.sh b04-mtp2 $C QH_SPEC=mtp -- bash -c "$T"
date; tools/srv.sh b04-headq8-mtp2 $C QH_SPEC=mtp QH_MODEL=/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf -- bash -c "$T"
date; tools/srv.sh b04-mtp2-b $C QH_SPEC=mtp -- bash -c "$T"
date; tools/kld.sh base; tools/kld.sh headq8 /mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf; tools/kld.sh kv-q8 /mnt/models/llm/qwen35-9b-heretic/Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf -ctk q8_0 -ctv q8_0
date
