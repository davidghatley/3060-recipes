# b13: full measurement set for the revised default (published file, MTP n=2, 64k f16 K/V: b11 showed f16 K/V +19%
# for MTP at 58k), plus greedy MTP-vs-no-spec with thinking on at this layout.
cd "$(dirname "$0")/../.."
date; tools/srv.sh b13-default -- bash -c 'tools/measure.sh b13-default 65536; python3 -I tools/greedy.py --label b13-default-think --think on --out runs/greedy --max 600 --n 4 | cut -c1-100'
date; tools/srv.sh b13-nospec-f16 QH_SPEC=none -- python3 -I tools/greedy.py --label b13-nospec-think --think on --out runs/greedy --max 600 --n 4
date
