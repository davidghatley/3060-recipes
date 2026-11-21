"""Small capped coding eval for a running Inkling-2-Mini llama-server (stdlib only).
    python3 -I tools/codeeval.py --label NAME [--url http://127.0.0.1:8085] [--max 2048] [--effort low]
8 Python tasks. Each answer's last ```python block is run against fixed asserts in a subprocess (python -I, 10 s timeout,
fresh temp dir). Temperature 0, so two quants can be compared answer by answer. Writes runs/codeeval-<label>.json.
"""
import argparse, json, os, re, subprocess, sys, tempfile, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TASKS = [
    ("merge_intervals", "Write a Python function merge_intervals(intervals) that merges overlapping closed intervals given as [start, end] lists and returns them sorted by start.",
     "assert merge_intervals([[1,3],[2,6],[8,10],[15,18]]) == [[1,6],[8,10],[15,18]]\nassert merge_intervals([[1,4],[4,5]]) == [[1,5]]\nassert merge_intervals([]) == []"),
    ("roman", "Write a Python function to_roman(n) that converts an integer 1..3999 to a Roman numeral string.",
     "assert to_roman(1994) == 'MCMXCIV'\nassert to_roman(3999) == 'MMMCMXCIX'\nassert to_roman(4) == 'IV'"),
    ("lru", "Write a Python class LRUCache(capacity) with get(key) returning -1 when missing and put(key, value), both O(1).",
     "c = LRUCache(2); c.put(1, 1); c.put(2, 2)\nassert c.get(1) == 1\nc.put(3, 3)\nassert c.get(2) == -1\nc.put(4, 4)\nassert c.get(1) == -1 and c.get(3) == 3 and c.get(4) == 4"),
    ("topo", "Write a Python function topo_sort(graph) that takes a dict mapping node -> list of nodes it must come before, and returns a list in a valid topological order, raising ValueError on a cycle.",
     "g = {'a': ['b', 'c'], 'b': ['d'], 'c': ['d'], 'd': []}\no = topo_sort(g)\nassert set(o) == set(g) and all(o.index(u) < o.index(v) for u in g for v in g[u])\ntry:\n    topo_sort({'x': ['y'], 'y': ['x']}); raise SystemExit(1)\nexcept ValueError:\n    pass"),
    ("rle", "Write Python functions rle_encode(s) and rle_decode(s) for run-length encoding where 'aaabcc' encodes to '3a1b2c'. Runs can be longer than 9.",
     "assert rle_encode('aaabcc') == '3a1b2c'\nassert rle_decode('3a1b2c') == 'aaabcc'\nassert rle_decode(rle_encode('x' * 12 + 'y')) == 'x' * 12 + 'y'\nassert rle_encode('') == ''"),
    ("parse_duration", "Write a Python function parse_duration(s) that parses strings like '1h30m', '45s', '2h5s' or '3m' into a total number of seconds (int). Raise ValueError on anything else.",
     "assert parse_duration('1h30m') == 5400\nassert parse_duration('45s') == 45\nassert parse_duration('2h5s') == 7205\ntry:\n    parse_duration('abc'); raise SystemExit(1)\nexcept ValueError:\n    pass"),
    ("bisect", "Write a Python function first_ge(a, x) that returns the index of the first element >= x in the sorted list a (len(a) if none), in O(log n), without using the bisect module.",
     "import random\nfor _ in range(200):\n    a = sorted(random.randint(0, 20) for _ in range(random.randint(0, 15))); x = random.randint(-1, 21)\n    assert first_ge(a, x) == next((i for i, v in enumerate(a) if v >= x), len(a))"),
    ("matrix_spiral", "Write a Python function spiral(m) that returns the elements of a rectangular matrix (list of lists) in clockwise spiral order.",
     "assert spiral([[1,2,3],[4,5,6],[7,8,9]]) == [1,2,3,6,9,8,7,4,5]\nassert spiral([[1,2,3,4],[5,6,7,8],[9,10,11,12]]) == [1,2,3,4,8,12,11,10,9,5,6,7]\nassert spiral([]) == []\nassert spiral([[1],[2]]) == [1,2]"),
]

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://127.0.0.1:" + os.environ.get("INK_PORT", "8085"))
ap.add_argument("--label", required=True)
ap.add_argument("--max", type=int, default=2048)
ap.add_argument("--effort", default="low")
a = ap.parse_args()

res = []
for name, prompt, tests in TASKS:
    body = {"messages": [{"role": "user", "content": prompt + " Output only one Python code block."}], "max_tokens": a.max,
            "temperature": 0, "chat_template_kwargs": {"reasoning_effort": a.effort}}
    t0 = time.time()
    req = urllib.request.Request(a.url + "/v1/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        d = json.loads(r.read())
    c = d["choices"][0]
    text = c["message"].get("content") or ""
    blocks = re.findall(r"```(?:python|py)?\n(.*?)```", text, re.S)
    ok, err = False, "no code block"
    if blocks:
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "t.py")
            open(p, "w").write(blocks[-1] + "\n\n" + tests + "\n")
            try:
                pr = subprocess.run([sys.executable, "-I", p], cwd=td, capture_output=True, text=True, timeout=10)
                ok, err = pr.returncode == 0, pr.stderr.strip().splitlines()[-1:] if pr.returncode else ""
            except subprocess.TimeoutExpired:
                err = "timeout"
    res.append({"task": name, "pass": ok, "err": err, "finish": c.get("finish_reason"), "gen_n": d.get("timings", {}).get("predicted_n"),
                "decode_tps": round(d.get("timings", {}).get("predicted_per_second", 0), 2), "wall_s": round(time.time() - t0, 1)})
    print(a.label, name, "PASS" if ok else "FAIL", c.get("finish_reason"), res[-1]["gen_n"], err or "", flush=True)
out = {"label": a.label, "passed": sum(r["pass"] for r in res), "n": len(res), "results": res}
json.dump(out, open(os.path.join(ROOT, "runs", f"codeeval-{a.label}.json"), "w"), indent=1)
print(a.label, f"passed {out['passed']}/{out['n']}")
