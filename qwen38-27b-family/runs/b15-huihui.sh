# Batch 15: confirm the tuned config on huihui (control / tuned / control), then its measurement set.
set -u; cd "$(dirname "$0")/.."
tools/member.sh huihui b15 '0 1 2 3 4 5 6' '0 1 2 3 4' '14 16 18 20 22 24 26 28' refusal
