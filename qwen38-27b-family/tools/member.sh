#!/usr/bin/env bash
# Confirm pi's tuned config on another family member (run inside tools/gpu_batch.sh).
#   tools/member.sh <variant> <batch-tag> "<default FFN_CPU candidates>" "<fast candidates>" "<long candidates>" [refusal]
# 1. find the fewest FFN layers in RAM that serve a request deep in the window, per profile (30k / 15k / 32k)
# 2. control (stock flags: --fit on, f16 K/V, ub 512, 32k) / tuned default / control: decode x6, pp 8k x2
# 3. full measurement set on the tuned default (thinking off, like pi), optional refusal probe
# 4. tuned fast and long: decode x6 at empty context
set -u
cd "$(dirname "$0")/.."
v=$1; b=$2; cd_=$3; cf=$4; cl=$5; ref=${6:-}
# A placement must survive a request deep in the window, not just load: b14 found that heretic at the
# fewest-that-loads count passes a 3k prompt and then dies in cudaGraphInstantiate at 30k.
fit() { local prof=$1 ns=$2 depth=$3 n
  for n in $ns; do
    READY_WAIT=300 tools/srv.sh "$b-$v-fit-$prof-ffn$n" VARIANT=$v Q38_PROFILE=$prof Q38_FFN_CPU=$n Q38_THINK=off -- \
      python3 -I tools/srvtest.py --label "$b-$v-fit-$prof-ffn$n" --reps 1 --depths "$depth" --max 32 > runs/.fit.$$ 2>&1
    grep -E "code-|exited" runs/.fit.$$ | head -2 >&2
    grep -q "\"$b-$v-fit-$prof-ffn$n\".*\"case\": \"code-$((depth / 1000))k\"" runs/ledger.jsonl && { echo "$n"; rm -f runs/.fit.$$; return; }
  done; rm -f runs/.fit.$$; echo none; }
nd=$(fit default "$cd_" 30000); echo "FIT $v default FFN_CPU=$nd"
nf=$(fit fast "$cf" 15000);     echo "FIT $v fast FFN_CPU=$nf"
nl=$(fit long "$cl" 32000);     echo "FIT $v long FFN_CPU=$nl"
T="python3 -I tools/srvtest.py --pp 8000 --depths 0 --reps 6 --max 256"
CTL=(VARIANT=$v Q38_PROFILE=default Q38_FIT=on Q38_NGL=auto Q38_KV=f16 Q38_UBATCH=512 Q38_FFN_CPU=0 Q38_THINK=off)
s() { local l=$1; shift; READY_WAIT=300 tools/srv.sh "$l" "$@" -- $T --label "$l" 2>&1 | grep -E 'med|exited|ready after'; }
s "$b-$v-ctl" "${CTL[@]}"
[ "$nd" != none ] && s "$b-$v-tuned" VARIANT=$v Q38_PROFILE=default Q38_FFN_CPU=$nd Q38_THINK=off
s "$b-$v-ctl2" "${CTL[@]}"
[ "$nd" != none ] && READY_WAIT=300 tools/srv.sh "$b-$v-default" VARIANT=$v Q38_PROFILE=default Q38_FFN_CPU=$nd Q38_THINK=off Q38_EXTRA="-lv 4" -- \
  tools/measure.sh "$b-$v-default" 32768 $ref 2>&1 | grep -vE '^\s*$'
[ "$nf" != none ] && s "$b-$v-fast" VARIANT=$v Q38_PROFILE=fast Q38_FFN_CPU=$nf Q38_THINK=off
[ "$nl" != none ] && s "$b-$v-long" VARIANT=$v Q38_PROFILE=long Q38_FFN_CPU=$nl Q38_THINK=off
echo "MEMBER $v done"
