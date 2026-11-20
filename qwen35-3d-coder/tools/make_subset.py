"""Pick a fixed, level-stratified subset of the 213 validation prompts.

    <venv>/bin/python -I tools/make_subset.py runs/data/validation-00000.parquet N > runs/data/subset-N.jsonl

Takes prompts in id order within each level, round-robin over levels 1..10, so N=20 gives two per level.
Also writes the reference answers (reasoning + content) for the KL-divergence text: see tools/make_kld_text.py.
"""
import json, sys
from collections import defaultdict

import pyarrow.parquet as pq

rows = pq.read_table(sys.argv[1]).to_pylist()
n = int(sys.argv[2])
by = defaultdict(list)
for r in sorted(rows, key=lambda r: r["id"]):
    if [m["role"] for m in r["messages"]] == ["system", "user", "assistant"]:
        by[r["level"]].append(r)
picked, i = [], 0
while len(picked) < n:
    for lvl in sorted(by):
        if i < len(by[lvl]) and len(picked) < n:
            picked.append(by[lvl][i])
    i += 1
for r in picked:
    sys_, user, ans = r["messages"]
    print(json.dumps({"id": r["id"], "title": r["title"], "level": r["level"], "voxel": r["voxel"],
                      "system": sys_["content"], "user": user["content"],
                      "ref_reasoning": ans["reasoning_content"], "ref_content": ans["content"]}))
