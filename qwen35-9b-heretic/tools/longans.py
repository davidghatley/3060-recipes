"""Long-answer quality check (the qwen35-3d-coder MTP failure was reasoning loops in answers of 10k+ tokens, which
short speed runs and 512-token greedy checks missed). Same prompts, thinking on, server's card sampling, one sample
each, long cap; flags loops and garbage.
    python3 -I tools/longans.py --label NAME [--max 10000] [--n 5] [--url ...]
Per answer: finish reason, generated tokens, decode tok/s, draft acceptance, zlib ratio of the last 6000 chars of
reasoning and of content (< ~0.1 = looping), the longest run of one repeated line, and whether the answer has the
expected marker. Saves runs/longans/longans-<label>.json with the full texts (read them by hand)."""
import argparse, json, os, re, time, urllib.request, zlib

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = [
    ("threejs", "Write a complete single-file HTML page that uses three.js (from a CDN, ES module import) to render a "
     "small low-poly island: water plane with animated waves, a sand island, three palm trees built from primitives, "
     "a lighthouse whose light beam rotates, orbit controls, and a day/night toggle button. Output the whole file "
     "in one ```html code block.", "</html>"),
    ("python-cli", "Write a Python 3 command-line tool `ledger.py` that reads a CSV of transactions (date, payee, "
     "amount, category), supports subcommands `summary` (totals per category and month), `top` (largest N "
     "expenses) and `budget` (compare against a JSON budget file and flag overspends), with argparse, type hints, "
     "error handling for bad rows, and a unittest test class at the end. One ```python code block.", "unittest"),
    ("math", "A bag has 5 red, 4 blue and 3 green marbles. Marbles are drawn one at a time without replacement until "
     "two marbles of the same colour have been drawn in a row. What is the probability that the process ends with "
     "two reds? Give an exact fraction and check it a second way. End with 'ANSWER: <fraction>'.", "ANSWER:"),
    ("story", "Write a 1,500-word short story about a lighthouse keeper on a dying space station who receives a "
     "radio message from a ship that was lost forty years ago. Give it a title, three scenes, and an ending that "
     "changes the meaning of the first line.", None),
    ("explain", "Explain, for an engineer who knows C but not GPUs, how a transformer decoder generates one token "
     "on a GPU: memory traffic, kernels, the KV cache, why decode is bandwidth bound and prefill compute bound, and "
     "how speculative decoding with a multi-token-prediction head changes the arithmetic. Use headings and one "
     "worked numeric example.", None),
    ("refactor", "Here is a buggy JavaScript debounce: `function debounce(f,ms){let t;return function(){clearTimeout(t);"
     "t=setTimeout(f,ms)}}`. List every problem (this binding, arguments, return value, leading edge, cancel/flush), "
     "then write a corrected TypeScript version with leading/trailing options, cancel(), flush() and pending(), plus "
     "five Jest tests using fake timers. One ```ts code block for the code.", "flush"),
]


def zr(s):
    s = s[-6000:].encode()
    return round(len(zlib.compress(s)) / len(s), 3) if len(s) > 500 else None


def maxrun(s):
    best = cur = 0; prev = None
    for ln in (x.strip() for x in s.splitlines()):
        if not ln:
            continue
        cur = cur + 1 if ln == prev else 1; prev = ln; best = max(best, cur)
    return best


ap = argparse.ArgumentParser(); ap.add_argument("--label", required=True); ap.add_argument("--max", type=int, default=10000)
ap.add_argument("--n", type=int, default=len(P)); ap.add_argument("--skip", type=int, default=0)
ap.add_argument("--url", default="http://127.0.0.1:" + os.environ.get("PORT", "8106"))
a = ap.parse_args()
rows = []
out_dir = os.path.join(R, "runs", "longans"); os.makedirs(out_dir, exist_ok=True)
for name, prompt, marker in P[a.skip:a.skip + a.n]:
    body = {"messages": [{"role": "user", "content": prompt}], "max_tokens": a.max, "cache_prompt": False,
            "chat_template_kwargs": {"enable_thinking": True}}
    t0 = time.time()
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(a.url + "/v1/chat/completions", json.dumps(body).encode(),
                                                                    {"Content-Type": "application/json"}), timeout=3600))
    except Exception as e:  # keep going; a failed request is a result
        rows.append({"name": name, "error": repr(e)[:300]}); print(a.label, name, "ERROR", repr(e)[:200], flush=True); continue
    m = d["choices"][0]["message"]; t = d["timings"]
    rc, ct = m.get("reasoning_content") or "", m.get("content") or ""
    row = {"name": name, "finish": d["choices"][0].get("finish_reason"), "gen_n": t["predicted_n"],
           "decode_tps": round(t["predicted_per_second"], 2), "wall_s": round(time.time() - t0, 1),
           "draft_n": t.get("draft_n"), "accepted": t.get("draft_n_accepted"),
           "accept": round(t["draft_n_accepted"] / t["draft_n"], 3) if t.get("draft_n") else None,
           "reasoning_chars": len(rc), "content_chars": len(ct), "z_reasoning": zr(rc), "z_content": zr(ct),
           "maxrun_reasoning": maxrun(rc), "maxrun_content": maxrun(ct),
           "marker": (marker in ct) if marker else None, "nonascii_frac": round(sum(ord(c) > 0x2fff for c in ct) / max(1, len(ct)), 4),
           "reasoning": rc, "content": ct}
    rows.append(row)
    print(a.label, " ".join(f"{k}={row[k]}" for k in row if k not in ("reasoning", "content")), flush=True)
    json.dump({"label": a.label, "max": a.max, "rows": rows}, open(os.path.join(out_dir, f"longans-{a.label}.json"), "w"), indent=1)
fin = [r for r in rows if "error" not in r]
print(f"{a.label}: {sum(r['finish'] == 'stop' for r in fin)}/{len(rows)} stopped, "
      f"{sum(r['finish'] == 'length' for r in fin)} hit the cap, {len(rows) - len(fin)} errors, "
      f"loops(z<0.1) {sum(1 for r in fin if (r['z_reasoning'] or 1) < 0.1 or (r['z_content'] or 1) < 0.1)}")
