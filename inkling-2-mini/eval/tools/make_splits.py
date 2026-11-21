#!/usr/bin/env python3
"""Test and calibration splits of the 0.3 public suite, disjoint by case group.

Order inside each benchmark is the kit's own sampler order (suite/sample.py, seed 20260919):
sha256("20260919:<catalog_id>:<group_id>"). Only the 37 benchmarks of the 0.3 public index are used.
- test:  the first K groups of every benchmark (what is the same as the kit's `suite sample` restricted to the panel);
- calib: the next M groups (temperature fitting only; never scored as test).
Groups are whole linked cases, so ToolRet/BRIGHT queries, ACOS reviews and RouterBench tracks stay intact.
A per-benchmark token cap (--max-group-tokens, by `proxy_tokens`) is reported, not applied, unless --cap is given.

usage (kit venv): python -I eval/tools/make_splits.py --suite-dir DIR --k 40 --m 15 --out-dir eval-splits/
"""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path

from decision_index.scoring import index02
from decision_index.suite.io import Suite, dumps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--suite-dir", required=True)
    ap.add_argument("--edition", default="0.3")
    ap.add_argument("--k", type=int, default=40)
    ap.add_argument("--m", type=int, default=15)
    ap.add_argument("--seed", type=int, default=20260919)
    ap.add_argument("--k-override", default="{}", help='JSON {catalog_id: k} for expensive benchmarks')
    ap.add_argument("--out-dir", required=True)
    a = ap.parse_args()
    spec = index02.spec(a.edition)
    panel = sorted({int(n) for area in spec["areas"] for n in area["benchmarks"]})
    suite = Suite(a.suite_dir, a.edition)
    groups = collections.defaultdict(list)
    for r in suite.rows(apply_exclusions=True):
        e = r["_evaluation"]
        groups[(e["catalog_id"], e["group_id"])].append(r)
    by_b = collections.defaultdict(list)
    for key, rows in groups.items():
        by_b[key[0]].append(rows)
    k_over = {int(k): v for k, v in json.loads(a.k_override).items()}
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    stats = {}
    with gzip.open(out / "test.jsonl.gz", "wt") as ft, gzip.open(out / "calib.jsonl.gz", "wt") as fc:
        for b in panel:
            if b not in by_b:
                stats[b] = {"missing": True}
                continue
            ranked = sorted(by_b[b], key=lambda rows: hashlib.sha256(f"{a.seed}:{b}:{rows[0]['_evaluation']['group_id']}".encode()).hexdigest())
            k = k_over.get(b, a.k)
            m = max(1, round(a.m * k / a.k)) if b in k_over else a.m
            test, calib = ranked[:k], ranked[k:k + m]
            for g in test:
                for r in g:
                    ft.write(dumps(r) + "\n")
            for g in calib:
                for r in g:
                    fc.write(dumps(r) + "\n")
            tok = lambda gs: sum(r["_evaluation"].get("proxy_tokens") or 0 for g in gs for r in g)
            stats[b] = {"groups_total": len(ranked), "test_groups": len(test), "test_requests": sum(map(len, test)),
                        "test_proxy_tokens": tok(test), "calib_groups": len(calib), "calib_requests": sum(map(len, calib)),
                        "calib_proxy_tokens": tok(calib),
                        "test_questions": sum(len(r["questions"]) for g in test for r in g)}
    tot = {k: sum(s.get(k, 0) for s in stats.values()) for k in ("test_requests", "test_proxy_tokens", "calib_requests", "calib_proxy_tokens", "test_questions")}
    (out / "splits.json").write_text(json.dumps({"seed": a.seed, "k": a.k, "m": a.m, "k_override": k_over, "panel": panel, "benchmarks": stats, "total": tot}, indent=1))
    print(json.dumps(tot))
    for b, s in stats.items():
        print(b, s)


if __name__ == "__main__":
    main()
