#!/usr/bin/env python3
"""Measure prefill and decode tok/s against an OpenAI-compatible server (stdlib only).

    python -I scripts/bench.py --url http://127.0.0.1:8080 --label faster --out deepseek-v41-strata/runs

For each case it does `--runs` requests (the first is treated as warm-up). It records:
- prefill tok/s = prompt_tokens / time to first streamed token
- decode tok/s  = (completion_tokens - 1) / (last token - first token)

A sampler thread logs GPU VRAM/util/temp, RAM, page cache, CPU busy % and the read MB/s of the disk that holds
--disk-path (default /mnt/models; NVMe names can swap between boots) once per second, so you can see whether
the run is GPU-, RAM-, CPU- or SSD-bound. Every prompt starts with a nonce, which defeats any prefix cache.
"""
import argparse, csv, json, os, statistics, subprocess, sys, threading, time, urllib.request, uuid

FILLER_SOURCES = ["argparse.py", "textwrap.py", "difflib.py", "inspect.py", "typing.py"]
CASES = {
    "chat":  dict(ctx_chars=0, ask="In three sentences, why do mixture-of-experts models run well with experts offloaded to RAM?"),
    "code":  dict(ctx_chars=0, ask="Write a Python function that merges overlapping intervals, with a short docstring and two doctests."),
    "ctx4k": dict(ctx_chars=14_000, ask="Summarize what the code above does in five bullet points."),
    "ctx8k": dict(ctx_chars=28_000, ask="Summarize what the code above does in five bullet points."),
}


def filler(n_chars):
    if not n_chars:
        return ""
    libdir = os.path.dirname(os.__file__)
    text = ""
    for name in FILLER_SOURCES:
        with open(os.path.join(libdir, name), encoding="utf-8") as f:
            text += f"\n# ---- {name}\n" + f.read()
        if len(text) >= n_chars:
            break
    return "```python\n" + text[:n_chars] + "\n```\n\n"


def disk_of(path):
    """Whole-disk block device name (e.g. nvme1n1) that holds `path`."""
    st = os.stat(path)
    dev = os.path.realpath(f"/sys/dev/block/{os.major(st.st_dev)}:{os.minor(st.st_dev)}")
    if os.path.exists(os.path.join(dev, "partition")):
        dev = os.path.dirname(dev)
    return os.path.basename(dev)


def cpu_times():
    with open("/proc/stat") as f:
        v = [int(x) for x in f.readline().split()[1:]]
    return v[3] + v[4], sum(v[:8])  # idle + iowait, total


class Sampler(threading.Thread):
    def __init__(self, path, disk):
        super().__init__(daemon=True)
        self.path, self.disk, self.stop = path, disk, threading.Event()

    def _sectors_read(self):
        with open(f"/sys/block/{self.disk}/stat") as f:
            return int(f.read().split()[2])

    def run(self):
        with open(self.path, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["t", "vram_mib", "gpu_util", "gpu_temp", "ram_avail_gib", "nvme_read_mbs",
                        "disk", "cpu_busy_pct", "page_cache_gib"])
            last, (i0, t0) = self._sectors_read(), cpu_times()
            while not self.stop.wait(1.0):
                q = subprocess.run(["nvidia-smi", "--query-gpu=memory.used,utilization.gpu,temperature.gpu",
                                    "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout.strip()
                with open("/proc/meminfo") as f:
                    mi = {l.split(":")[0]: int(l.split()[1]) for l in f}
                now, (i1, t1) = self._sectors_read(), cpu_times()
                busy = 100 * (1 - (i1 - i0) / (t1 - t0)) if t1 > t0 else float("nan")
                w.writerow([round(time.time(), 1), *[x.strip() for x in q.split(",")],
                            round(mi["MemAvailable"] / 2**20, 1), round((now - last) * 512 / 1e6, 1),
                            self.disk, round(busy, 1), round(mi["Cached"] / 2**20, 1)])
                fh.flush()
                last, i0, t0 = now, i1, t1


def one_request(url, model, prompt, max_tokens, effort, timeout):
    body = {"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens,
            "temperature": 0.6, "stream": True, "stream_options": {"include_usage": True}}
    if effort:
        body["reasoning_effort"] = effort
    req = urllib.request.Request(url.rstrip("/") + "/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + os.environ.get("STRATA_API_KEY", "none")})
    t0 = time.perf_counter()
    t_first = t_last = None
    usage, text, chunks = {}, [], 0
    with urllib.request.urlopen(req, timeout=timeout) as r:
        for raw in r:
            line = raw.decode().strip()
            if not line.startswith("data:") or line == "data: [DONE]":
                continue
            ev = json.loads(line[5:])
            usage = ev.get("usage") or usage
            for ch in ev.get("choices", []):
                d = ch.get("delta", {})
                piece = (d.get("content") or "") + (d.get("reasoning_content") or d.get("reasoning") or "")
                if piece:
                    now = time.perf_counter()
                    t_first = t_first or now
                    t_last = now
                    chunks += 1
                    text.append(d.get("content") or "")
    pt = usage.get("prompt_tokens", 0)
    ct = usage.get("completion_tokens", chunks)
    ttft = (t_first or time.perf_counter()) - t0
    gen = (t_last - t_first) if t_first and t_last and t_last > t_first else float("nan")
    return dict(prompt_tokens=pt, completion_tokens=ct, ttft_s=round(ttft, 2),
                prefill_tps=round(pt / ttft, 1) if pt and ttft else None,
                decode_tps=round((ct - 1) / gen, 2) if ct > 1 and gen == gen else None,
                total_s=round(time.perf_counter() - t0, 2), answer="".join(text)[:400])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8080")
    ap.add_argument("--model", default="default")
    ap.add_argument("--cases", default="chat,code,ctx4k,ctx8k")
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--max-tokens", type=int, default=256)
    ap.add_argument("--effort", default="low")
    ap.add_argument("--timeout", type=int, default=900)
    ap.add_argument("--label", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--disk-path", default="/mnt/models", help="sample reads of the disk holding this path")
    a = ap.parse_args()

    stamp = time.strftime("%Y%m%d-%H%M%S")
    os.makedirs(a.out, exist_ok=True)
    base = os.path.join(a.out, f"{stamp}-{a.label}")
    sampler = Sampler(base + "-telemetry.csv", disk_of(a.disk_path))
    sampler.start()
    rows = []
    try:
        for case in a.cases.split(","):
            c = CASES[case]
            for i in range(a.runs):
                prompt = f"[run {uuid.uuid4().hex[:8]}]\n" + filler(c["ctx_chars"]) + c["ask"]
                r = one_request(a.url, a.model, prompt, a.max_tokens, a.effort, a.timeout)
                r.update(case=case, run=i, warm=i > 0, t=round(time.time(), 1))
                rows.append(r)
                print(f"{case:6} run{i} pt={r['prompt_tokens']:>5} ct={r['completion_tokens']:>4} "
                      f"ttft={r['ttft_s']:>6}s prefill={r['prefill_tps']} tok/s decode={r['decode_tps']} tok/s", flush=True)
    finally:
        sampler.stop.set()
        with open(base + ".jsonl", "w") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")

    print(f"\nsummary ({a.label}; warm runs only, median):")
    for case in a.cases.split(","):
        warm = [r for r in rows if r["case"] == case and r["warm"]]
        if not warm:
            continue
        med = lambda k: statistics.median([r[k] for r in warm if r[k] is not None] or [float("nan")])
        print(f"  {case:6} prompt={med('prompt_tokens'):>6.0f} prefill={med('prefill_tps'):>7.1f} tok/s  "
              f"decode={med('decode_tps'):>6.2f} tok/s")
    print(f"raw: {base}.jsonl  telemetry: {base}-telemetry.csv")


if __name__ == "__main__":
    sys.exit(main())
