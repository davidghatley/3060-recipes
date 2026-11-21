"""Server-level speed and sanity checks for a running Inkling-2-Mini llama-server (stdlib only).
Adapted from ../../flint/tools/servertest.py.

    python3 -I tools/srvtest.py --label NAME [--reps 6] [--depths 0,8000,32000] [--needles 32000,60000]

Uses llama-server's own `timings` (server-side token counts), never streamed chunks.
  pp-N    : cold, unique N-token code prompt (Python stdlib source), 8 output tokens: prefill tok/s and TTFT
  code-D  : coding request after D tokens of code context, capped output (max_tokens), reasoning_effort low.
            Decode tok/s = predicted_per_second (tokens after the first / time since the first).
  needle-N: 3 random codes at 10/50/90% depth of an N-token document, temperature 0, all must come back exactly
Every request is capped (the model card warns of long reasoning loops).
Appends one JSON line per measurement to runs/ledger.jsonl and prints a summary.
"""
import argparse, json, os, random, statistics, string, subprocess, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.dirname(os.__file__)
SOURCES = ["argparse.py", "textwrap.py", "difflib.py", "inspect.py", "typing.py", "pathlib/_local.py",
           "subprocess.py", "tarfile.py", "zipfile/__init__.py", "logging/__init__.py",
           "email/message.py", "http/client.py", "urllib/request.py", "collections/__init__.py",
           "dataclasses.py", "enum.py", "functools.py", "shutil.py", "tempfile.py", "datetime.py",
           "_pydecimal.py", "pickle.py", "doctest.py", "unittest/case.py", "asyncio/base_events.py",
           "configparser.py", "ftplib.py", "imaplib.py", "mailbox.py", "optparse.py", "pydoc.py",
           "smtplib.py", "statistics.py", "threading.py", "traceback.py", "xml/dom/minidom.py"]
TASKS = [
    "Write a Python function `merge_intervals(intervals)` that merges overlapping closed intervals and returns "
    "them sorted. Include a short docstring and three asserts as tests. Output only one code block.",
    "Write a TypeScript function `debounce<T extends (...a: any[]) => void>(fn: T, ms: number)` with a `cancel()` "
    "method on the returned function. Output only one code block.",
    "Write a Python class `LRUCache` with get/put in O(1) using OrderedDict, plus a `__repr__`. Output only one code block.",
    "Write a bash script that finds the 10 largest files under a directory given as $1, printing human-readable "
    "sizes, and exits 2 with a usage message if $1 is missing. Output only one code block.",
    "Write a Rust function `fn parse_kv(s: &str) -> std::collections::HashMap<String, String>` that parses "
    "`a=1;b=2` style strings, skipping empty or malformed pairs. Output only one code block.",
    "Write a SQL query that returns, for each customer, their most recent order id and total, from tables "
    "customers(id, name) and orders(id, customer_id, created_at, total). Explain it in two sentences.",
]


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


def chat(url, content, max_tokens, temperature=None, effort="low"):
    body = {"messages": [{"role": "user", "content": content}], "max_tokens": max_tokens,
            "cache_prompt": True, "chat_template_kwargs": {"reasoning_effort": effort}}
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
    guess = min(len(text), int(n_tokens * 3.2))
    for _ in range(12):
        n = tokens(url, text[:guess])
        if abs(n - n_tokens) < max(50, n_tokens * 0.01):
            break
        guess = min(len(text), int(guess * n_tokens / max(n, 1)))
    return text[:guess]


def looping(s, k=40):
    """Crude loop detector: share of repeated 40-char shingles in the last 4000 chars."""
    s = s[-4000:]
    sh = [s[i:i + k] for i in range(0, max(0, len(s) - k), k // 2)]
    return round(1 - len(set(sh)) / len(sh), 2) if sh else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:" + os.environ.get("INK_PORT", "8085"))
    ap.add_argument("--label", required=True)
    ap.add_argument("--reps", type=int, default=6)
    ap.add_argument("--pp", default="8000", help="comma list of cold prefill sizes")
    ap.add_argument("--depths", default="0", help="comma list of context depths for the code decode case")
    ap.add_argument("--needles", default="")
    ap.add_argument("--max", type=int, default=512, help="max_tokens for decode cases")
    ap.add_argument("--effort", default="low")
    ap.add_argument("--ledger", default=os.path.join(ROOT, "runs", "ledger.jsonl"))
    a = ap.parse_args()
    ledger = open(a.ledger, "a")
    text = corpus()
    rng = random.Random()

    def log(case, **kv):
        rec = {"label": a.label, "case": case, "t": time.time(), "vram_mib": vram(), **kv}
        ledger.write(json.dumps(rec) + "\n"); ledger.flush()
        print(f"{a.label:<22} {case:<12} " + " ".join(f"{k}={v}" for k, v in kv.items()), flush=True)

    # warm-up (also warms an MoE cache if one is configured); not logged as a measurement
    chat(a.url, f"[warm {rng.random():.6f}] " + TASKS[0], 256, effort=a.effort)

    for n in filter(None, a.pp.split(",")):
        n = int(n); pf = []
        for i in range(2):
            nonce = "".join(rng.choices(string.ascii_letters, k=24))
            doc = f"Session {nonce}.\n" + sized(a.url, text[(i * 97000) % 200000:], n)
            d = chat(a.url, doc + "\n\nReply with the word OK.", 8, effort="none")
            t = d["timings"]; pf.append(t["prompt_per_second"])
            log(f"pp-{n // 1000}k", prompt_n=t["prompt_n"], prefill_tps=round(t["prompt_per_second"], 1),
                ttft_s=round(t["prompt_ms"] / 1000, 2))
        log(f"pp-{n // 1000}k-med", prefill_tps=round(statistics.median(pf), 1))

    for depth in [int(x) for x in a.depths.split(",") if x != ""]:
        ctx = ""
        if depth:
            ctx = ("Here is some reference code from the project:\n```python\n"
                   + sized(a.url, text[150000:], depth) + "\n```\n\n")
        rates, loops = [], []
        for i in range(a.reps):
            task = TASKS[i % len(TASKS)]
            # same context each rep (prefix cache hit) so the decode window is clean; unique tail
            d = chat(a.url, ctx + f"[run {rng.random():.6f}] " + task, a.max, effort=a.effort)
            t = d["timings"]; msg = d["choices"][0]["message"]
            out = (msg.get("reasoning_content") or "") + (msg.get("content") or "")
            rates.append(t["predicted_per_second"]); loops.append(looping(out))
            log(f"code-{depth // 1000}k", gen_n=t["predicted_n"], prompt_n=t["prompt_n"] + t.get("cache_n", 0),
                decode_tps=round(t["predicted_per_second"], 1), finish=d["choices"][0].get("finish_reason"),
                content_chars=len(msg.get("content") or ""), loop=loops[-1],
                **({"draft_n": t.get("draft_n"), "accepted": t.get("draft_n_accepted")} if "draft_n" in t else {}))
        log(f"code-{depth // 1000}k-med", decode_tps=round(statistics.median(rates), 1),
            min=round(min(rates), 1), max=round(max(rates), 1), max_loop=max(loops))

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
        d = chat(a.url, q, 2048, temperature=0.0, effort="low")
        t = d["timings"]
        ans = d["choices"][0]["message"].get("content") or ""
        found = [c for c in codes if c in ans]
        log(f"needle-{n // 1000}k", prompt_n=t["prompt_n"], found=f"{len(found)}/3",
            prefill_tps=round(t["prompt_per_second"], 1), decode_tps=round(t["predicted_per_second"], 1),
            answer=ans.strip()[:80].replace("\n", " | "))


if __name__ == "__main__":
    main()
