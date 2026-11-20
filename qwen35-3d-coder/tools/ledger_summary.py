"""Summarize runs/ledger.jsonl per session/config: median decode tok/s in the reasoning (R) and code (C) phases,
acceptance, and a task-weighted rate 1 / (fR/R + fC/C) using the reference answers' reasoning share fR.
    python3 -I tools/ledger_summary.py [session ...] [--fr 0.55]"""
import json, statistics as st, sys
from collections import defaultdict
from pathlib import Path

args = sys.argv[1:]
fr = 0.55
if "--fr" in args:
    i = args.index("--fr"); fr = float(args[i + 1]); del args[i:i + 2]
rows = [json.loads(l) for l in open(Path(__file__).resolve().parent.parent / "runs/ledger.jsonl")]
by = defaultdict(lambda: defaultdict(list))
for r in rows:
    if args and r["session"] not in args:
        continue
    by[(r["session"], r["config"])][r["phase"]].append(r)
print(f"{'session':12s} {'config':12s} {'n':>3s} {'R tok/s':>8s} {'C tok/s':>8s} {'acc R':>6s} {'acc C':>6s} {'task':>7s}  args")
for (s, c), ph in by.items():
    if "R" not in ph:
        continue
    R = st.median(x["tps"] for x in ph["R"]); C = st.median(x["tps"] for x in ph["C"])
    def acc(p):
        a = sum(x["draft_acc"] or 0 for x in ph[p]); n = sum(x["draft_n"] or 0 for x in ph[p])
        return f"{a / n:.2f}" if n else "-"
    task = 1 / (fr / R + (1 - fr) / C)
    print(f"{s:12s} {c:12s} {len(ph['R']):3d} {R:8.1f} {C:8.1f} {acc('R'):>6s} {acc('C'):>6s} {task:7.1f}  {ph['R'][0]['args'][-60:]}")
