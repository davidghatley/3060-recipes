"""Run eval prompts against a llama-server and save outputs, timings and the extracted HTML page.

    python3 -I tools/gen.py --subset runs/data/subset-24.jsonl --out runs/eval-<name> [--parallel 4]
        [--url http://127.0.0.1:8082] [--max-tokens 32768] [--temp 0.6 --top-p 0.95 --top-k 20] [--seed 1]
        [--only id1,id2] [--first N]

Writes <out>/<id>.json (full response, timings, finish reason) and <out>/<id>.html (the extracted page, if any).
Skips ids whose .json already exists, so a run can be split or resumed. Standard library only.
"""
import argparse, json, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--subset", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--url", default="http://127.0.0.1:8082")
ap.add_argument("--parallel", type=int, default=1)
ap.add_argument("--max-tokens", type=int, default=32768)
ap.add_argument("--temp", type=float, default=0.6)
ap.add_argument("--top-p", type=float, default=0.95)
ap.add_argument("--top-k", type=int, default=20)
ap.add_argument("--seed", type=int, default=1)
ap.add_argument("--only", default="")
ap.add_argument("--first", type=int, default=0)
ap.add_argument("--deadline-min", type=float, default=0, help="stop starting new items after this many minutes")
a = ap.parse_args()

out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)
items = [json.loads(l) for l in open(a.subset)]
if a.only:
    keep = set(a.only.split(","))
    items = [x for x in items if x["id"] in keep]
if a.first:
    items = items[: a.first]
items = [x for x in items if not (out / f"{x['id']}.json").exists()]

FENCE = re.compile(r"```(?:html|HTML)?\s*\n(.*?)```", re.S)
DOC = re.compile(r"(<!DOCTYPE html.*?</html>|<html.*?</html>)", re.S | re.I)


def extract(text):
    blocks = [b for b in FENCE.findall(text or "") if "<" in b and ("<html" in b.lower() or "<script" in b.lower())]
    if blocks:
        return max(blocks, key=len)
    m = DOC.findall(text or "")
    return max(m, key=len) if m else None


T_START = time.time()


def run(x):
    if a.deadline_min and time.time() - T_START > a.deadline_min * 60:
        return None
    body = {
        "messages": [{"role": "system", "content": x["system"]}, {"role": "user", "content": x["user"]}],
        "max_tokens": a.max_tokens, "temperature": a.temp, "top_p": a.top_p, "top_k": a.top_k,
        "repeat_penalty": 1.0, "seed": a.seed, "stream": False,
    }
    req = urllib.request.Request(f"{a.url}/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=7200) as r:
            resp = json.load(r)
    except Exception as e:  # keep going; record the failure
        resp = {"error": str(e)}
    wall = time.time() - t0
    ch = (resp.get("choices") or [{}])[0]
    msg = ch.get("message") or {}
    html = extract(msg.get("content"))
    rec = {"id": x["id"], "level": x["level"], "title": x["title"], "wall_s": round(wall, 1),
           "finish_reason": ch.get("finish_reason"), "usage": resp.get("usage"), "timings": resp.get("timings"),
           "html_found": html is not None, "content": msg.get("content"),
           "reasoning": msg.get("reasoning_content"), "error": resp.get("error")}
    if html:
        (out / f"{x['id']}.html").write_text(html)
    (out / f"{x['id']}.json").write_text(json.dumps(rec, indent=1))
    t = resp.get("timings") or {}
    print(f"{x['id']} L{x['level']} finish={rec['finish_reason']} html={rec['html_found']} "
          f"n={t.get('predicted_n')} dec={t.get('predicted_per_second', 0):.1f} tok/s "
          f"draft={t.get('draft_n_accepted')}/{t.get('draft_n')} wall={wall:.0f}s", flush=True)
    return rec


with ThreadPoolExecutor(a.parallel) as ex:
    list(ex.map(run, items))
