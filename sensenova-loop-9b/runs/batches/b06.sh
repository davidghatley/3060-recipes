# b06: default variant quality. Shipped profile with thinking off (server-wide): codeeval, refusal probe, greedy;
# then greedy with thinking on, shipped (MTP) vs the same without speculation; then the image smoke test.
cd "$(dirname "$0")/../.."
G='python3 -I tools/greedy.py --label $LABEL --out runs/greedy --think on --max 600 | cut -c1-150'
date; tools/srv.sh b06-def-nothink SNL_THINK=off -- bash -c 'python3 -I ../scripts/codeeval.py --url http://127.0.0.1:$PORT --out runs --label $LABEL --max 2048 | tail -3; python3 -I ../scripts/refusal_probe.py --url http://127.0.0.1:$PORT --label $LABEL --out runs | tail -3; tools/mem.sh $LABEL'
date; tools/srv.sh b06-def-greedy-think -- bash -c "$G"
date; tools/srv.sh b06-def-nospec-greedy-think SNL_SPEC=none -- bash -c "$G"
date; tools/srv.sh b06-def-mmproj SNL_MMPROJ=auto -- bash -c 'python3 -I tools/smoke.py --url http://127.0.0.1:$PORT --image > runs/smoke-$LABEL.json || exit 1; head -c 1500 runs/smoke-$LABEL.json; tools/mem.sh $LABEL' || \
  tools/srv.sh b06-def-mmproj-small SNL_MMPROJ=auto SNL_CTX=65536 -- bash -c 'python3 -I tools/smoke.py --url http://127.0.0.1:$PORT --image > runs/smoke-$LABEL.json || exit 1; head -c 1500 runs/smoke-$LABEL.json; tools/mem.sh $LABEL'
date
