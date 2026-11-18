"""Print one line per llama-bench result.  python3 -I tools/summarize.py runs/bench-*.jsonl"""
import json
import sys

for path in sys.argv[1:]:
    name = path.rsplit("bench-", 1)[-1].removesuffix(".jsonl")
    for line in open(path):
        d = json.loads(line)
        kind = f"pp{d['n_prompt']}" if d["n_prompt"] else f"tg{d['n_gen']}"
        print(f"{name:<20} {kind:>7} d={d['n_depth']:<6} ub={d['n_ubatch']:<5} "
              f"ncmoe={d['n_cpu_moe']:<3} kv={d['type_k']}/{d['type_v']:<5} lm={d['load_mode']:<5} "
              f"t={d['n_threads']} poll={d['poll']}  {d['avg_ts']:8.1f} ± {d['stddev_ts']:5.1f} t/s")
