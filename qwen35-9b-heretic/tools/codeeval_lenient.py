"""../scripts/codeeval.py's 8 tasks and tests, scored two ways: strict (its own rule: the last ```python fenced block)
and lenient (if there is no fenced block, the whole answer when it parses as Python). the model often answers
"Output only one Python code block." with bare code and no fence, which the strict rule counts as a failure.
    python3 -I tools/codeeval_lenient.py --label NAME [--think on|off] [--max 4096]
Writes runs/codeeval-lenient-<label>.json with the raw answers."""
import argparse, ast, json, os, re, subprocess, sys, tempfile, time, urllib.request
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(R, "..", "scripts", "codeeval.py")).read()
TASKS = next(ast.literal_eval(n.value) for n in ast.parse(src).body
             if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "TASKS")
ap = argparse.ArgumentParser(); ap.add_argument("--label", required=True); ap.add_argument("--think", default="on")
ap.add_argument("--max", type=int, default=4096); a = ap.parse_args()
url = "http://127.0.0.1:" + os.environ.get("PORT", "8106")


def run(code, tests):
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "t.py"); open(p, "w").write(code + "\n\n" + tests + "\n")
        try:
            pr = subprocess.run([sys.executable, "-I", p], cwd=td, capture_output=True, text=True, timeout=10)
            return pr.returncode == 0, (pr.stderr.strip().splitlines() or [""])[-1]
        except subprocess.TimeoutExpired:
            return False, "timeout"


res = []
for name, prompt, tests in TASKS:
    body = {"messages": [{"role": "user", "content": prompt + " Output only one Python code block."}], "max_tokens": a.max,
            "temperature": 0, "chat_template_kwargs": {"reasoning_effort": "low", "enable_thinking": a.think == "on"}}
    t0 = time.time()
    d = json.load(urllib.request.urlopen(urllib.request.Request(url + "/v1/chat/completions", json.dumps(body).encode(),
                                                                {"Content-Type": "application/json"}), timeout=1800))
    c = d["choices"][0]; text = c["message"].get("content") or ""
    blocks = re.findall(r"```(?:python|py)?\n(.*?)```", text, re.S)
    strict = run(blocks[-1], tests) if blocks else (False, "no code block")
    if blocks:
        lenient = strict
    else:
        try:
            ast.parse(text); lenient = run(text, tests)
        except SyntaxError:
            lenient = (False, "no code block, not bare Python")
    res.append({"task": name, "strict": strict[0], "lenient": lenient[0], "err": lenient[1], "fenced": bool(blocks),
                "finish": c.get("finish_reason"), "gen_n": d["timings"]["predicted_n"],
                "decode_tps": round(d["timings"]["predicted_per_second"], 2), "wall_s": round(time.time() - t0, 1), "content": text})
    print(a.label, name, "strict", strict[0], "lenient", lenient[0], c.get("finish_reason"), res[-1]["gen_n"], lenient[1], flush=True)
out = {"label": a.label, "think": a.think, "strict": sum(r["strict"] for r in res), "lenient": sum(r["lenient"] for r in res),
       "n": len(res), "results": res}
json.dump(out, open(os.path.join(R, "runs", f"codeeval-lenient-{a.label}.json"), "w"), indent=1)
print(f"{a.label} think={a.think}: strict {out['strict']}/8, lenient {out['lenient']}/8")
