# Batch 7: no speculation. Context size and K/V type vs FFN layers in RAM, and ub 256. Each config loads the fewest FFN
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
try b07-c32-q4 "4" Q38_CTX=32768 Q38_KV=q4_0
try b07-c32-q4-ub256 "2 3" Q38_CTX=32768 Q38_KV=q4_0 Q38_UBATCH=256
try b07-c16-q8 "3 4 5 6 7" Q38_CTX=16384 Q38_KV=q8_0
try b07-c32-k8v4 "6 7 8 9 10" Q38_CTX=32768 Q38_KV=q8_0 Q38_KV_V=q4_0
try b07-c64-q4 "9 10 11 12 13" Q38_CTX=65536 Q38_KV=q4_0
try b07-c128-q4 "19 20 21 22 23 24" Q38_CTX=131072 Q38_KV=q4_0
try b07-c32-q4b "4" Q38_CTX=32768 Q38_KV=q4_0
