# Batch 12: pi on the long profile (128k): prefill 8k/32k/~120k, decode empty and at ~120k, needles at 64k and ~124k.
set -u
cd "$(dirname "$0")/.."
READY_WAIT=300 tools/srv.sh b12-pi-long VARIANT=pi Q38_PROFILE=long Q38_EXTRA="-lv 4" -- tools/measure.sh b12-pi-long 131072 noeval 2>&1 | grep -vE '^\s*$'
