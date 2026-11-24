# Batch 11: full measurement set for pi on the tuned default (32k) and fast (16k) profiles; refusal probe as the
# non-uncensored reference.
set -u
cd "$(dirname "$0")/.."
READY_WAIT=300 tools/srv.sh b11-pi-default VARIANT=pi Q38_PROFILE=default Q38_EXTRA="-lv 4" -- tools/measure.sh b11-pi-default 32768 refusal 2>&1 | grep -vE '^\s*$'
READY_WAIT=300 tools/srv.sh b11-pi-fast VARIANT=pi Q38_PROFILE=fast Q38_EXTRA="-lv 4" -- tools/measure.sh b11-pi-fast 16384 noeval 2>&1 | grep -vE '^\s*$'
