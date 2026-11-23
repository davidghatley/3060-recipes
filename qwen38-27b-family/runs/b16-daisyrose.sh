# Batch 16: confirm the tuned config on daisyrose (control / tuned / control), then its measurement set.
set -u; cd "$(dirname "$0")/.."
tools/member.sh daisyrose b16 '4 5 6 7 8 9 10 11 12 13 14' '1 2 3 4 5 6 7 8 9 10' '22 24 26 28 30 32 34' 
