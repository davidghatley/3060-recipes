"""Markdown table per server label from runs/exp5-ledger.jsonl, runs/server-ledger.jsonl and runs/server-<label>.log.
    python3 -I tools/exp5table.py [label-prefix ...]"""
import json, os, re, sys, hashlib, statistics
R = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runs")
rows = {}
def get(l): return rows.setdefault(l, {"vram": 0, "warm": [], "greedy": []})
for f in ("exp5-ledger.jsonl", "server-ledger.jsonl"):
    p = os.path.join(R, f)
    if not os.path.exists(p): continue
    for line in open(p):
        d = json.loads(line); r = get(d["label"]); r["vram"] = max(r["vram"], d.get("vram_mib", 0)); c = d["case"]
        if c == "warmup": r["warm"].append(d)
        elif c == "greedy": r["greedy"].append(d["text"])
        elif c == "depth32k": r["d32"] = d["decode_tps"]; r["pf32"] = d["prefill_tps"]
        elif c == "cold11k-med": r["pp11"] = d["prefill_tps"]
        elif c == "cold11k": r.setdefault("ttft", []).append(d["ttft_s"])
        elif c == "prose-med": r["prose"] = d["decode_tps"]
        elif c.startswith("needle"): r.setdefault("needles", []).append(f"{c}:{d['found']} {d['decode_tps']}")
pref = sys.argv[1:]
base_greedy = None
print("| label | VRAM MiB | warm-up req1→4 t/s (first→last 128-tok window of req 1) | prose t/s | cold 11k t/s (TTFT) | tg @32k | hit rate | greedy |")
print("|---|---:|---|---:|---:|---:|---:|---|")
for l, r in rows.items():
    if pref and not any(l.startswith(p) for p in pref): continue
    w = r["warm"]; ws = " / ".join(f"{x['server_tps']:.1f}" for x in w)
    win = f" ({w[0]['windows'][0]}→{w[0]['windows'][-1]})" if w and w[0]["windows"] else ""
    hit = ""
    lp = os.path.join(R, f"server-{l}.log")
    if os.path.exists(lp):
        m = re.findall(r"ubatch <= 8: hits = (\d+), misses = (\d+)(?: \((\d+) on the CPU\))?, hit rate = ([0-9.]+)%", open(lp, errors="replace").read())
        if m: hit = m[-1][3] + "%"
    g = hashlib.md5("\x00".join(r["greedy"]).encode()).hexdigest()[:8] if r["greedy"] else ""
    ttft = f" ({statistics.median(r['ttft']):.2f} s)" if r.get("ttft") else ""
    print(f"| {l} | {r['vram']} | {ws}{win} | {r.get('prose','')} | {r.get('pp11','')}{ttft} | {r.get('d32','')} | {hit} | {g} |")
    for n in r.get("needles", []): print(f"|   needles | | {n} | | | | | |")
