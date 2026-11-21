#!/usr/bin/env python3
"""Compare two check_readout outputs item by item (same rows): max |p_A - p_B| and top-1 agreement.

usage: python -I eval/tools/compare_readouts.py A.json B.json
"""
import json
import sys

a, b = (json.load(open(p)) for p in sys.argv[1:3])
bi = {x["run_id"]: x for x in b["items"]}
pairs = [(x, bi[x["run_id"]]) for x in a["items"] if x["run_id"] in bi]
d = [max(abs(p - q) for p, q in zip(x["p_cold"], y["p_cold"])) for x, y in pairs]
top = [max(range(len(x["p_cold"])), key=x["p_cold"].__getitem__) == max(range(len(y["p_cold"])), key=y["p_cold"].__getitem__) for x, y in pairs]
print(json.dumps({"a": a.get("label"), "b": b.get("label"), "items": len(pairs), "maxabs": max(d) if d else None,
                  "mean_maxabs": sum(d) / len(d) if d else None, "top1_agree": sum(top) / len(top) if top else None,
                  "nan_b": sum(y.get("any_nan", False) for _, y in pairs)}))
