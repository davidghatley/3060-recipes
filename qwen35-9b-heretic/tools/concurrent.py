"""Aggregate decode throughput with N simultaneous requests (stdlib only).
    python3 -I tools/concurrent.py --label NAME --n 4 [--rounds 3] [--max 256] [--think off]
Each round fires N different coding prompts at once (thinking off by default, capped output) and records the sum of
generated tokens over the wall time of the round, plus each request's own predicted_per_second. One JSON line per
round and one median line go to runs/ledger.jsonl (case cN-agg)."""
import argparse, json, os, random, statistics, threading, time, urllib.request, zlib, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srvtest import TASKS, vram, zratio  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://127.0.0.1:" + os.environ.get("PORT", "8106"))
ap.add_argument("--label", required=True); ap.add_argument("--n", type=int, default=4)
ap.add_argument("--rounds", type=int, default=3); ap.add_argument("--max", type=int, default=256)
ap.add_argument("--think", default="off")
a = ap.parse_args()
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ledger = open(os.path.join(R, "runs", "ledger.jsonl"), "a"); run_id = time.strftime("%Y%m%d-%H%M%S")
rng = random.Random()


def one(i, out):
    body = {"messages": [{"role": "user", "content": f"[r {rng.random():.6f}] " + TASKS[i % len(TASKS)]}],
            "max_tokens": a.max, "cache_prompt": False, "chat_template_kwargs": {"enable_thinking": a.think == "on"}}
    req = urllib.request.Request(a.url + "/v1/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
    d = json.loads(urllib.request.urlopen(req, timeout=1800).read())
    m = d["choices"][0]["message"]
    out[i] = (d["timings"]["predicted_n"], d["timings"]["predicted_per_second"],
              zratio((m.get("reasoning_content") or "") + (m.get("content") or "")))


aggs = []
for r in range(a.rounds):
    out = {}; th = [threading.Thread(target=one, args=(i, out)) for i in range(a.n)]
    t0 = time.time(); [t.start() for t in th]; [t.join() for t in th]; wall = time.time() - t0
    gen = sum(v[0] for v in out.values()); aggs.append(gen / wall)
    rec = {"label": a.label, "run": run_id, "case": f"c{a.n}-agg", "t": round(time.time(), 1), "vram_mib": vram(),
           "gen_n": gen, "wall_s": round(wall, 2), "agg_tps": round(gen / wall, 1),
           "per_req_tps": [round(v[1], 1) for v in out.values()], "z": [v[2] for v in out.values()]}
    ledger.write(json.dumps(rec) + "\n"); ledger.flush(); print(rec, flush=True)
rec = {"label": a.label, "run": run_id, "case": f"c{a.n}-agg-med", "t": round(time.time(), 1), "agg_tps": round(statistics.median(aggs), 1)}
ledger.write(json.dumps(rec) + "\n"); print(rec)
