"""Greedy-identity check: compare temperature-0 outputs with and without speculation (session "greedy"), and use the
logprob probe (session "greedy-probe", no speculation) to show how close the top two tokens were where they diverge.
    python3 -I tools/greedy_check.py"""
import json
from collections import defaultdict
from pathlib import Path

rows = [json.loads(l) for l in open(Path(__file__).resolve().parent.parent / "runs/ledger.jsonl")]
runs = defaultdict(dict)
for r in rows:
    if r["session"] == "greedy":
        runs[(r["phase"], r["id"])][f"{r['config']}@{r['step']}"] = r["text"]
probe = {(r["phase"], r["id"]): r for r in rows if r["session"] == "greedy-probe"}

for key, v in runs.items():
    ref = v["none@0"]
    for name, t in v.items():
        if name == "none@0":
            continue
        if t == ref:
            print(f"{key[0]} {key[1]} {name:10s} identical ({len(ref)} chars)")
            continue
        c = next((i for i, (x, y) in enumerate(zip(ref, t)) if x != y), min(len(ref), len(t)))
        line = f"{key[0]} {key[1]} {name:10s} diverges at char {c}/{len(ref)}"
        p = probe.get(key)
        if p and p.get("probs"):
            pos = 0
            for k, (tok, l1, l2) in enumerate(p["probs"]):
                if pos + len(tok or "") > c:
                    margin = (l1 - l2) if (l1 is not None and l2 is not None) else None
                    line += f"; token {k} {tok!r}: top1-top2 logprob gap {margin:.3f}" if margin is not None else ""
                    break
                pos += len(tok or "")
            same = p["text"] == ref
            line += "" if same else " (probe text differs from none@0)"
        print(line)
