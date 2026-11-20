"""Turn the dataset's reference answers for a subset into an eval run dir (to validate the harness).
    python3 -I tools/ref_run.py runs/data/subset-40.jsonl runs/eval-reference"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
import re
FENCE = re.compile(r"```(?:html|HTML)?\s*\n(.*?)```", re.S)
for l in open(sys.argv[1]):
    x = json.loads(l)
    blocks = [b for b in FENCE.findall(x["ref_content"]) if "<html" in b.lower() or "<script" in b.lower()]
    html = max(blocks, key=len) if blocks else None
    if html: (out / f"{x['id']}.html").write_text(html)
    (out / f"{x['id']}.json").write_text(json.dumps({"id": x["id"], "level": x["level"], "title": x["title"],
        "finish_reason": "stop", "html_found": html is not None, "timings": None}))
