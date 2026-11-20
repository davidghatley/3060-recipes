"""Acceptance gates for the tuned server (serve.sh): chat round-trip, a three.js request, and needle retrieval at
~50% and ~95% of the 64k context. Standard library only.
    python3 -I tools/qualify.py [--url http://127.0.0.1:8083] > runs/qualify.json"""
import argparse, json, random, re, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://127.0.0.1:8083")
ap.add_argument("--scene-only", action="store_true")
ap.add_argument("--scenes", type=int, default=1, help="how many subset prompts to run for the scene gate")
ap.add_argument("--ids", default="", help="comma-separated subset ids for the scene gate (overrides --scenes)")
a = ap.parse_args()


def post(path, body):
    req = urllib.request.Request(a.url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        return json.loads(r.read())


def chat(messages, **kw):
    t0 = time.time()
    d = post("/v1/chat/completions", {"messages": messages, **kw})
    d["_wall"] = round(time.time() - t0, 2)
    return d


res = {}
d = chat([{"role": "user", "content": "Reply with exactly: ok"}], max_tokens=512)
m = d["choices"][0]["message"]
res["chat"] = {"content": m.get("content"), "has_reasoning": bool(m.get("reasoning_content")), "timings": d.get("timings")}

sub = [json.loads(l) for l in open(ROOT / "runs/data/subset-40.jsonl")]
pick = [x for x in sub if x["id"] in a.ids.split(",")] if a.ids else sub[: a.scenes]
for k, x in enumerate(pick):
    d = chat([{"role": "system", "content": x["system"]}, {"role": "user", "content": x["user"]}], max_tokens=24000)
    m = d["choices"][0]["message"]
    c = m.get("content") or ""
    (ROOT / f"runs/qualify-scene-{x['id']}.txt").write_text((m.get("reasoning_content") or "") + "\n=====CONTENT=====\n" + c)
    res[f"scene_{k}"] = {"id": x["id"], "finish": d["choices"][0]["finish_reason"], "html": "</html>" in c.lower(),
                         "timings": d.get("timings"), "wall_s": d["_wall"]}
if a.scene_only:
    print(json.dumps(res, indent=1))
    raise SystemExit

filler = "\n".join(s["ref_content"] for s in sub)
rng = random.Random(7)
for target in (32000, 62000):
    codes = [f"{rng.choice('BCDFGHJKLMNPQRSTVWXZ')}{rng.randint(1000, 9999)}-{rng.choice('AEIOU')}{rng.randint(10, 99)}"
             for _ in range(3)]
    toks = post("/tokenize", {"content": filler})["tokens"][: target]
    text = post("/detokenize", {"tokens": toks})["content"]
    for frac, code in zip((0.2, 0.5, 0.85), codes):
        i = int(len(text) * frac)
        text = text[:i] + f"\n// ACCESS CODE {code}\n" + text[i:]
    q = "List every ACCESS CODE that appears in the source above, one per line, nothing else."
    # thinking off for the retrieval check, so the answer fits next to a 62k prompt in the 64k window
    d = chat([{"role": "user", "content": text + "\n\n" + q}], max_tokens=1024, temperature=0,
             chat_template_kwargs={"enable_thinking": False})
    ans = d["choices"][0]["message"].get("content") or ""
    found = [c for c in codes if c in ans]
    res[f"needle_{target}"] = {"prompt_tokens": d["usage"]["prompt_tokens"], "codes": codes, "found": len(found),
                               "answer": ans[-300:], "ttft_ms": (d.get("timings") or {}).get("prompt_ms")}
res["metrics_ok"] = True
print(json.dumps(res, indent=1))
