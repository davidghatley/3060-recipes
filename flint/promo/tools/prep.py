"""Measured numbers -> src/data.json for the promo. Run from flint/promo:  python3 -I tools/prep.py

Every number on screen comes from a file in ../runs/; each entry records the file it came from.
"""
import json, os, re, statistics

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNS = os.path.join(os.path.dirname(HERE), "runs")


def ledger(label, case, key):
    vals = [json.loads(l) for l in open(os.path.join(RUNS, "server-ledger.jsonl"))]
    vals = [d[key] for d in vals if d["label"] == label and d["case"] == case and key in d]
    return statistics.median(vals) if vals and not isinstance(vals[0], str) else vals


def bench(name, n_prompt=0, n_gen=0, depth=0, **match):
    for l in open(os.path.join(RUNS, f"bench-{name}.jsonl")):
        d = json.loads(l)
        if d["n_prompt"] == n_prompt and d["n_gen"] == n_gen and d["n_depth"] == depth and all(d[k] == v for k, v in match.items()):
            return round(d["avg_ts"], 1)
    raise KeyError((name, n_prompt, n_gen, depth, match))


def logline(name):
    for l in open(os.path.join(RUNS, name)):
        if "prompt eval time" in l:
            return l.split("|", 2)[2].strip()


def membw():
    return {int(m[0]): float(m[1]) for m in re.findall(r"threads=(\d+) read_GBps=([\d.]+)", open(os.path.join(RUNS, "membw.txt")).read())}


d = {
    "hw": {"gpu": "RTX 3060 12 GB", "cpu": "i5-12500", "ram": "62 GB DDR5", "pcie": "PCIe 4.0 x16",
           "ram_gbps": membw()[6], "vram_total_mib": 12288, "src": "runs/membw.txt, runs/pcie-under-load.txt"},
    "model": {"name": "Flint", "maker": "Recursive", "quant": "Q4_K_M", "file_gb": 23.4, "total_b": 39.8, "active_b": 2.5,
              "experts": 256, "top_k": 6, "layers": 49, "full_attn_layers": 14, "experts_gb": 21.3,
              "src": "GGUF header (flint/THEORY.md), huggingface.co/RecursiveSI/flint"},
    "engine": {"name": "llama.cpp", "build": "b12242", "commit": "3b4d6ab3f", "patched": False},
    "ttft": {
        "old_s": round(ledger("old-config", "cold11k", "ttft_s"), 1),
        "new_s": round(ledger("final", "cold11k", "ttft_s") or ledger("new-ncmoe43", "cold11k", "ttft_s"), 1),
        "old_tps": round(ledger("old-config", "cold11k", "prefill_tps")),
        "new_tps": round(ledger("final", "cold11k-med", "prefill_tps")),
        "old_line": logline("server-old-config.log"),
        "new_line": logline("server-final-20261117-231046.log"),
        "prompt_tokens": 10931,
        "src": "runs/server-ledger.jsonl (old-config, final), runs/server-*.log",
    },
    "prefill_steps": [
        {"label": "-ub 512 (old)", "tps": bench("ub-ctl1", 4096, n_ubatch=512)},
        {"label": "-ub 1024", "tps": bench("ub-sweep", 4096, n_ubatch=1024)},
        {"label": "-ub 2048", "tps": bench("ub-sweep", 4096, n_ubatch=2048)},
        {"label": "-ub 4096", "tps": bench("ub-sweep", 4096, n_ubatch=4096)},
        {"label": "--load-mode none", "tps": bench("lm-none", 4096, n_ubatch=4096)},
    ],
    "kv": {"q8_32k": bench("kv-q8-ctl1", 0, 128, 32768), "f16_32k": bench("kv-f16", 0, 128, 32768),
           "q8_0": bench("kv-q8-ctl1", 0, 128, 0), "f16_0": bench("kv-f16", 0, 128, 0), "src": "runs/bench-kv-*.jsonl"},
    "decode": {"old_prose": ledger("old-config", "prose-med", "decode_tps"), "new_prose": ledger("final", "prose-med", "decode_tps"),
               "old_code": ledger("old-config", "code-med", "decode_tps"), "new_code": ledger("final", "code-med", "decode_tps"),
               "spec_best": max(json.loads(l)["decode_tps"] for l in open(os.path.join(RUNS, "server-ledger.jsonl"))
                                if json.loads(l)["label"] == "spec-ngram-mapk" and json.loads(l)["case"] == "code")},
    "needles": {"k60": "3/3", "k120": "3/3", "prompt_120k": 120895, "prefill_120k": 1003.6, "vram_mib": 10835, "vram_old_mib": 5849,
                "src": "runs/server-ledger.jsonl (new-ncmoe43, final)"},
    "pcie": {"chunk_gb": 19.5, "trips_512": 22, "trips_4096": 3, "peak_gbps": 14.1, "src": "flint/THEORY.md, runs/bench-ub-big-dmon.txt"},
    "flags_old": ["-ngl 99 -ncmoe 47 --fit off", "-c 131072 -np 1 -t 6", "-fa on -ctk q8_0 -ctv q8_0", "--jinja --reasoning-format deepseek"],
    "flags_new": ["-ngl 99 -ncmoe 43 --fit off --spec-type ngram-map-k", "-c 131072 -np 1 -t 6", "-b 4096 -ub 4096 --load-mode none",
                  "-fa on -ctk f16 -ctv f16", "--jinja --reasoning-format deepseek"],
}
out = os.path.join(HERE, "src", "data.json")
json.dump(d, open(out, "w"), indent=1)
print(json.dumps({k: d[k] for k in ("ttft", "kv", "decode")}, indent=1))
