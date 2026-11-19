"""Server-level checks for a running Flint llama-server (stdlib only).

    python3 -I tools/servertest.py --label NAME [--needles 60000,120000] [--reps 6]

Uses llama-server's own `timings` (server-side token counts), never streamed chunks.
  cold11k  : unique ~11k-token prompt (opencode's system prompt size): prefill tok/s and TTFT
  code     : rewrite a ~150-line file with one change (output repeats input; ngram drafts can hit)
  prose    : open-ended writing (drafts mostly miss)
  needle-N : 3 random codes at 10/50/90% depth of an N-token document, all must come back exactly
Appends one JSON line per measurement to runs/server-ledger.jsonl and prints a summary.
"""
import argparse, json, os, random, statistics, string, subprocess, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.dirname(os.__file__)
SOURCES = ["argparse.py", "textwrap.py", "difflib.py", "inspect.py", "typing.py", "pathlib/_local.py",
           "pathlib/__init__.py", "subprocess.py", "tarfile.py", "zipfile/__init__.py", "logging/__init__.py",
           "email/message.py", "http/client.py", "urllib/request.py", "collections/__init__.py",
           "dataclasses.py", "enum.py", "functools.py", "shutil.py", "tempfile.py", "datetime.py",
           "_pydecimal.py", "pickle.py", "doctest.py", "unittest/case.py", "asyncio/base_events.py"]


def corpus():
    text = ""
    for name in SOURCES:
        p = os.path.join(LIB, name)
        if os.path.exists(p):
            text += f"\n# ==== {name}\n" + open(p, encoding="utf-8").read()
    return text


def post(url, path, body, timeout=3600):
    req = urllib.request.Request(url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def tokens(url, text):
    return len(post(url, "/tokenize", {"content": text})["tokens"])


def chat(url, content, max_tokens, temperature=None):
    body = {"model": "flint-local", "messages": [{"role": "user", "content": content}],
            "max_tokens": max_tokens, "cache_prompt": True}
    if temperature is not None:
        body["temperature"] = temperature
    t0 = time.time()
    d = post(url, "/v1/chat/completions", body)
    d["_wall"] = time.time() - t0
    return d


def vram():
    out = subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                         capture_output=True, text=True).stdout.strip()
    return int(out or 0)


def sized(url, text, n_tokens):
    """Prefix of `text` that is close to n_tokens, measured with the server's tokenizer."""
    lo, hi = 0, len(text)
    guess = min(len(text), int(n_tokens * 3.2))
    for _ in range(12):
        n = tokens(url, text[:guess])
        if abs(n - n_tokens) < n_tokens * 0.01:
            break
        guess = min(len(text), int(guess * n_tokens / max(n, 1)))
    return text[:guess]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8081")
    ap.add_argument("--label", required=True)
    ap.add_argument("--reps", type=int, default=6)
    ap.add_argument("--needles", default="")
    ap.add_argument("--skip", default="", help="comma list of cases to skip: cold11k,code,prose")
    ap.add_argument("--code-max", type=int, default=1500, help="max_tokens for the code case (includes reasoning)")
    ap.add_argument("--ledger", default=os.path.join(ROOT, "runs", "server-ledger.jsonl"))
    a = ap.parse_args()
    skip = set(filter(None, a.skip.split(",")))
    ledger = open(a.ledger, "a")
    text = corpus()
    rng = random.Random()

    def log(case, **kv):
        rec = {"label": a.label, "case": case, "t": time.time(), "vram_mib": vram(), **kv}
        ledger.write(json.dumps(rec) + "\n"); ledger.flush()
        print(f"{a.label:<18} {case:<10} " + " ".join(f"{k}={v}" for k, v in kv.items()), flush=True)

    if "cold11k" not in skip:
        pf = []
        for i in range(3):
            nonce = "".join(rng.choices(string.ascii_letters, k=24))
            doc = f"Session {nonce}.\n" + sized(a.url, text[i * 60000:], 11000)
            d = chat(a.url, doc + "\n\nReply with the word OK.", 8)
            t = d["timings"]
            pf.append(t["prompt_per_second"])
            log("cold11k", prompt_n=t["prompt_n"], prefill_tps=round(t["prompt_per_second"], 1),
                ttft_s=round(t["prompt_ms"] / 1000, 2))
        log("cold11k-med", prefill_tps=round(statistics.median(pf), 1))

    src = open(os.path.join(LIB, "textwrap.py"), encoding="utf-8").read().splitlines()[:150]
    cases = {
        "code": ("Here is a Python file. Rewrite the whole file, unchanged except that the class TextWrapper is "
                 "renamed to LineWrapper everywhere. Output only the file in one code block.\n\n```python\n"
                 + "\n".join(src) + "\n```", a.code_max),
        "prose": ("Write a 600-word short story about a lighthouse keeper who finds a radio that receives "
                  "tomorrow's weather.", 1200),
    }
    for case, (prompt, mt) in cases.items():
        if case in skip:
            continue
        rates, drafts = [], []
        for i in range(a.reps):
            d = chat(a.url, f"[run {rng.random():.6f}] " + prompt, mt)
            t = d["timings"]
            rates.append(t["predicted_per_second"])
            if "draft_n" in t:
                drafts.append((t.get("draft_n", 0), t.get("draft_n_accepted", 0)))
            msg = d["choices"][0]["message"]
            extra = {"reasoning_chars": len(msg.get("reasoning_content") or "")}
            if case == "code":
                out = msg.get("content") or ""
                extra["rewrite_ok"] = "class LineWrapper" in out and "class TextWrapper" not in out
            log(case, gen_n=t["predicted_n"], decode_tps=round(t["predicted_per_second"], 1), **extra,
                **({"draft_n": t.get("draft_n"), "accepted": t.get("draft_n_accepted")} if "draft_n" in t else {}))
        log(case + "-med", decode_tps=round(statistics.median(rates), 1),
            **({"accept_rate": round(sum(x[1] for x in drafts) / max(1, sum(x[0] for x in drafts)), 3)} if drafts else {}))

    for n in filter(None, a.needles.split(",")):
        n = int(n)
        codes = ["".join(rng.choices(string.ascii_uppercase + string.digits, k=8)) for _ in range(3)]
        body = sized(a.url, text, n - 200)
        parts, last = [], 0
        for depth, code in zip((0.1, 0.5, 0.9), codes):
            cut = body.find("\n", int(len(body) * depth))
            parts.append(body[last:cut]); parts.append(f"\n# SECRET ACCESS CODE: {code}\n"); last = cut
        parts.append(body[last:])
        q = ("".join(parts) + "\n\nThree lines in the code above start with '# SECRET ACCESS CODE:'. "
             "List the three codes in the order they appear, one per line, and nothing else.")
        d = chat(a.url, q, 4096, temperature=0.0)
        t = d["timings"]
        ans = d["choices"][0]["message"].get("content") or ""
        found = [c for c in codes if c in ans]
        log(f"needle-{n // 1000}k", prompt_n=t["prompt_n"], found=f"{len(found)}/3",
            prefill_tps=round(t["prompt_per_second"], 1), decode_tps=round(t["predicted_per_second"], 1),
            answer=ans.strip()[:80].replace("\n", " | "))


if __name__ == "__main__":
    main()
