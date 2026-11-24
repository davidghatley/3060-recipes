# b10: refusal probe (thinking off at 400 tokens; thinking on at 3000), then long answers with a 24k cap under the
# default profile (MTP n=2): the marble problem and the three.js page, the two longest answers in b02/b03.
cd "$(dirname "$0")/../.."
date; tools/srv.sh b10-refusal-off QH_THINK=off -- python3 -I ../scripts/refusal_probe.py --url http://127.0.0.1:8106 --label b10-think-off --out runs
date; tools/srv.sh b10-default -- bash -c 'python3 -I ../scripts/refusal_probe.py --url http://127.0.0.1:8106 --label b10-think-on --out runs --max-tokens 3000 | tail -1; python3 -I tools/longans.py --label b10-mtp2-24k --max 24000 --n 1 --skip 2; python3 -I tools/longans.py --label b10-mtp2-24k-threejs --max 24000 --n 1'
date
