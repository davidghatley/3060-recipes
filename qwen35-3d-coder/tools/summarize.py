"""Summarize llama-bench jsonl files: one row per test, mean +- sd tok/s and ms/token.
    python3 -I tools/summarize.py runs/bench-<name>/*.jsonl"""
import json, sys
from pathlib import Path

print(f"{'label':28s} {'model':38s} {'test':>14s} {'ub':>5s} {'kv':>5s} {'fa':>2s} {'tok/s':>9s} {'sd':>6s} {'ms/tok':>7s}")
for p in sys.argv[1:]:
    for line in open(p):
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        test = f"pp{r['n_prompt']}" if r["n_gen"] == 0 else f"tg{r['n_gen']}"
        if r.get("n_depth"):
            test += f"@d{r['n_depth']}"
        ts = r["avg_ts"]
        print(f"{Path(p).stem:28s} {Path(r['model_filename']).name[:38]:38s} {test:>14s} {r['n_ubatch']:>5d} "
              f"{r['type_k']:>5s} {int(bool(r.get('flash_attn'))):>2d} {ts:9.2f} {r['stddev_ts']:6.2f} {1000 / ts:7.3f}")
