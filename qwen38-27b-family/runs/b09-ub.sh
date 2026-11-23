# Batch 9: ub 256 won at 32k (b07). Check ub 128, and what ub 256 buys at 64k and 128k (the FA compute buffer grows with the window: 827 MiB at 128k, ub 512).
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
try b09-c32-ub256 "3" Q38_CTX=32768 Q38_KV=q4_0 Q38_UBATCH=256
try b09-c32-ub128 "1 2" Q38_CTX=32768 Q38_KV=q4_0 Q38_UBATCH=128
try b09-c64-ub256 "8 9 10 11" Q38_CTX=65536 Q38_KV=q4_0 Q38_UBATCH=256
try b09-c128-ub256 "21 22 23 24 25 26 27 28" Q38_CTX=131072 Q38_KV=q4_0 Q38_UBATCH=256
try b09-c32-ub256b "3" Q38_CTX=32768 Q38_KV=q4_0 Q38_UBATCH=256
