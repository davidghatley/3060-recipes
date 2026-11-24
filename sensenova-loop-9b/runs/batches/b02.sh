# b02: MTP (needs VRAM: q8_0 K/V), Sinkhorn iteration count (lossy, speed only here), ubatch, and a no-CUDA-graph diagnostic.
# Control = 128k f16 (= what stock --fit picks, b01). Decode x6 x256 + pp 8k x2 each.
cd "$(dirname "$0")/../.."
T='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000 --depths 0; tools/mem.sh $LABEL'
date; tools/srv.sh b02-ctl-a -- bash -c "$T"
date; tools/srv.sh b02-q8 SNL_KV=q8_0 -- bash -c "$T"
date; tools/srv.sh b02-q8-mtp1 SNL_KV=q8_0 SNL_SPEC=mtp SNL_DRAFT_N=1 -- bash -c "$T"
date; tools/srv.sh b02-q8-mtp2 SNL_KV=q8_0 SNL_SPEC=mtp SNL_DRAFT_N=2 -- bash -c "$T"
date; tools/srv.sh b02-ctl-b -- bash -c "$T"
date; tools/srv.sh b02-q8-mtp3 SNL_KV=q8_0 SNL_SPEC=mtp SNL_DRAFT_N=3 -- bash -c "$T"
date; tools/srv.sh b02-sk10 "SNL_EXTRA=--override-kv sensenova_loop.mhc.iterations=int:10" -- bash -c "$T"
date; tools/srv.sh b02-sk4 "SNL_EXTRA=--override-kv sensenova_loop.mhc.iterations=int:4" -- bash -c "$T"
date; tools/srv.sh b02-ub1024 SNL_UBATCH=1024 -- bash -c "$T"
date; tools/srv.sh b02-ctl-c -- bash -c "$T"
date; tools/srv.sh b02-nographs GGML_CUDA_DISABLE_GRAPHS=1 -- bash -c "$T"
date
