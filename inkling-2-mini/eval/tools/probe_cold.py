#!/usr/bin/env python3
"""Cold (cache_prompt=false) biased readout for the items of an earlier check_readout output, same prompts.
Output has the check_readout item shape (run_id, p_cold), so compare_readouts.py works on it.

usage: python -I eval/tools/probe_cold.py ROWS.jsonl[.gz] REF.json OUT.json --label L [--base-url URL]
"""
import argparse
import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engines.inkling import ANSWER_PREFIX, InklingEngine, question_body  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rows")
    ap.add_argument("ref")
    ap.add_argument("out")
    ap.add_argument("--label", default="")
    ap.add_argument("--base-url", default="http://127.0.0.1:8085")
    a = ap.parse_args()
    want = [x["run_id"] for x in json.load(open(a.ref))["items"]]
    rows = {}
    op = gzip.open if a.rows.endswith(".gz") else open
    with op(a.rows, "rt") as f:
        for line in f:
            r = json.loads(line)
            if r["_evaluation"]["run_id"] in want:
                rows[r["_evaluation"]["run_id"]] = r
    eng = InklingEngine(base_url=a.base_url, cache=False)
    items = []
    for rid in want:
        r = rows[rid]
        k, q = next(iter(r["questions"].items()))
        body, keys, codes = question_body(q)
        prompt = eng._template(eng._messages(r["state"], body)) + ANSWER_PREFIX
        cid = [eng.code_ids[c] for c in codes]
        res = eng._post("/completion", {"prompt": prompt, "n_predict": 1, "samplers": ["temperature"], "temperature": 1.0, "top_k": 0,
                                        "top_p": 1.0, "min_p": 0.0, "cache_prompt": False, "n_probs": len(codes), "post_sampling_probs": True,
                                        "logit_bias": [[i, 100.0] for i in cid]})
        bc = {t["id"]: t["prob"] for t in res["completion_probabilities"][0]["top_probs"]}
        z = sum(bc[i] for i in cid)
        p = [bc[i] / z for i in cid]
        items.append({"bench": r["_evaluation"]["catalog_id"], "run_id": rid, "p_cold": p, "any_nan": any(x != x for x in p),
                      "prompt_n": res.get("timings", {}).get("prompt_n")})
    Path(a.out).write_text(json.dumps({"label": a.label, "items": items}, indent=1))
    print(a.label, len(items), "items")


if __name__ == "__main__":
    main()
