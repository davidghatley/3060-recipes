# b02: window probes (load + 3k prompt + 2 short decodes) then long answers with MTP n=2 (6 prompts, thinking on, 10k cap).
cd "$(dirname "$0")/../.."
P='python3 -I tools/srvtest.py --label $LABEL --reps 2 --max 64 --pp 3000 --depths 0; tools/mem.sh $LABEL'
date; tools/srv.sh b02-mtp-128k-q8 QH_CTX=131072 QH_KV=q8_0 QH_SPEC=mtp -- bash -c "$P"
date; tools/srv.sh b02-mtp-256k-q4 QH_CTX=262144 QH_KV=q4_0 QH_SPEC=mtp -- bash -c "$P"
date; tools/srv.sh b02-256k-q4 QH_CTX=262144 QH_KV=q4_0 -- bash -c "$P"
date; tools/srv.sh b02-256k-q8 QH_CTX=262144 QH_KV=q8_0 -- bash -c "$P"
date; tools/srv.sh b02-mtp-64k-f16 QH_CTX=65536 QH_KV=f16 QH_SPEC=mtp -- bash -c "$P"
date; tools/srv.sh b02-long-mtp2 QH_CTX=32768 QH_KV=f16 QH_SPEC=mtp -- python3 -I tools/longans.py --label b02-mtp2 --max 10000
date
