# Batch 2: llama-bench placement sweep on pi IQ3_XXS: what each GB in RAM costs, by tensor kind. tg64 x4, pp512 x2.
set -u
cd "$(dirname "$0")/.."
B=/mnt/scratch/llama.cpp/master-225a5345b/bin; export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
M=$(readlink -f /mnt/models/llm/qwen38-27b-family/pi-adapted/Qwen3.8-27B-pi-IQ3_XXS.gguf)
o=runs/b02-bench.jsonl; : > $o
run() { local name=$1; shift; echo "== $name: $*"; nvidia-smi --query-gpu=memory.used --format=csv,noheader
  $B/llama-bench -m "$M" -fa on -t 6 -r 4 -p 512 -n 64 -o jsonl "$@" 2> runs/b02-$name.err | sed "s/^{/{\"name\":\"$name\",/" | tee -a $o | python3 -I -c '
import sys,json
for l in sys.stdin:
  d=json.loads(l); print(d["name"], "pp" if d["n_prompt"] else "tg", round(d["avg_ts"],2), round(d["stddev_ts"],2))'
  tail -2 runs/b02-$name.err; }
run gpu-all      -ngl 99
run ffn4-cpu     -ngl 99 -ot 'blk\.([0-3])\.ffn_(up|gate|down)=CPU'
run ffn8-cpu     -ngl 99 -ot 'blk\.([0-7])\.ffn_(up|gate|down)=CPU'
run ngl57        -ngl 57
run down8-cpu    -ngl 99 -ot 'blk\.([0-7])\.ffn_down=CPU'
run up8-cpu      -ngl 99 -ot 'blk\.([0-7])\.ffn_up=CPU'
run output-cpu   -ngl 99 -ot 'output\.weight=CPU'
run ffn8-cpu-t12 -ngl 99 -ot 'blk\.([0-7])\.ffn_(up|gate|down)=CPU' -t 12
run gpu-all-2    -ngl 99
