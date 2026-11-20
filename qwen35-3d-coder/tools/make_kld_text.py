"""Write the KL-divergence corpus: reference answers (reasoning, then HTML) for validation prompts NOT in
the 40-prompt render subset, so the two quality checks don't share text.
    python3 -I tools/make_kld_text.py runs/data/validation-00000.parquet runs/data/subset-40.jsonl > runs/data/kld.txt
(needs pyarrow: run with the converter venv)"""
import json, sys
import pyarrow.parquet as pq
used = {json.loads(l)["id"] for l in open(sys.argv[2])}
rows = sorted((r for r in pq.read_table(sys.argv[1]).to_pylist() if r["id"] not in used), key=lambda r: r["id"])
for r in rows[:12]:
    a = r["messages"][-1]
    sys.stdout.write(f"{r['messages'][-2]['content']}\n\n{a['reasoning_content']}\n\n{a['content']}\n\n")
