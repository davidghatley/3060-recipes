# Batch 17: heretic again (b14's control did not load because serve.sh passed -ngl 99 with --fit on, and its default placement died at 30k).
set -u; cd "$(dirname "$0")/.."
tools/member.sh heretic b17 '8 9 10 11 12' '4 5 6 7 8' '36 38 40' refusal
