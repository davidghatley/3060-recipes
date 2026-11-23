"""Greedy (temperature 0) answers to a fixed prompt set, saved for comparison across servers.
    python3 -I tools/greedy.py --label NAME --out runs/greedy [--max 400] [--n 6]
    python3 -I tools/greedy.py --compare A.json B.json
Thinking off. Saves <out>/greedy-<label>.json with text and timings."""
import argparse, json, os, sys, urllib.request
P = ["Write a Python function that returns the n-th Fibonacci number iteratively, with a docstring.",
     "A shell command printed 'Permission denied' when I ran ./build.sh. List the three most likely causes and the fix for each.",
     "Explain what a Gated DeltaNet layer is in four sentences.",
     "You are a coding agent. The test tests/test_parser.py::test_empty fails with IndexError on an empty string. Describe, step by step, the tool calls you would make to fix it.",
     "Write a bash one-liner that counts lines of Python code in a git repository, excluding tests.",
     "What is 17 * 23 + 144 / 12? Show the steps.",
     "Write a TypeScript type guard isStringArray(x: unknown): x is string[].",
     "Summarise the CAP theorem for a junior engineer in five bullet points."]
ap = argparse.ArgumentParser(); ap.add_argument("--label"); ap.add_argument("--out", default="runs/greedy")
ap.add_argument("--max", type=int, default=400); ap.add_argument("--n", type=int, default=len(P)); ap.add_argument("--compare", nargs=2)
a = ap.parse_args()
if a.compare:
    x, y = (json.load(open(f)) for f in a.compare); same = 0
    for p, q in zip(x["rows"], y["rows"]):
        t1, t2 = p["text"], q["text"]
        c = next((i for i, (u, v) in enumerate(zip(t1, t2)) if u != v), min(len(t1), len(t2)))
        same += t1 == t2
        print(f"prompt {p['i']}: {'identical' if t1 == t2 else f'diverges at char {c} of {len(t1)}/{len(t2)}'}  {t1[max(0,c-30):c+40]!r} | {t2[max(0,c-30):c+40]!r}")
    print(f"identical {same}/{len(x['rows'])}"); sys.exit()
url = "http://127.0.0.1:" + os.environ.get("PORT", "8101"); rows = []
for i, p in enumerate(P[:a.n]):
    body = {"messages": [{"role": "user", "content": p}], "max_tokens": a.max, "temperature": 0, "top_k": 1,
            "cache_prompt": False, "chat_template_kwargs": {"enable_thinking": False}}
    d = json.load(urllib.request.urlopen(urllib.request.Request(url + "/v1/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"}), timeout=1800))
    m = d["choices"][0]["message"]; t = d["timings"]
    rows.append({"i": i, "text": (m.get("reasoning_content") or "") + (m.get("content") or ""), "n": t["predicted_n"],
                 "decode_tps": round(t["predicted_per_second"], 2), "draft_n": t.get("draft_n"), "accepted": t.get("draft_n_accepted")})
    print(a.label, i, rows[-1]["n"], rows[-1]["decode_tps"], repr(rows[-1]["text"][:100]), flush=True)
os.makedirs(a.out, exist_ok=True); json.dump({"label": a.label, "rows": rows}, open(os.path.join(a.out, f"greedy-{a.label}.json"), "w"), indent=1)
