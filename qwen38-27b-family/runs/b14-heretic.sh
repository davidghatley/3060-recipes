# Batch 14: confirm the tuned config on heretic (control / tuned / control), then its measurement set.
set -u; cd "$(dirname "$0")/.."
tools/member.sh heretic b14 '7 8 9 10 11 12 13 14 15 16' '3 4 5 6 7 8 9 10 11 12' '28 30 32 34 36 38 40' refusal
