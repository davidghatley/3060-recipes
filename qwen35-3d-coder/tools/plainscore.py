"""Could plain decoding have written this page? Re-score every answer token of finished pages on a no-spec server.

The render-eval pages were sampled with top-k 20, top-p 0.95 and the server's min-p 0.05 (temperature comes last in
llama.cpp's chain, so it does not move these cuts). A token outside that set has zero probability under plain
sampling. Each position is scored by extending the cached prefix by one token, so the logits come from the same
one-token decode path a no-spec server samples from. If MTP's 3-token verify path gives different logits, MTP pages
carry more of these "impossible" tokens than no-spec pages; re-tokenizing the text adds the same noise to both arms.

  python3 -I tools/plainscore.py score --url URL --runs runs/eval-rc-mtp-s1 ... --out runs/plainscore --deadline-min 27
  python3 -I tools/plainscore.py report --out runs/plainscore
  python3 -I tools/plainscore.py todo --runs ... --out runs/plainscore   # pages left to score
Scores only the answer (content), conditioned on the prompt and the page's own reasoning. Standard library only."""
import argparse, json, math, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("mode", choices=["score", "report", "todo"])
ap.add_argument("--url", default="http://127.0.0.1:8090")
ap.add_argument("--runs", nargs="*", default=[])
ap.add_argument("--out", default=str(ROOT / "runs/plainscore"))
ap.add_argument("--deadline-min", type=float, default=0)
ap.add_argument("--top-k", type=int, default=20)
ap.add_argument("--top-p", type=float, default=0.95)
ap.add_argument("--min-p", type=float, default=0.05)
a = ap.parse_args()
out = Path(a.out)


def post(path, body, timeout=600):
    req = urllib.request.Request(a.url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def allowed(top, tok):
    """Is tok in the top-k / top-p / min-p set of this distribution ({id: logprob}, the top-k entries)?"""
    ids = sorted(top, key=top.get, reverse=True)[: a.top_k]
    if tok not in ids:
        return False, None
    w = [math.exp(top[i]) for i in ids]
    z = sum(w); w = [x / z for x in w]
    keep, cum = 0, 0.0
    for x in w:
        keep += 1; cum += x
        if cum >= a.top_p:
            break
    r = ids.index(tok)
    return r < keep and w[r] >= a.min_p * w[0], r


if a.mode == "score":
    out.mkdir(parents=True, exist_ok=True)
    t_end = time.time() + a.deadline_min * 60 if a.deadline_min else None
    sub = {x["id"]: x for x in map(json.loads, open(ROOT / "runs/data/subset-40.jsonl"))}
    # interleave the runs page by page, so a session that stops at its deadline leaves the arms balanced
    work = [(Path(rd), it) for rd in a.runs for it in json.load(open(Path(rd) / "score.json"))["items"]]
    work.sort(key=lambda w: (w[1]["id"], a.runs.index(str(w[0]))))
    first = True
    for rd, it in work:
            pid = it["id"]
            dst = out / f"{rd.name}__{pid}.json"
            if not it["finished"] or dst.exists():
                continue
            if t_end and time.time() > t_end:
                print("deadline reached; rerun to resume", flush=True); raise SystemExit(0)
            rec = json.load(open(rd / f"{pid}.json"))
            x = sub[pid]
            prompt = post("/apply-template", {"messages": [{"role": "system", "content": x["system"]},
                                                           {"role": "user", "content": x["user"]}]})["prompt"]
            head = prompt + (rec.get("reasoning") or "") + "\n</think>\n\n"
            if not prompt.rstrip().endswith("<think>"):
                head = prompt + "<think>\n" + (rec.get("reasoning") or "") + "\n</think>\n\n"
            if first:
                print("template tail:", repr(head[-120:]), flush=True); first = False
            ptoks = post("/tokenize", {"content": head, "add_special": True})["tokens"]
            ctoks = post("/tokenize", {"content": rec["content"], "add_special": False})["tokens"]
            t0 = time.time()
            bad, ranks, eog = [], [], []
            for k, tok in enumerate(ctoks):
                d = post("/completion", {"prompt": ptoks + ctoks[:k], "n_predict": 1, "temperature": 0,
                                         "n_probs": a.top_k, "cache_prompt": True, "stream": False})
                if not d.get("completion_probabilities"):
                    # the server returns no probabilities when its pick is end-of-generation; such a position
                    # cannot be judged with these cuts, so it is counted apart and not called impossible
                    eog.append(k); ranks.append(-2); continue
                top = {t["id"]: t["logprob"] for t in d["completion_probabilities"][0]["top_logprobs"]}
                ok, r = allowed(top, tok)
                ranks.append(-1 if r is None else r)
                if not ok:
                    bad.append({"k": k, "tok": tok, "rank": r, "lp": top.get(tok), "top1_lp": max(top.values()),
                                "piece": post("/detokenize", {"tokens": [tok]})["content"],
                                "ctx": post("/detokenize", {"tokens": ctoks[max(0, k - 12):k]})["content"]})
            dst.write_text(json.dumps({"run": rd.name, "id": pid, "pass": it["pass"], "first_error": it.get("first_error"),
                                       "n": len(ctoks), "prefix_n": len(ptoks), "bad": bad, "eog": eog, "ranks": ranks,
                                       "wall_s": round(time.time() - t0, 1)}))
            print(f"{rd.name} {pid} n={len(ctoks)} impossible={len(bad)} ({len(bad) / max(1, len(ctoks)) * 1e3:.2f}/1k) "
                  f"unjudged={len(eog)} {'pass' if it['pass'] else (it.get('first_error') or 'fail')[:60]} {time.time() - t0:.0f}s", flush=True)

elif a.mode == "todo":
    print(sum(it["finished"] and not (out / f"{Path(rd).name}__{it['id']}.json").exists()
              for rd in a.runs for it in json.load(open(Path(rd) / "score.json"))["items"]))

else:
    rows = [json.loads(f.read_text()) for f in sorted(out.glob("*__scene-*.json"))]
    arms = {}
    for r in rows:
        arm = "mtp" if "-mtp-" in r["run"] else "none"
        arms.setdefault(arm, []).append(r)
        print(f"{arm:4s} {r['run']:16s} {r['id']} n={r['n']:5d} impossible={len(r['bad']):3d} "
              f"({len(r['bad']) / r['n'] * 1e3:.2f}/1k) {'pass' if r['pass'] else (r['first_error'] or 'fail')[:50]}")
    for arm, rs in sorted(arms.items()):
        n = sum(r["n"] for r in rs); b = sum(len(r["bad"]) for r in rs)
        print(f"== {arm}: {len(rs)} pages, {n} tokens, {b} impossible ({b / max(1, n) * 1e3:.3f} per 1k tokens)")
