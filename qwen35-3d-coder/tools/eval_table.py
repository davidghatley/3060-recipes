"""Side-by-side render-eval table from runs/eval-*/score.json (run tools/score.py first).
    python3 -I tools/eval_table.py eval-q8-official eval-q5km-own eval-q4km-own"""
import json, sys
from pathlib import Path

RUNS = Path(__file__).resolve().parent.parent / "runs"
cols = sys.argv[1:]
data = {c: json.load(open(RUNS / c / "score.json")) for c in cols}
print("| | " + " | ".join(cols) + " |")
print("|---|" + "---:|" * len(cols))
for key, label in (("n", "prompts"), ("pass", "**pass** (no error, WebGL, drawn)"), ("finished", "finished within 32k tokens"),
                   ("throws", "page throws an error"), ("animated", "animated")):
    print(f"| {label} | " + " | ".join(str(data[c]["summary"][key]) for c in cols) + " |")
print("| throws / finished | " + " | ".join(
    f"{data[c]['summary']['throws'] / max(1, data[c]['summary']['finished']):.0%}" for c in cols) + " |")
print()
ids = [i["id"] for i in data[cols[0]]["items"]]
print("| id | level | " + " | ".join(cols) + " |")
print("|---|---:|" + "---|" * len(cols))
for k, i in enumerate(ids):
    cells = []
    for c in cols:
        it = next((x for x in data[c]["items"] if x["id"] == i), None)
        if it is None:
            cells.append("-")
        elif it["pass"]:
            cells.append("pass")
        elif not it["finished"]:
            cells.append("cap")
        else:
            cells.append("throw: " + (it.get("first_error") or "")[:40].replace("|", "/") if it["throws"] else "blank")
    print(f"| {i} | {data[cols[0]]['items'][k]['level']} | " + " | ".join(cells) + " |")
