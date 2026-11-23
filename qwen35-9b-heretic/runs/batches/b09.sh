# b09: measurement sets (no codeeval) for the nospec (128k q8_0) and long (192k q4_0) profiles.
cd "$(dirname "$0")/../.."
date; tools/srv.sh b09-nospec QH_PROFILE=nospec -- tools/measure.sh b09-nospec 131072 noeval
date; tools/srv.sh b09-long QH_PROFILE=long -- tools/measure.sh b09-long 196608 noeval
date
