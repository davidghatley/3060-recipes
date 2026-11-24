# b09: raw codeeval answers (why "no code block"), then two multi-slot layouts under a 4 x long-needle soak
# (b08-multi, 4 x 64k slots + DFlash + ub 1024, ran out of VRAM in cudaGraphInstantiate under 4 x 60k prompts).
cd "$(dirname "$0")/../.."
date; tools/srv.sh b09-default -- python3 -I tools/codeeval_dump.py --label b09-default --n 3
date; tools/srv.sh b09-multi-df32k NB_PROFILE=multi NB_CTX=131072 NB_UBATCH=512 -- tools/soak.sh b09-multi-df32k 4 30000
date; tools/srv.sh b09-multi-ns64k NB_PROFILE=multi NB_SPEC=none -- tools/soak.sh b09-multi-ns64k 4 60000
date
echo BATCH-DONE
