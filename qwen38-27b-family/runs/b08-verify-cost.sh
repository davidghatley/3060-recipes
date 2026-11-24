# Batch 8: why MTP does not pay here. Cost of a forward pass over 1..4 tokens (what a spec verify step costs),
# with 4 and 10 FFN layers in RAM. llama-bench pp1..pp4 x10, plus tg16 x4 for reference.
set -u
cd "$(dirname "$0")/.."
B=/mnt/scratch/llama.cpp/master-225a5345b/bin; export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
M=$(readlink -f /mnt/models/llm/qwen38-27b-family/pi-adapted/Qwen3.8-27B-pi-IQ3_XXS.gguf)
o=runs/b08-bench.jsonl; : > $o
ot() { local n=$1 s=""; for ((i=0;i<n;i++)); do s+="${s:+|}$i"; done; echo "blk\\.($s)\\.ffn_(up|gate|down)=CPU"; }
run() { local name=$1; shift; echo "== $name: $*"
  $B/llama-bench -m "$M" -fa on -t 6 -ctk q4_0 -ctv q4_0 -ngl 99 "$@" -o jsonl 2> runs/b08-$name.err | sed "s/^{/{\"name\":\"$name\",/" | tee -a $o | python3 -I -c '
import sys,json
for l in sys.stdin:
  d=json.loads(l); n=d["n_prompt"] or d["n_gen"]; print(d["name"], ("pp%d" if d["n_prompt"] else "tg%d")%n, round(d["avg_ts"],2), "tok/s", round(1000*n/d["avg_ts"],1), "ms/pass" if d["n_prompt"] else "ms/16")'
  tail -1 runs/b08-$name.err; }
for n in 4 10; do
  run ffn$n -ot "$(ot $n)" -r 10 -p 1,2,3,4 -n 0
  run ffn$n-tg -ot "$(ot $n)" -r 4 -p 0 -n 16
done
