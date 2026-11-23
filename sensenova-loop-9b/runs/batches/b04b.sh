# b04b: b04's 256k+ windows failed on the flash-attention compute buffer (1360 MiB at 256k q8_0, 2000 at 384k, 2640 at
# 512k, ub 512), not on K/V. The compute buffer scales with ubatch, so: same probes at ub 256 / 128 (no speculation).
cd "$(dirname "$0")/../.."
P='python3 -I tools/srvtest.py --label $LABEL --reps 3 --max 128 --pp 3000 --depths 0; tools/mem.sh $LABEL'
date; tools/srv.sh b04b-512k-q4-ub256 SNL_CTX=524288 SNL_KV=q4_0 SNL_UBATCH=256 -- bash -c "$P"
date; tools/srv.sh b04b-512k-q4-ub128 SNL_CTX=524288 SNL_KV=q4_0 SNL_UBATCH=128 -- bash -c "$P"
date; tools/srv.sh b04b-384k-q4-ub256 SNL_CTX=393216 SNL_KV=q4_0 SNL_UBATCH=256 -- bash -c "$P"
date; tools/srv.sh b04b-256k-q8-ub256 SNL_CTX=262144 SNL_KV=q8_0 SNL_UBATCH=256 -- bash -c "$P"
date; tools/srv.sh b04b-256k-q4-ub512 SNL_CTX=262144 SNL_KV=q4_0 -- bash -c "$P"
date
