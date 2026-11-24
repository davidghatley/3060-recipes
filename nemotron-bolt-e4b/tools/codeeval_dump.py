"""Save the raw chat answers (content and reasoning_content) for the first N tasks of ../scripts/codeeval.py, with the
same request body (temperature 0), thinking on and off, to see why its code-block regex finds nothing.
    python3 -I tools/codeeval_dump.py --label NAME [--n 3] [--max 4096]"""
import argparse, ast, json, os, urllib.request
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(R, "..", "scripts", "codeeval.py")).read()
TASKS = next(ast.literal_eval(n.value) for n in ast.parse(src).body
             if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "TASKS")
ap = argparse.ArgumentParser(); ap.add_argument("--label", required=True); ap.add_argument("--n", type=int, default=3)
ap.add_argument("--max", type=int, default=4096); a = ap.parse_args()
url = "http://127.0.0.1:" + os.environ.get("PORT", "8105"); rows = []
for think in (True, False):
    for name, prompt, _ in TASKS[:a.n]:
        body = {"messages": [{"role": "user", "content": prompt + " Output only one Python code block."}], "max_tokens": a.max,
                "temperature": 0, "chat_template_kwargs": {"reasoning_effort": "low", "enable_thinking": think}}
        d = json.load(urllib.request.urlopen(urllib.request.Request(url + "/v1/chat/completions", json.dumps(body).encode(),
                                                                    {"Content-Type": "application/json"}), timeout=1800))
        m = d["choices"][0]["message"]
        rows.append({"task": name, "think": think, "finish": d["choices"][0].get("finish_reason"), "n": d["timings"]["predicted_n"],
                     "content": m.get("content"), "reasoning": m.get("reasoning_content")})
        print(name, think, rows[-1]["finish"], rows[-1]["n"], repr((m.get("content") or "")[:160]), flush=True)
json.dump(rows, open(os.path.join(R, "runs", f"codeeval-raw-{a.label}.json"), "w"), indent=1)
