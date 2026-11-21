"""Print one line per llama-bench result.  python3 -I tools/summarize.py runs/bench-*.jsonl"""
import json
import sys

for path in sys.argv[1:]:
    name = path.rsplit("bench-", 1)[-1].removesuffix(".jsonl")
    for line in open(path):
        d = json.loads(line)
        kind = f"pp{d['n_prompt']}" if d["n_prompt"] else f"tg{d['n_gen']}"
        ot = (d.get("tensor_buft_overrides") or "")[:28]
        print(f"{name:<22} {kind:>7} d={d.get('n_depth', 0):<6} ub={d['n_ubatch']:<5} ot={ot:<28} "
              f"kv={d['type_k']}/{d['type_v']:<5} t={d['n_threads']}  {d['avg_ts']:8.2f} ± {d['stddev_ts']:5.2f} t/s")
