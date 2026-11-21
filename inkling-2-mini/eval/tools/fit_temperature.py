#!/usr/bin/env python3
"""Fit one temperature on the calibration split (never on test rows).

Reads the engine's raw per-question code logprobs (InklingEngine raw_output), minimises the
benchmark-weighted negative log-likelihood of the gold option over T (golden-section search on log T),
and refuses to run if any calibration run id is also in the test rows.

usage: python -I eval/tools/fit_temperature.py --calib-rows CALIB --calib-results RES.jsonl --test-rows TEST --out T.json
"""
import argparse
import collections
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from metrics import NO_CAL, gold_key, load_results, read_jsonl  # noqa: E402


def items(rows, results):
    out = []
    for r in rows:
        e = r["_evaluation"]
        res = results.get(e["run_id"])
        if not res or res.get("status") != "ok" or e["catalog_id"] in NO_CAL:
            continue
        for k, q in r["questions"].items():
            g = (r.get("expected") or {}).get(k)
            if g is None or q["type"] not in ("choice", "noul"):
                continue
            gk = gold_key(q, g)
            lp = ((res.get("raw_output") or {}).get(k) or {}).get("code_logprobs")
            if gk is None or not lp or gk not in lp:
                continue
            out.append((e["catalog_id"], lp, gk))
    return out


def nll(its, w, T):
    s = 0.0
    for (b, lp, g), wi in zip(its, w):
        m = max(lp.values())
        z = sum(math.exp((v - m) / T) for v in lp.values())
        s += wi * -((lp[g] - m) / T - math.log(z))
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--calib-rows", required=True)
    ap.add_argument("--calib-results", required=True)
    ap.add_argument("--test-rows", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    calib = read_jsonl(a.calib_rows)
    test_ids = {r["_evaluation"]["run_id"] for r in read_jsonl(a.test_rows)}
    test_groups = {(r["_evaluation"]["catalog_id"], r["_evaluation"]["group_id"]) for r in read_jsonl(a.test_rows)}
    overlap = [r for r in calib if r["_evaluation"]["run_id"] in test_ids or (r["_evaluation"]["catalog_id"], r["_evaluation"]["group_id"]) in test_groups]
    if overlap:
        sys.exit(f"refusing: {len(overlap)} calibration rows overlap the test split")
    res = load_results(a.calib_results)
    its = items(calib, res)
    by = collections.Counter(b for b, _, _ in its)
    w = [1.0 / (by[b] * len(by)) for b, _, _ in its]
    lo, hi = math.log(0.05), math.log(20.0)
    g = (math.sqrt(5) - 1) / 2
    c, d = hi - g * (hi - lo), lo + g * (hi - lo)
    for _ in range(60):
        if nll(its, w, math.exp(c)) < nll(its, w, math.exp(d)):
            hi = d
        else:
            lo = c
        c, d = hi - g * (hi - lo), lo + g * (hi - lo)
    T = math.exp((lo + hi) / 2)
    out = {"temperature": T, "nll_T": nll(its, w, T), "nll_1": nll(its, w, 1.0), "fields": len(its), "benchmarks": len(by),
           "calib_rows": len(calib), "test_overlap": 0}
    Path(a.out).write_text(json.dumps(out, indent=1))
    print(json.dumps(out))


if __name__ == "__main__":
    main()
