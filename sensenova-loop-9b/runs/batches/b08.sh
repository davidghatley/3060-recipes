# b08: uncensored quality (thinking off: codeeval, refusal probe), speed stock / tuned / stock, image smoke test.
cd "$(dirname "$0")/../.."
S='python3 -I tools/srvtest.py --label $LABEL --reps 6 --max 256 --pp 8000 --depths 0; tools/mem.sh $LABEL'
date; tools/srv.sh b08-unc-nothink VARIANT=uncensored SNL_THINK=off -- bash -c 'python3 -I ../scripts/codeeval.py --url http://127.0.0.1:$PORT --out runs --label $LABEL --max 2048 | tail -3; python3 -I ../scripts/refusal_probe.py --url http://127.0.0.1:$PORT --label $LABEL --out runs | tail -3'
date; tools/srv.sh b08-unc-stock-a VARIANT=uncensored SNL_PROFILE=stock -- bash -c "$S"
date; tools/srv.sh b08-unc-tuned VARIANT=uncensored -- bash -c "$S"
date; tools/srv.sh b08-unc-stock-b VARIANT=uncensored SNL_PROFILE=stock -- bash -c "$S"
date; tools/srv.sh b08-unc-mmproj VARIANT=uncensored SNL_MMPROJ=auto -- bash -c 'python3 -I tools/smoke.py --url http://127.0.0.1:$PORT --image > runs/smoke-$LABEL.json || exit 1; head -c 1500 runs/smoke-$LABEL.json' || \
  tools/srv.sh b08-unc-mmproj-small VARIANT=uncensored SNL_MMPROJ=auto SNL_CTX=65536 -- bash -c 'python3 -I tools/smoke.py --url http://127.0.0.1:$PORT --image > runs/smoke-$LABEL.json || exit 1; head -c 1500 runs/smoke-$LABEL.json'
date
