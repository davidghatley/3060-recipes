#!/usr/bin/env python3
"""Score a run over a sample of the suite with the kit's own 0.3 scorer, plus bootstrap intervals.

The kit scores a run against every row of the edition and counts missing rows as wrong, so a sampled run
would score near zero. Here the Suite is restricted to the sampled run ids (SampleSuite.rows), and then
decision_index.pipeline.score_run_v02 runs unchanged: same metrics, chance levels, weights and index.

Bootstrap: B replicates; in each, the case groups of every benchmark are resampled with replacement
(duplicates get fresh run/group ids so linked-case scoring stays intact) and the run is re-scored.
Reports the 2.5/97.5 percentiles of the index and of every benchmark's raw score and skill.

usage (kit venv): python -I eval/tools/score_sample.py --suite-dir DIR --rows SAMPLE.jsonl.gz --results RESULTS.jsonl --out DIR [--boot 200]
"""
import argparse
import collections
import copy
import gzip
import json
import random
import sys
import tempfile
from pathlib import Path

from decision_index.pipeline import score_run_v02
from decision_index.scoring.report import load_results
from decision_index.suite.io import Suite


def read_rows(path):
    op = gzip.open if str(path).endswith(".gz") else open
    with op(path, "rt") as f:
        return [json.loads(x) for x in f]


class SampleSuite(Suite):
    """A Suite whose rows() yields only the given rows (already edition-filtered and exclusion-applied)."""

    def __init__(self, directory, edition, rows):
        super().__init__(directory, edition)
        self._rows = rows

    def rows(self, apply_exclusions=False):
        excluded = self.excluded() if apply_exclusions else set()
        for r in self._rows:
            if r["_evaluation"]["run_id"] not in excluded:
                yield r


def score(suite_dir, edition, rows, results, out):
    s = SampleSuite(suite_dir, edition, rows)
    allowed = {r["_evaluation"]["run_id"] for r in s.rows(apply_exclusions=True)}
    return score_run_v02(s, {k: v for k, v in results.items() if k in allowed}, "sample", Path(out))


def replicate(rows, results, rng):
    groups = collections.defaultdict(list)
    for r in rows:
        e = r["_evaluation"]
        groups[(e["catalog_id"], e["group_id"])].append(r)
    by_bench = collections.defaultdict(list)
    for key, g in groups.items():
        by_bench[key[0]].append(g)
    out_rows, out_res = [], {}
    for b, gs in by_bench.items():
        for j in range(len(gs)):
            g = rng.choice(gs)
            for r in g:
                rid = r["_evaluation"]["run_id"]
                nr = copy.copy(r)
                ne = dict(r["_evaluation"])
                ne["run_id"] = f"{rid}#b{j}"
                ne["group_id"] = f"{ne['group_id']}#b{j}"
                nr["_evaluation"] = ne
                out_rows.append(nr)
                if rid in results:
                    rr = dict(results[rid])
                    rr["run_id"] = ne["run_id"]
                    rr["group_id"] = ne["group_id"]
                    out_res[ne["run_id"]] = rr
    return out_rows, out_res


def pct(xs, q):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    i = min(len(xs) - 1, max(0, round(q * (len(xs) - 1))))
    return xs[i]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--suite-dir", required=True)
    ap.add_argument("--edition", default="0.3")
    ap.add_argument("--rows", required=True)
    ap.add_argument("--results", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--boot", type=int, default=200)
    ap.add_argument("--seed", type=int, default=20261121)
    a = ap.parse_args()
    rows = read_rows(a.rows)
    results = load_results(a.results)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    point = score(a.suite_dir, a.edition, rows, results, out)
    boots = []
    if a.boot:
        rng = random.Random(a.seed)
        # exclusions are already applied to the sample; drop excluded ids before resampling
        base = SampleSuite(a.suite_dir, a.edition, rows)
        kept = list(base.rows(apply_exclusions=True))
        with tempfile.TemporaryDirectory() as td:
            for i in range(a.boot):
                br, bres = replicate(kept, results, rng)
                s = score(a.suite_dir, a.edition, br, bres, td)
                boots.append({"index": s["decision_index"],
                              "benchmarks": {k: (v.get("index_raw"), v.get("index_skill")) for k, v in s["benchmarks"].items()}})
                if (i + 1) % 20 == 0:
                    print(f"bootstrap {i + 1}/{a.boot}", file=sys.stderr, flush=True)
    ci = {"index": [pct([b["index"] for b in boots], 0.025), pct([b["index"] for b in boots], 0.975)] if boots else None, "benchmarks": {}}
    for k in point["benchmarks"]:
        raws = [b["benchmarks"].get(k, (None, None))[0] for b in boots]
        sks = [b["benchmarks"].get(k, (None, None))[1] for b in boots]
        ci["benchmarks"][k] = {"raw": [pct(raws, 0.025), pct(raws, 0.975)], "skill": [pct(sks, 0.025), pct(sks, 0.975)]}
    (out / "bootstrap.json").write_text(json.dumps({"replicates": len(boots), "seed": a.seed, "ci95": ci}, indent=1))
    print(json.dumps({"index": point["decision_index"], "ci95": ci["index"], "counts": point["counts"], "completed": point["completed"]}))


if __name__ == "__main__":
    main()
