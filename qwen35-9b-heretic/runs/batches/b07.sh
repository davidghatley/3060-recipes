# b07: full measurement set, fast profile (local Q8_0-head copy, MTP n=2, 128k q8_0).
cd "$(dirname "$0")/../.."
date; tools/srv.sh b07-fast QH_PROFILE=fast -- tools/measure.sh b07-fast 131072
date
