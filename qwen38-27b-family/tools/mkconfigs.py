"""Write configs/<label>.json for every run that has a runs/cmd-<label>.txt (the exact llama-server command serve.sh
built for it, from Q38_DRY=1) plus its ledger medians. python3 -I tools/mkconfigs.py"""
import glob, json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
led = {}
for line in open(os.path.join(R, "runs", "ledger.jsonl")):
    try: d = json.loads(line)
    except ValueError: continue
    if d.get("case", "").endswith("-med") or d.get("case", "").startswith("needle"):
        k = {kk: v for kk, v in d.items() if kk not in ("label", "run", "t")}
        led.setdefault(d["label"], []).append(k)
os.makedirs(os.path.join(R, "configs"), exist_ok=True)
n = 0
for f in sorted(glob.glob(os.path.join(R, "runs", "cmd-*.txt"))):
    label = os.path.basename(f)[4:-4]
    cmd = open(f).read().strip()
    out = {"id": label, "build": "llama.cpp master-225a5345b", "command": cmd, "results": led.get(label, []),
           "server_log": f"runs/server-{label}.log"}
    json.dump(out, open(os.path.join(R, "configs", label + ".json"), "w"), indent=1); n += 1
print(n, "configs")
