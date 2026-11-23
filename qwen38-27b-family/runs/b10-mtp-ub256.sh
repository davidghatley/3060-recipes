# Batch 10: MTP n=1 again with the ub 256 savings, at 32k and 16k q4_0: control / MTP / control at each window.
# layers in RAM that fit, then prefill 8k x2 and decode at empty context x6.
set -u
cd "$(dirname "$0")/.."
ot() { local n=$1 s=""; for ((i=0;i<n;i++)); do s+="${s:+|}$i"; done; echo "blk\\.($s)\\.ffn_(up|gate|down)=CPU"; }
T="python3 -I tools/srvtest.py --pp 8000 --depths 0 --reps 6 --max 256"
try() { local l=$1; shift; local ns=$1; shift
  for n in $ns; do
    if READY_WAIT=300 tools/srv.sh "$l-ffn$n" Q38_OT="$(ot $n)" Q38_EXTRA="-lv 4" "$@" -- $T --label "$l-ffn$n" 2>&1 | grep -E 'med|pp-|exited|ready after'; then
      grep -q 'code-0k-med' <(grep "\"$l-ffn$n\"" runs/ledger.jsonl) && { grep -E 'CUDA0 (model|KV|RS|compute) buffer' runs/server-$l-ffn$n.log | sed 's/^[0-9.]* [IWE] //'; return; }
    fi
  done; }
U="Q38_KV=q4_0 Q38_UBATCH=256"
try b10-c32-ctl "3" Q38_CTX=32768 $U
try b10-c32-mtp1 "6 7 8 9" Q38_CTX=32768 $U Q38_SPEC=mtp Q38_DRAFT_N=1
try b10-c32-ctl2 "3" Q38_CTX=32768 $U
try b10-c16-ctl "0 1 2" Q38_CTX=16384 $U
try b10-c16-mtp1 "3 4 5 6 7" Q38_CTX=16384 $U Q38_SPEC=mtp Q38_DRAFT_N=1
try b10-c16-mtp2 "5 6 7 8 9" Q38_CTX=16384 $U Q38_SPEC=mtp Q38_DRAFT_N=2
try b10-c16-ctl2 "0 1 2" Q38_CTX=16384 $U
