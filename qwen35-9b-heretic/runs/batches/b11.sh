# b11: why MTP gains little deep in the window. Decode x6 x256 at 58k context, 64k window: MTP vs no spec, f16 vs q8_0 K/V
# (hypothesis: batched verify over quantized K/V takes a slower flash-attention path than single-token decode).
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --depths 58000; tools/mem.sh $LABEL'
date; tools/srv.sh b11-ns-q8 QH_CTX=65536 QH_KV=q8_0 QH_SPEC=none -- bash -c "$T"
date; tools/srv.sh b11-mtp-q8 QH_CTX=65536 QH_KV=q8_0 QH_SPEC=mtp -- bash -c "$T"
date; tools/srv.sh b11-mtp-f16 QH_CTX=65536 QH_KV=f16 QH_SPEC=mtp -- bash -c "$T"
date; tools/srv.sh b11-ns-f16 QH_CTX=65536 QH_KV=f16 QH_SPEC=none -- bash -c "$T"
date; tools/srv.sh b11-mtp-q8-b QH_CTX=65536 QH_KV=q8_0 QH_SPEC=mtp -- bash -c "$T"
date
