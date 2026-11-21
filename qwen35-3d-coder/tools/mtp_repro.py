"""Deterministic MTP repro: greedy runs with per-token logprobs, then teacher forcing on a no-spec server.

  gen     greedy (temperature 0) answer per prompt, top-N logprobs at every position  -> <out>/<id>.json
  force   re-score positions of earlier runs on THIS server (prompt + the run's own tokens[:k], 1 token, full
          prefill, no cache): the reference distribution for the exact prefix the run conditioned on
  compare per run: first divergence vs a reference run (and the top1-top2 gap there), and how far the run's own
          logprobs are from the forced re-score of the same prefix (state corruption shows up here, numerics don't)

    python3 -I tools/mtp_repro.py gen     --url URL --ids a,b --max 6000 --out runs/mtprepro/<session>/<config>
    python3 -I tools/mtp_repro.py force   --url URL --runs DIR [DIR ...] --step 250
    python3 -I tools/mtp_repro.py compare --ref DIR --runs DIR [DIR ...]
Standard library only."""
import argparse, json, math, time, urllib.request, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("mode", choices=["gen", "force", "compare"])
ap.add_argument("--url", default="http://127.0.0.1:8090")
ap.add_argument("--ids", default="scene-000048,scene-000334,scene-000335")
ap.add_argument("--max", type=int, default=6000)
ap.add_argument("--n-probs", type=int, default=10)
ap.add_argument("--out")
ap.add_argument("--runs", nargs="*", default=[])
ap.add_argument("--ref")
ap.add_argument("--step", type=int, default=250)
ap.add_argument("--cache", action="store_true", help="like qualify.py: a short chat first, prompt cache on")
ap.add_argument("--temp", type=float, default=0.0, help=">0: the model card's sampling (top-p 0.95, top-k 20), seed 42")
ap.add_argument("--min-p", type=float, default=0.0, help="with --temp; -1 keeps the server default (0.05, as serve.sh)")
ap.add_argument("--seeds", default="42", help="with --temp: comma-separated seeds, one run per prompt and seed")
a = ap.parse_args()


def post(path, body, timeout=3600):
    req = urllib.request.Request(a.url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def dist(entry):
    """{token id: logprob} of a completion_probabilities entry."""
    return {t["id"]: t["logprob"] for t in entry["top_logprobs"]}


if a.mode == "gen":
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    sub = {x["id"]: x for x in map(json.loads, open(ROOT / "runs/data/subset-40.jsonl"))}
    if a.cache:
        post("/v1/chat/completions", {"messages": [{"role": "user", "content": "Reply with exactly: ok"}], "max_tokens": 512})
    for pid, seed in [(p, int(s)) for p in a.ids.split(",") for s in (a.seeds.split(",") if a.temp > 0 else ["0"])]:
        x = sub[pid]
        prompt = post("/apply-template", {"messages": [{"role": "system", "content": x["system"]},
                                                       {"role": "user", "content": x["user"]}]})["prompt"]
        ptoks = post("/tokenize", {"content": prompt, "add_special": True})["tokens"]
        t0 = time.time()
        samp = {"temperature": a.temp, "top_p": 0.95, "top_k": 20, "seed": seed} if a.temp > 0 else {"temperature": 0}
        if a.temp > 0 and a.min_p >= 0:
            samp["min_p"] = a.min_p
        d = post("/completion", {"prompt": ptoks, "n_predict": a.max, "n_probs": a.n_probs, "cache_prompt": a.cache,
                                 "return_tokens": True, "stream": False, **samp})
        probs = d.get("completion_probabilities") or []
        rec = {"id": pid, "sampling": samp, "prompt_tokens": ptoks, "tokens": d.get("tokens") or [p["id"] for p in probs],
               "lp": [p["logprob"] for p in probs], "top": [dist(p) for p in probs], "text": d["content"],
               "timings": d.get("timings"), "stop_type": d.get("stop_type"), "wall_s": round(time.time() - t0, 1)}
        name = pid if len(a.seeds.split(",")) == 1 or a.temp == 0 else f"{pid}-s{seed}"
        (out / f"{name}.json").write_text(json.dumps(rec))
        tail = d["content"][-20000:]
        zr = len(zlib.compress(tail.encode(), 9)) / max(1, len(tail.encode()))
        tm = d.get("timings") or {}
        print(f"{out.name} {name} n={len(rec['tokens'])} zlib={zr:.3f}{' LOOP' if zr < 0.12 else ''} think_end={'</think>' in d['content']} tps={tm.get('predicted_per_second', 0):.1f} "
              f"draft={tm.get('draft_n')} acc={tm.get('draft_n_accepted')} wall={rec['wall_s']}s", flush=True)

elif a.mode == "force":
    for rd in map(Path, a.runs):
        for f in sorted(rd.glob("scene-*.json")):
            rec = json.loads(f.read_text())
            n = len(rec["tokens"])
            forced = {}
            for k in list(range(0, n, a.step)) + [n - 1]:
                d = post("/completion", {"prompt": rec["prompt_tokens"] + rec["tokens"][:k], "n_predict": 1,
                                         "temperature": 0, "n_probs": a.n_probs, "cache_prompt": False,
                                         "stream": False})
                forced[k] = dist(d["completion_probabilities"][0])
            (rd / f"{rec['id']}.forced.json").write_text(json.dumps({str(k): v for k, v in forced.items()}))
            print(f"forced {rd.name}/{rec['id']}: {len(forced)} positions", flush=True)

else:
    def load(d):
        return {f.stem: json.loads(f.read_text()) for f in sorted(Path(d).glob("scene-*.json")) if "." not in f.stem}

    ref = load(a.ref) if a.ref else {}
    for rd in a.runs:
        for pid, rec in load(rd).items():
            line = f"{Path(rd).name:14s} {pid} n={len(rec['tokens']):5d} stop={rec.get('stop_type')}"
            r = ref.get(pid)
            if r is not None and r is not rec:
                c = next((i for i, (x, y) in enumerate(zip(r["tokens"], rec["tokens"])) if x != y), None)
                if c is None:
                    line += " | identical to ref"
                else:
                    srt = sorted(r["top"][c].values(), reverse=True)
                    line += f" | diverges at token {c} (ref gap {srt[0] - srt[1]:.3f})"
            samp = rec.get("sampling") or {}
            if samp.get("temperature", 0) > 0:
                # sampler calibration: observed share of top-1 picks vs the share the card sampling predicts
                # (T, top-k, top-p applied to the logged top-N logprobs; N >= top-k keeps this exact)
                T, tp = samp["temperature"], samp["top_p"]
                exp_top1 = obs_top1 = 0.0
                for tok, top in zip(rec["tokens"], rec["top"]):
                    ids = sorted(top, key=top.get, reverse=True)[: samp["top_k"]]
                    w = [math.exp(top[i] / T) for i in ids]
                    z = sum(w); w = [x / z for x in w]
                    cum, keep = 0.0, 0
                    for x in w:
                        keep += 1; cum += x
                        if cum >= tp:
                            break
                    exp_top1 += w[0] / sum(w[:keep])
                    obs_top1 += int(tok) == int(ids[0])
                n = len(rec["tokens"])
                sd = math.sqrt(max(exp_top1 * (1 - exp_top1 / n), 1e-9))
                line += f" | top1 picks {obs_top1:.0f} vs expected {exp_top1:.0f} (z {(obs_top1 - exp_top1) / sd:+.1f})"
            ff = Path(rd) / f"{pid}.forced.json"
            if ff.exists():
                forced = {int(k): {int(t): lp for t, lp in v.items()} for k, v in json.loads(ff.read_text()).items()}
                dl, flips, worst = [], 0, (0.0, -1)
                for k, fd in forced.items():
                    tok = rec["tokens"][k]
                    flp = fd.get(tok, min(fd.values()))  # outside the forced top-N: bounded by its N-th logprob
                    diff = abs(rec["lp"][k] - flp)
                    dl.append(diff)
                    flips += max(fd, key=fd.get) != tok
                    worst = max(worst, (diff, k))
                dl.sort()
                line += (f" | vs forced: |dlogp| median {dl[len(dl) // 2]:.4f} max {worst[0]:.3f} @tok {worst[1]}"
                         f", argmax differs at {flips}/{len(dl)} positions")
            print(line)
