"""Flag degenerate repetition in generated answers: zlib ratio of the last 20k characters (loops compress far better
than real reasoning or code) and the most repeated line in that tail.
    python3 -I tools/loop_check.py runs/eval-q5km-own [runs/qualify-scene-*.txt ...]"""
import json, sys, zlib
from collections import Counter
from pathlib import Path


def check(name, text, finish):
    tail = text[-20000:]
    ratio = len(zlib.compress(tail.encode(), 9)) / max(1, len(tail.encode()))
    lines = [l.strip() for l in tail.splitlines() if len(l.strip()) > 20]
    top, n = Counter(lines).most_common(1)[0] if lines else ("", 0)
    flag = "LOOP" if ratio < 0.12 else ""
    print(f"{name:28s} {finish:7s} zlib {ratio:.3f}  top line x{n:<4d} {flag} {top[:60]!r}")


for arg in sys.argv[1:]:
    p = Path(arg)
    if p.is_dir():
        for f in sorted(p.glob("scene-*.json")):
            d = json.load(open(f))
            check(f"{p.name}/{d['id']}", (d.get("reasoning") or "") + (d.get("content") or ""), d.get("finish_reason") or "?")
    else:
        check(p.name, p.read_text(), "-")
