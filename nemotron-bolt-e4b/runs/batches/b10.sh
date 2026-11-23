# b10: codeeval scored strict + lenient (bare code), thinking on and off, on stock and the tuned default.
cd "$(dirname "$0")/../.."
T='python3 -I tools/codeeval_lenient.py --label $LABEL-think --think on | tail -1; python3 -I tools/codeeval_lenient.py --label $LABEL-nothink --think off | tail -1'
date; tools/srv.sh b10-default -- bash -c "$T"
date; tools/srv.sh b10-stock NB_PROFILE=stock -- bash -c "$T"
date
echo BATCH-DONE
