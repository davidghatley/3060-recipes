"""One line per llama-bench result, for mainline or ik_llama.cpp jsonl.  python3 -I ik/summarize.py ik/runs/bench-*.jsonl"""
import json, sys

for path in sys.argv[1:]:
    name = path.rsplit("bench-", 1)[-1].removesuffix(".jsonl")
    text = open(path).read().strip()
    rows = json.loads(text) if text.startswith("[") else [json.loads(l) for l in text.splitlines() if l.startswith("{")]
    for d in rows:
        npp, ntg = d.get("n_prompt", 0), d.get("n_gen", 0)
        depth = d.get("n_depth", 0)
        if npp and ntg:   # ik -gp pp,tg: only the tg part is timed
            kind, depth = f"tg{ntg}", npp
        else:
            kind = f"pp{npp}" if npp else f"tg{ntg}"
        extra = " ".join(f"{k}={d[k]}" for k in ("n_cpu_moe", "fused_moe", "repack", "use_mmap", "load_mode",
                                                  "muge", "ger", "attn_max_batch") if k in d)
        print(f"{name:<22} {kind:>7} d={depth:<6} ub={d['n_ubatch']:<5} kv={d['type_k']}/{d['type_v']} "
              f"{extra}  {d['avg_ts']:8.1f} ± {d['stddev_ts']:5.1f} t/s")
