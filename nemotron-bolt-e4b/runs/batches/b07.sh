# b07: full measurement set (tools/measure.sh, 64k window) for the tuned default and the nospec profile.
cd "$(dirname "$0")/../.."
date; tools/srv.sh b07-default -- tools/measure.sh b07-default 65536
date; tools/srv.sh b07-nospec NB_PROFILE=nospec -- tools/measure.sh b07-nospec 65536 noeval
date
echo BATCH-DONE
