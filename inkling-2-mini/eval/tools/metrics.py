#!/usr/bin/env python3
"""Per-question metrics for a decision-index run: accuracy, modal agreement, ECE, Brier, latency.

Definitions (fixed for every run; see eval/INDEX_NOTES.md for how they relate to the board):
- field: one question of one request with a non-null gold answer (`expected[key]`).
- accuracy: chosen option == gold. Noul: (p_yes >= 0.5) == gold.
- confidence: probability on the chosen option (noul: max(p, 1 - p)). The board's definition.
- ECE: 10 equal-width bins over confidence, sum_b w_b |acc_b - conf_b|. Benchmarks weigh equally (each field
  weighs 1 / (fields in its benchmark x benchmarks)), as in the board's calibration note. ToolRet (2),
  BRIGHT (36) and RouterBench (6) are left out, as on the board. Also reported unweighted ("pooled").
- Brier: multi-class, sum over options of (p_k - 1[k = gold])^2, same weights.
- modal agreement: share of fields where the chosen option equals a reference run's chosen option (default:
  the control model's run on the same rows). The board publishes no per-row answers, so the reference has
  to be a run we made.
- latency per question: request wall time / questions in the request; median, mean, p80 (the board's
  latency rule uses median, mean and p80 per request, so per request is reported too).
Unanswered fields (unsupported/error) count as wrong for accuracy and are left out of calibration.

usage: python -I eval/tools/metrics.py --rows SAMPLE --results RESULTS.jsonl [--reference REF.jsonl] [--temperature T] --out M.json
"""
import argparse
import collections
import gzip
import json
import math
from pathlib import Path

NO_CAL = {2, 36, 6}
ADDED_02 = {56, 57, 58, 59, 61, 62, 64}
N_BINS = 10


def read_jsonl(path):
    op = gzip.open if str(path).endswith(".gz") else open
    with op(path, "rt") as f:
        return [json.loads(x) for x in f if x.strip()]


def gold_key(q, g):
    if q["type"] == "noul":
        if isinstance(g, bool):
            return "true" if g else "false"
        if isinstance(g, (int, float)):
            return "true" if g >= 0.5 else "false"
        return "true" if str(g).lower() in ("true", "yes", "1") else "false"
    if isinstance(g, list):
        return g[0] if len(g) == 1 else None
    return g


def answer_probs(q, ans, raw_k=None, temperature=None):
    """Option probabilities, optionally re-tempered from the engine's raw code logprobs."""
    if temperature and raw_k and "code_logprobs" in raw_k:
        lp = raw_k["code_logprobs"]
        m = max(lp.values())
        w = {k: math.exp((v - m) / temperature) for k, v in lp.items()}
        z = sum(w.values())
        return {k: v / z for k, v in w.items()}
    if q["type"] == "noul":
        p = ans["noul"]
        return {"false": 1 - p, "true": p}
    return ans["probabilities"]


def fields(rows, results, temperature=None):
    out = []
    for r in rows:
        e = r["_evaluation"]
        res = results.get(e["run_id"])
        nq = max(1, len(r["questions"]))
        for k, q in r["questions"].items():
            g = (r.get("expected") or {}).get(k)
            if g is None or q["type"] not in ("choice", "noul"):
                continue
            gk = gold_key(q, g)
            if gk is None:
                continue
            f = {"bench": e["catalog_id"], "run_id": e["run_id"], "key": k, "gold": gk, "answered": False}
            if res and res.get("status") == "ok":
                a = res["response"]["answers"][k]
                raw = (res.get("raw_output") or {}).get(k) if isinstance(res.get("raw_output"), dict) else None
                p = answer_probs(q, a, raw, temperature)
                choice = max(p, key=p.get)
                f.update(answered=True, choice=choice, conf=p[choice], correct=choice == gk,
                         brier=sum((v - (1.0 if kk == gk else 0.0)) ** 2 for kk, v in p.items()) + (0.0 if gk in p else 1.0),
                         n_options=len(p), q_ms=res.get("total_wall_ms", 0) / nq)
            out.append(f)
    return out


def weights(fs):
    by = collections.Counter(f["bench"] for f in fs)
    nb = len(by)
    return [1.0 / (by[f["bench"]] * nb) for f in fs]


def ece(fs, w):
    bins = [[0.0, 0.0, 0.0] for _ in range(N_BINS)]  # weight, sum conf, sum acc
    for f, wi in zip(fs, w):
        b = min(N_BINS - 1, int(f["conf"] * N_BINS))
        bins[b][0] += wi
        bins[b][1] += wi * f["conf"]
        bins[b][2] += wi * f["correct"]
    tot = sum(b[0] for b in bins)
    rel = [{"lo": i / N_BINS, "w": b[0] / tot, "conf": b[1] / b[0], "acc": b[2] / b[0]} for i, b in enumerate(bins) if b[0] > 0]
    return sum(x["w"] * abs(x["acc"] - x["conf"]) for x in rel), rel


def wmean(xs, w):
    return sum(x * wi for x, wi in zip(xs, w)) / sum(w)


def pctl(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def calib(cal):
    if not cal:
        return None
    w = weights(cal)
    e_w, rel = ece(cal, w)
    e_p, _ = ece(cal, [1.0] * len(cal))
    hi = [(f, wi) for f, wi in zip(cal, w) if f["conf"] >= 0.95]
    return {"benchmarks": len({f["bench"] for f in cal}), "fields": len(cal),
            "acc": wmean([float(f["correct"]) for f in cal], w), "conf": wmean([f["conf"] for f in cal], w),
            "ece": e_w, "ece_pooled": e_p, "brier": wmean([f["brier"] for f in cal], w),
            "share_conf95": wmean([float(f["conf"] >= 0.95) for f in cal], w),
            # board: "the share of answers given with at least 95% confidence that were wrong": the joint share (INDEX_NOTES)
            "over95": wmean([float(f["conf"] >= 0.95 and not f["correct"]) for f in cal], w),
            "wrong_given_conf95": wmean([float(not f["correct"]) for f, _ in hi], [wi for _, wi in hi]) if hi else None,
            "rel": rel}


def summarize(rows, results, reference=None, temperature=None):
    fs = fields(rows, results, temperature)
    all_acc = [f.get("correct", False) for f in fs]
    cal = [f for f in fs if f["answered"] and f["bench"] not in NO_CAL]
    per_bench = collections.defaultdict(list)
    for f in fs:
        per_bench[f["bench"]].append(f)
    req_ms = [r["total_wall_ms"] for r in results.values() if r.get("status") == "ok"]
    q_ms = [f["q_ms"] for f in fs if f["answered"]]
    out = {
        "fields": len(fs), "answered_fields": sum(f["answered"] for f in fs),
        "accuracy_pooled": sum(all_acc) / len(fs) if fs else None,
        "accuracy_bench_weighted": wmean([float(f.get("correct", False)) for f in fs], weights(fs)) if fs else None,
        "calibration": calib(cal),
        # the board's 32-benchmark set predates the 0.2 additions (see INDEX_NOTES): this subset is the comparable one
        "calibration_base": calib([f for f in cal if f["bench"] not in ADDED_02]),
        "latency_ms": {"per_request": {"median": pctl(req_ms, 0.5), "mean": sum(req_ms) / len(req_ms) if req_ms else None, "p80": pctl(req_ms, 0.8), "n": len(req_ms)},
                       "per_question": {"median": pctl(q_ms, 0.5), "mean": sum(q_ms) / len(q_ms) if q_ms else None, "p80": pctl(q_ms, 0.8), "n": len(q_ms)}},
        "per_benchmark": {str(b): {"fields": len(v), "accuracy": sum(f.get("correct", False) for f in v) / len(v),
                                   "answered": sum(f["answered"] for f in v)} for b, v in sorted(per_bench.items())},
        "temperature": temperature,
    }
    if reference is not None:
        rf = {(f["run_id"], f["key"]): f for f in fields(rows, reference) if f["answered"]}
        both = [(f, rf[(f["run_id"], f["key"])]) for f in fs if f["answered"] and (f["run_id"], f["key"]) in rf]
        out["modal_agreement"] = {"fields": len(both), "agreement": sum(a["choice"] == b["choice"] for a, b in both) / len(both) if both else None,
                                  "agreement_bench_weighted": wmean([float(a["choice"] == b["choice"]) for a, b in both], weights([a for a, _ in both])) if both else None}
    return out


def load_results(path):
    res = {}
    for r in read_jsonl(path):
        res[r["run_id"]] = r
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", required=True)
    ap.add_argument("--results", required=True)
    ap.add_argument("--reference")
    ap.add_argument("--temperature", type=float)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    rows = read_jsonl(a.rows)
    ids = {r["_evaluation"]["run_id"] for r in rows}
    res = {k: v for k, v in load_results(a.results).items() if k in ids}
    ref = {k: v for k, v in load_results(a.reference).items() if k in ids} if a.reference else None
    m = summarize(rows, res, ref, a.temperature)
    Path(a.out).write_text(json.dumps(m, indent=1))
    c = m["calibration"]
    print(json.dumps({"acc_pooled": m["accuracy_pooled"], "cal_acc": c["acc"], "ece": c["ece"], "brier": c["brier"],
                      "lat_q_median": m["latency_ms"]["per_question"]["median"], "modal": m.get("modal_agreement")}))


if __name__ == "__main__":
    main()
