# Batch 6: b05 again with room for speculation. Spec multiplies the RS (DeltaNet) state by n+1 and MTP adds its own KV + compute buffers, so each candidate starts with more FFN layers in RAM.
# Speculation needs VRAM, so each candidate tries the fewest FFN layers in RAM that loads (falls back to more).
set -u
cd "$(dirname "$0")/.."
ot() { local n=$1 s=""; for ((i=0;i<n;i++)); do s+="${s:+|}$i"; done; echo "blk\\.($s)\\.ffn_(up|gate|down)=CPU"; }
T="python3 -I tools/srvtest.py --depths 0 --reps 6 --max 256"
try() { local l=$1; shift; local ns=$1; shift
  for n in $ns; do
    if READY_WAIT=300 tools/srv.sh "$l-ffn$n" Q38_CTX=32768 Q38_KV=q4_0 Q38_OT="$(ot $n)" Q38_EXTRA="-lv 4" "$@" -- $T --label "$l-ffn$n" 2>&1 | grep -E 'med|exited|ready after'; then
      grep -q 'code-0k-med' <(grep "\"$l-ffn$n\"" runs/ledger.jsonl) && { grep -E 'CUDA0 (model|KV|RS|compute) buffer' runs/server-$l-ffn$n.log | sed 's/^[0-9.]* [IWE] //'; return; }
    fi
  done; }
try b06-ctl "4"
try b06-mtp1 "7 8 9 10 11 12" Q38_SPEC=mtp Q38_DRAFT_N=1
try b06-mtp2 "11 12 13 14 15 16" Q38_SPEC=mtp Q38_DRAFT_N=2
try b06-ctl2 "4"
try b06-mtp3 "13 14 15 16 17 18 19" Q38_SPEC=mtp Q38_DRAFT_N=3
try b06-dflash3-cpu "9 10 11 12 13 14" Q38_SPEC=dflash2 Q38_DRAFT_NGL=0 Q38_DRAFT_N=3
try b06-dflash3-gpu "18 19 20 21 22 23 24" Q38_SPEC=dflash2 Q38_DRAFT_N=3
try b06-ctl3 "4"
