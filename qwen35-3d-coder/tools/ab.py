"""A/B session runner: start llama-server per config in the given order, bench it, stop it, log to the ledger.
Run the whole session inside ONE gpu_run so no other job lands between a control and its candidate:

    GPU_RUN_MEM=24G ~/anime-pipeline/tools/gpu_run --need 9000 --wait 3600 \
        python3 -I tools/ab.py configs/<session>.json

Session file:
  {"name": "...", "order": ["A", "B", "A"], "bench": ["decode"] | ["decode", "prefill"],
   "n_predict": 768, "prompts": 3,
   "configs": {"A": {"model": "...gguf", "args": ["-c", "65536", ...], "env": {}}, "B": {...}}}

decode : for each of `prompts` eval prompts, two phases with sampling as on the model card (T=0.6, top-k 20,
         top-p 0.95, seed 1): R = fresh prompt, the model starts reasoning (prose); C = prompt + the
         dataset's reference reasoning, so the model is writing the HTML/JS (code, ~10-20k tokens deep).
         Records llama-server's own timings: predicted_per_second, draft_n / draft_n_accepted.
prefill: unique prompts of ~2k, 8k and 16k tokens (cache_prompt off): prompt tok/s and TTFT.
Server is stopped with SIGINT (never SIGKILL mid-batch). Appends to runs/ledger.jsonl. Standard library only.
"""
import json, os, signal, statistics, subprocess, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BIN = os.environ.get("QC_BIN", "/mnt/scratch/llama.cpp/b12242/bin/llama-b12242")
CUDA_LIB = os.environ.get("QC_CUDA_LIB", "/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64")
PORT = int(os.environ.get("QC_PORT", "8082"))
URL = f"http://127.0.0.1:{PORT}"
SUBSET = ROOT / "runs/data/subset-40.jsonl"

sess = json.load(open(sys.argv[1]))
ledger = open(ROOT / "runs/ledger.jsonl", "a")
logdir = ROOT / "runs" / f"ab-{sess['name']}"
logdir.mkdir(parents=True, exist_ok=True)
prompts = [json.loads(l) for l in open(SUBSET)]
# spread over levels: items 0,7,14,... of the round-robin subset
prompts = [prompts[(i * 7) % len(prompts)] for i in range(sess.get("prompts", 3))]


def post(path, body, timeout=3600):
    req = urllib.request.Request(URL + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def gpu_state():
    q = "temperature.gpu,clocks.sm,clocks.mem,power.draw,memory.used,pstate"
    return subprocess.run(["nvidia-smi", f"--query-gpu={q}", "--format=csv,noheader"], capture_output=True, text=True).stdout.strip()


def start(name, cfg, step):
    env = dict(os.environ, LD_LIBRARY_PATH=f"{BIN}:{CUDA_LIB}", **cfg.get("env", {}))
    cmd = [f"{BIN}/llama-server", "-m", cfg["model"], "--host", "127.0.0.1", "--port", str(PORT),
           "--jinja", "--reasoning-format", "deepseek", "--no-webui", "--metrics"] + cfg["args"]
    log = open(logdir / f"server-{step:02d}-{name}.log", "w")
    log.write(" ".join(cmd) + "\n"); log.flush()
    p = subprocess.Popen(cmd, env=env, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    t0 = time.time()
    while time.time() - t0 < 300:
        if p.poll() is not None:
            raise RuntimeError(f"server {name} exited during load, see {log.name}")
        try:
            with urllib.request.urlopen(URL + "/health", timeout=2) as r:
                if r.status == 200:
                    return p, time.time() - t0
        except Exception:
            pass
        time.sleep(0.5)
    raise RuntimeError("server load timeout")


def stop(p):
    p.send_signal(signal.SIGINT)
    try:
        p.wait(60)
    except subprocess.TimeoutExpired:
        p.terminate(); p.wait(30)


def template(x):
    return post("/apply-template", {"messages": [{"role": "system", "content": x["system"]},
                                                  {"role": "user", "content": x["user"]}]})["prompt"]


def complete(prompt, n):
    body = {"prompt": prompt, "n_predict": n, "temperature": 0.6, "top_k": 20, "top_p": 0.95, "min_p": 0.0,
            "repeat_penalty": 1.0, "seed": 1, "cache_prompt": False, "stream": False}
    t0 = time.time()
    d = post("/completion", body)
    d["_wall"] = time.time() - t0
    return d


def bench_decode(name, step, n):
    out = []
    for x in prompts:
        base = template(x)
        if not base.rstrip().endswith("<think>"):
            base = base + "<think>\n"
        for phase, prompt in (("R", base), ("C", base + x["ref_reasoning"].strip() + "\n</think>\n\n")):
            d = complete(prompt, n)
            t = d["timings"]
            rec = {"phase": phase, "id": x["id"], "n_prompt": t.get("prompt_n"), "n": t.get("predicted_n"),
                   "tps": round(t["predicted_per_second"], 2), "draft_n": t.get("draft_n"),
                   "draft_acc": t.get("draft_n_accepted"), "pp_tps": round(t.get("prompt_per_second", 0), 1)}
            out.append(rec)
            print(f"  [{name}] {phase} {x['id']} ctx={rec['n_prompt']} n={rec['n']} {rec['tps']} tok/s "
                  f"draft {rec['draft_acc']}/{rec['draft_n']}", flush=True)
    return out


def bench_greedy(name, step, n):
    """temperature 0 outputs for a lossless check: same text with and without speculation?"""
    out = []
    for x in prompts:
        base = template(x)
        if not base.rstrip().endswith("<think>"):
            base = base + "<think>\n"
        for phase, prompt in (("gR", base), ("gC", base + x["ref_reasoning"].strip() + "\n</think>\n\n")):
            body = {"prompt": prompt, "n_predict": n, "temperature": 0, "top_k": 1, "seed": 1, "cache_prompt": False}
            if sess.get("n_probs"):
                body.update({"n_probs": 2, "top_k": 2, "post_sampling_probs": False})
            d = post("/completion", body)
            t = d["timings"]
            out.append({"phase": phase, "id": x["id"], "n": t.get("predicted_n"), "gtps": round(t["predicted_per_second"], 2),
                        "draft_n": t.get("draft_n"), "draft_acc": t.get("draft_n_accepted"), "text": d["content"]})
            if sess.get("n_probs"):
                # per token: piece, top-1 and top-2 logprob, so a divergence can be checked for a near-tie
                out[-1]["probs"] = [[c.get("token"), *[x.get("logprob") for x in c.get("top_logprobs", [])[:2]]]
                                    for c in d.get("completion_probabilities", [])]
            print(f"  [{name}] {phase} {x['id']} greedy n={t.get('predicted_n')} {t['predicted_per_second']:.1f} tok/s", flush=True)
    return out


def bench_prefill(name, step):
    filler = "".join(json.loads(l)["ref_content"] for l in open(SUBSET))
    out = []
    for target in (2048, 8192, 16384):
        # unique prefix per step so nothing is cached; sized with the server tokenizer
        text = f"[run {time.time()}]\n" + filler[: target * 3]
        toks = post("/tokenize", {"content": text})["tokens"][:target]
        d = post("/completion", {"prompt": toks, "n_predict": 1, "cache_prompt": False, "temperature": 0})
        t = d["timings"]
        out.append({"phase": f"pp{target}", "n_prompt": t["prompt_n"], "pp_tps": round(t["prompt_per_second"], 1),
                    "ttft_ms": round(t["prompt_ms"], 1)})
        print(f"  [{name}] prefill {t['prompt_n']} tok: {t['prompt_per_second']:.0f} tok/s, {t['prompt_ms']:.0f} ms", flush=True)
    return out


print(f"session {sess['name']} order {sess['order']} at {time.strftime('%F %T')}; gpu {gpu_state()}", flush=True)
summary = {}
for step, name in enumerate(sess["order"]):
    cfg = sess["configs"][name]
    p, load_s = start(name, cfg, step)
    g0 = gpu_state()
    try:
        recs = []
        if "decode" in sess["bench"]:
            recs += bench_decode(name, step, sess.get("n_predict", 768))
        if "greedy" in sess["bench"]:
            recs += bench_greedy(name, step, sess.get("n_greedy", 512))
        if "prefill" in sess["bench"]:
            recs += bench_prefill(name, step)
        with urllib.request.urlopen(URL + "/metrics", timeout=5) as r:
            pass
    finally:
        vram = gpu_state()
        stop(p)
    for r in recs:
        r.update({"session": sess["name"], "config": name, "step": step, "model": Path(cfg["model"]).name,
                  "args": " ".join(cfg["args"]), "load_s": round(load_s, 1), "gpu_start": g0, "gpu_end": vram,
                  "ts": time.strftime("%FT%T")})
        ledger.write(json.dumps(r) + "\n")
    ledger.flush()
    dec = [r["tps"] for r in recs if r["phase"] in ("R", "C")]
    if dec:
        R = [r["tps"] for r in recs if r["phase"] == "R"]; C = [r["tps"] for r in recs if r["phase"] == "C"]
        print(f"step {step} {name}: decode median {statistics.median(dec):.1f} (R {statistics.median(R):.1f}, "
              f"C {statistics.median(C):.1f}) load {load_s:.1f}s gpu_end [{vram}]", flush=True)
        summary.setdefault(name, []).append((statistics.median(R), statistics.median(C)))
print("SUMMARY (per step: median R, median C):")
for k, v in summary.items():
    print(f"  {k}: " + "  ".join(f"R {r:.1f} C {c:.1f}" for r, c in v))
