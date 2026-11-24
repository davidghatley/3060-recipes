# Batch 3: how many layers' FFN must sit in RAM for each window / KV type / ubatch (server load + one 3k-token request).
set -u
cd "$(dirname "$0")/.."
ot() { local n=$1 s=""; for ((i=0;i<n;i++)); do s+="${s:+|}$i"; done; echo "blk\\.($s)\\.ffn_(up|gate|down)=CPU"; }
probe() { local ctx=$1 kv=$2 ub=$3 n=$4 l="b03-c$1-$2-ub$3-ffn$4"
  READY_WAIT=300 tools/srv.sh "$l" Q38_CTX=$ctx Q38_KV=$kv Q38_UBATCH=$ub Q38_OT="$(ot $n)" Q38_EXTRA="-lv 4" -- python3 -I tools/fitprobe.py "$l" 2>&1 | grep -E 'FITPROBE|exited|not ready'
  grep -E 'CUDA0 (model|KV|RS|compute) buffer|CUDA_Host compute|out of memory|failed to' runs/server-$l.log | sed 's/^[0-9.]* [IWE] //' | head -8; }
probe 32768 q8_0 512 8
probe 32768 q8_0 512 6
probe 32768 q8_0 512 4
probe 32768 q4_0 512 4
probe 32768 q4_0 512 2
probe 32768 q8_0 256 4
probe 65536 q4_0 512 6
probe 131072 q4_0 512 10
probe 131072 q4_0 512 14
probe 262144 q4_0 512 24
probe 262144 q4_0 512 30
