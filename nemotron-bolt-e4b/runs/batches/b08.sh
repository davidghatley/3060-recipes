# b08: full measurement set for stock (the baseline), then the multi profile soak (4 x 60k needles at once).
cd "$(dirname "$0")/../.."
date; tools/srv.sh b08-stock NB_PROFILE=stock -- tools/measure.sh b08-stock 65536
date; tools/srv.sh b08-multi NB_PROFILE=multi -- tools/soak.sh b08-multi 4 60000
date
echo BATCH-DONE
