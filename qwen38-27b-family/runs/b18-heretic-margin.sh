# Batch 18: heretic's default placement (FFN 0-7) passes one deep request, then dies in cudaGraphInstantiate (OOM)
# a few requests later, twice (b14, b17). Two more FFN layers in RAM for margin, full measurement set again;
# fast and long one layer more than their fit, checked deep.
set -u
cd "$(dirname "$0")/.."
READY_WAIT=300 tools/srv.sh b18-heretic-default VARIANT=heretic Q38_FFN_CPU=10 Q38_THINK=off Q38_EXTRA="-lv 4" -- tools/measure.sh b18-heretic-default 32768 refusal 2>&1 | grep -vE '^\s*$|^b18-heretic-default [0-7] '
READY_WAIT=300 tools/srv.sh b18-heretic-fast VARIANT=heretic Q38_PROFILE=fast Q38_FFN_CPU=5 Q38_THINK=off -- python3 -I tools/srvtest.py --label b18-heretic-fast --reps 6 --max 256 --pp 8000,15000 --depths 0,15000 --needles 8000,14800 2>&1 | grep -E 'med|needle|exited|Error'
READY_WAIT=300 tools/srv.sh b18-heretic-long VARIANT=heretic Q38_PROFILE=long Q38_FFN_CPU=37 Q38_THINK=off -- python3 -I tools/srvtest.py --label b18-heretic-long --reps 3 --max 128 --depths 0,32000 --needles 64000 2>&1 | grep -E 'med|needle|exited|Error'
