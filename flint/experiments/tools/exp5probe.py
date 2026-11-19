"""MoE-cache probes against a running llama-server (stdlib only).
    python3 -I tools/exp5probe.py --label NAME [--url ...] [--cases warmup,greedy,depth]
warmup : 4 requests x 1024 generated tokens (ignore_eos, streamed). Reports server t/s per request and
         client-side t/s per 128-token window, to see whether decode climbs as the cache fills.
greedy : 3 prompts x 128 tokens at temperature 0, raw /completion; texts saved for cache/no-cache comparison.
depth  : ~32k-token code prompt, then 256 generated tokens: decode t/s at 32k depth (server timings).
Appends JSON lines to runs/exp5-ledger.jsonl."""
import argparse, json, os, random, string, subprocess, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.dirname(os.__file__)

def post(url, path, body, timeout=3600):
    req = urllib.request.Request(url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

def stream(url, body):
    body = dict(body, stream=True)
    req = urllib.request.Request(url + "/completion", json.dumps(body).encode(), {"Content-Type": "application/json"})
    stamps, final = [], None
    with urllib.request.urlopen(req, timeout=3600) as r:
        for line in r:
            line = line.strip()
            if not line.startswith(b"data:"): continue
            d = json.loads(line[5:])
            stamps.append(time.time())
            if d.get("stop"): final = d
    return stamps, final

def vram():
    return int(subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout.strip() or 0)

PROMPTS = ["The history of the lighthouse at the edge of the bay begins in",
           "def merge_sorted(a, b):\n    \"\"\"Merge two sorted lists into one sorted list.\"\"\"\n",
           "Explain, step by step, why the sky looks blue during the day and red at sunset."]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8081"); ap.add_argument("--label", required=True)
    ap.add_argument("--cases", default="warmup,greedy,depth")
    ap.add_argument("--ledger", default=os.path.join(ROOT, "runs", "exp5-ledger.jsonl"))
    a = ap.parse_args(); cases = a.cases.split(","); led = open(a.ledger, "a")
    def log(case, **kv):
        rec = {"label": a.label, "case": case, "t": time.time(), "vram_mib": vram(), **kv}
        led.write(json.dumps(rec) + "\n"); led.flush()
        print(f"{a.label:<22} {case:<8} " + " ".join(f"{k}={v}" for k, v in kv.items() if k != "text"), flush=True)
    rng = random.Random(1)
    if "warmup" in cases:
        for i in range(4):
            p = f"[{i}] Write a long, detailed story about a lighthouse keeper. Chapter {i + 1}:\n"
            st, fin = stream(a.url, {"prompt": p, "n_predict": 1024, "ignore_eos": True, "temperature": 1.0, "cache_prompt": False, "seed": i})
            win = [round(128 / (st[j + 128] - st[j]), 1) for j in range(1, len(st) - 129, 128)]
            log("warmup", req=i, server_tps=round(fin["timings"]["predicted_per_second"], 2), n=fin["timings"]["predicted_n"], windows=win)
    if "greedy" in cases:
        for i, p in enumerate(PROMPTS):
            d = post(a.url, "/completion", {"prompt": p, "n_predict": 128, "temperature": 0.0, "top_k": 1, "cache_prompt": False, "seed": 0})
            log("greedy", i=i, tps=round(d["timings"]["predicted_per_second"], 1), text=d["content"], head=d["content"][:50].replace("\n", " "))
    if "depth" in cases:
        text = ""
        for f in ["argparse.py", "inspect.py", "typing.py", "subprocess.py", "tarfile.py", "difflib.py", "pickle.py", "doctest.py", "shutil.py"]:
            text += open(os.path.join(LIB, f), encoding="utf-8").read()
        n = 0; guess = 32768 * 3
        for _ in range(8):
            n = len(post(a.url, "/tokenize", {"content": text[:guess]})["tokens"])
            if abs(n - 32768) < 300: break
            guess = int(guess * 32768 / n)
        nonce = "".join(rng.choices(string.ascii_letters, k=16))
        d = post(a.url, "/completion", {"prompt": f"# {nonce}\n" + text[:guess], "n_predict": 256, "ignore_eos": True, "temperature": 1.0, "cache_prompt": False})
        t = d["timings"]
        log("depth32k", prompt_n=t["prompt_n"], prefill_tps=round(t["prompt_per_second"], 1), decode_tps=round(t["predicted_per_second"], 2))

if __name__ == "__main__":
    main()
