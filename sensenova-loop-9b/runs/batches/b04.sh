# b04: how large a window fits. Load + one 3k-token request + 3 short decodes per config (VRAM after the request).
cd "$(dirname "$0")/../.."
P='python3 -I tools/srvtest.py --label $LABEL --reps 3 --max 128 --pp 3000 --depths 0; tools/mem.sh $LABEL'
M="SNL_SPEC=mtp SNL_DRAFT_N=2"
date; tools/srv.sh b04-mtp2-256k-q4 SNL_CTX=262144 SNL_KV=q4_0 $M -- bash -c "$P"
date; tools/srv.sh b04-mtp2-192k-q8 SNL_CTX=196608 SNL_KV=q8_0 $M -- bash -c "$P"
date; tools/srv.sh b04-384k-q4 SNL_CTX=393216 SNL_KV=q4_0 -- bash -c "$P"
date; tools/srv.sh b04-512k-q4 SNL_CTX=524288 SNL_KV=q4_0 -- bash -c "$P"
date; tools/srv.sh b04-mtp2-384k-q4 SNL_CTX=393216 SNL_KV=q4_0 $M -- bash -c "$P"
date; tools/srv.sh b04-256k-q8 SNL_CTX=262144 SNL_KV=q8_0 -- bash -c "$P"
date
