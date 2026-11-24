# Batch 13: does MTP change the output? 16k fast profile, greedy (temp 0, top-k 1), 8 prompts x 1000 tokens,
# no speculation vs MTP n=2 (FFN 0-6 in RAM, the fewest that load), then compare token by token.
set -u
cd "$(dirname "$0")/.."
READY_WAIT=300 tools/srv.sh b13-nospec VARIANT=pi Q38_PROFILE=fast -- python3 -I tools/greedy.py --label b13-nospec --out runs/greedy --max 1000 | cut -c1-140
READY_WAIT=300 tools/srv.sh b13-mtp2 VARIANT=pi Q38_PROFILE=fast Q38_SPEC=mtp Q38_DRAFT_N=2 Q38_FFN_CPU=7 -- python3 -I tools/greedy.py --label b13-mtp2 --out runs/greedy --max 1000 | cut -c1-140
python3 -I tools/greedy.py --compare runs/greedy/greedy-b13-nospec.json runs/greedy/greedy-b13-mtp2.json
