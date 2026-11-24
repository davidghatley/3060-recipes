# b06: full measurement set, default profile (published file, MTP n=2, 96k q8_0).
cd "$(dirname "$0")/../.."
date; tools/srv.sh b06-default -- tools/measure.sh b06-default 98304
date
