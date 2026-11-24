# b09: long profile (256k, q4_0 K/V, no speculation; the largest window that loads, PLAN #8): measurement set without
# the quality runs, default variant; then a load + short test of the uncensored Q6_K at the same profile.
cd "$(dirname "$0")/../.."
date; tools/srv.sh b09-def-long SNL_PROFILE=long -- bash -c 'tools/measure.sh $LABEL 262144 noeval'
date; tools/srv.sh b09-unc-long VARIANT=uncensored SNL_PROFILE=long -- bash -c 'python3 -I tools/srvtest.py --label $LABEL --reps 3 --max 128 --pp 3000 --depths 0 --needles 131072; tools/mem.sh $LABEL'
date
