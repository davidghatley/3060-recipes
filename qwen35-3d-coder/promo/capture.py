"""Timed SSE capture of one prompt on a running llama-server, for the promo time-lapse.
Every chunk is stored with t = time.perf_counter() seconds since the request was sent, its reasoning and content
deltas kept separate, and the token count llama-server reports per chunk (one token per chunk without speculation).
    python3 -I promo/capture.py --url http://127.0.0.1:8084 --config baseline --slugs lighthouse,windmill
Writes promo/captures/<slug>/<config>.json and .html. Standard library only."""
import argparse, json, re, time, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True)
ap.add_argument("--config", required=True)
ap.add_argument("--slugs", default="")
ap.add_argument("--max-tokens", type=int, default=32000)
ap.add_argument("--seed", type=int, default=1)
ap.add_argument("--name", default="", help="output basename (default: the config)")
a = ap.parse_args()

SYSTEM = json.loads(open(ROOT / "runs/data/subset-40.jsonl").readline())["system"]  # the dataset's system prompt
prompts = json.load(open(HERE / "prompts.json"))
if a.slugs:
    prompts = [p for p in prompts if p["slug"] in a.slugs.split(",")]

FENCE = re.compile(r"```(?:html|HTML)?\s*\n(.*?)```", re.S)
DOC = re.compile(r"(<!DOCTYPE html.*?</html>|<html.*?</html>)", re.S | re.I)


def extract(text):  # same rule as tools/gen.py
    blocks = [b for b in FENCE.findall(text or "") if "<" in b and ("<html" in b.lower() or "<script" in b.lower())]
    if blocks:
        return max(blocks, key=len)
    m = DOC.findall(text or "")
    return max(m, key=len) if m else None


for p in prompts:
    body = {"messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": p["user"]}],
            "max_tokens": a.max_tokens, "temperature": 0.6, "top_p": 0.95, "top_k": 20, "repeat_penalty": 1.0,
            "seed": a.seed, "cache_prompt": False, "stream": True, "stream_options": {"include_usage": True},
            "timings_per_token": True}
    req = urllib.request.Request(f"{a.url}/v1/chat/completions", json.dumps(body).encode(),
                                 {"Content-Type": "application/json"})
    chunks, reasoning, content, final = [], [], [], {}
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=7200) as r:
        for raw in r:
            t = time.perf_counter() - t0
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            ev = json.loads(data)
            ch = (ev.get("choices") or [{}])[0] if ev.get("choices") else {}
            d = ch.get("delta") or {}
            rd, cd = d.get("reasoning_content"), d.get("content")
            tim = ev.get("timings") or {}
            if rd or cd:
                chunks.append({"t": round(t, 4), "reasoning_delta": rd, "content_delta": cd,
                               "n_tokens": tim.get("predicted_n")})
                reasoning.append(rd or ""); content.append(cd or "")
            if ch.get("finish_reason"):
                final["finish_reason"] = ch["finish_reason"]
            if ev.get("usage"):
                final["usage"] = ev["usage"]
            if tim:
                final["timings"] = tim
    total = time.perf_counter() - t0
    text = "".join(content)
    html = extract(text)
    first_c = next((c["t"] for c in chunks if c["content_delta"]), None)
    first_r = next((c["t"] for c in chunks if c["reasoning_delta"]), None)
    rec = {"slug": p["slug"], "title": p["title"], "config": a.config, "url": a.url, "system": SYSTEM,
           "user": p["user"], "sampling": {k: body[k] for k in ("temperature", "top_p", "top_k", "seed", "max_tokens")},
           "total_s": round(total, 3), "first_reasoning_t": first_r, "first_content_t": first_c,
           "reasoning_s": round((first_c or total) - (first_r or 0), 3) if first_r is not None else 0,
           "content_s": round(total - first_c, 3) if first_c is not None else 0,
           **final, "html_found": html is not None, "reasoning": "".join(reasoning), "content": text, "chunks": chunks}
    out = HERE / "captures" / p["slug"]
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{a.name or a.config}.json").write_text(json.dumps(rec))
    if html:
        (out / f"{a.name or a.config}.html").write_text(html)
    tm = final.get("timings") or {}
    print(f"{a.name or a.config} {p['slug']} finish={final.get('finish_reason')} html={html is not None} "
          f"n={tm.get('predicted_n')} {tm.get('predicted_per_second', 0):.1f} tok/s total={total:.0f}s", flush=True)
