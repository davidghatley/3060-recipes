#!/usr/bin/env python3
"""Check the Inkling readout before trusting it.

1. Code tokens: every code A-Z, a-z, 1..255 is one token with a distinct id (done in InklingEngine.__init__).
2. Top-N coverage: with plain n_probs=N (no bias), how often are all option codes in the top N?
3. Bias exactness: for prompts where the plain top-200 does cover every code, the +100-bias readout
   renormalised over the codes must equal the plain one renormalised over the codes.
4. Cache exactness: the same question read after a prime (checkpoint restore) and cold (cache_prompt=false).

usage: python -I eval/tools/check_readout.py ROWS.jsonl[.gz] OUT.json [--n 40] [--max-tokens 1500] [--base-url URL] [--label L]
   compare builds: eval/tools/compare_readouts.py A.json B.json (p_cold per item, same rows in the same order)
"""
import argparse
import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engines.inkling import ANSWER_PREFIX, InklingEngine, question_body  # noqa: E402


def rows(path):
    op = gzip.open if str(path).endswith(".gz") else open
    with op(path, "rt") as f:
        for line in f:
            yield json.loads(line)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rows")
    ap.add_argument("out")
    ap.add_argument("--n", type=int, default=40)
    ap.add_argument("--base-url", default="http://127.0.0.1:8085")
    ap.add_argument("--max-tokens", type=int, default=1500)
    ap.add_argument("--label", default="")
    a = ap.parse_args()
    eng = InklingEngine(base_url=a.base_url)
    res = {"label": a.label, "codes_single_token": True, "n_codes": len(eng.code_ids), "items": []}
    seen = set()
    for r in rows(a.rows):
        if len(res["items"]) >= a.n:
            break
        bench = r["_evaluation"]["catalog_id"]
        if bench in seen and len(seen) < 30:
            continue
        seen.add(bench)
        k, q = next(iter(r["questions"].items()))
        body, keys, codes = question_body(q)
        prompt = eng._template(eng._messages(r["state"], body)) + ANSWER_PREFIX
        if len(eng._post("/tokenize", {"content": prompt})["tokens"]) > a.max_tokens:
            continue
        base = {"prompt": prompt, "n_predict": 1, "samplers": ["temperature"], "temperature": 1.0, "top_k": 0, "top_p": 1.0, "min_p": 0.0}
        plain = eng._post("/completion", dict(base, cache_prompt=False, n_probs=200))["completion_probabilities"][0]["top_logprobs"]
        plain_ids = {t["id"]: t["logprob"] for t in plain}
        cid = [eng.code_ids[c] for c in codes]
        covered_n = {N: all(i in {t["id"] for t in plain[:N]} for i in cid) for N in (len(codes), 20, 52, 100, 200)}
        biased_cold = eng._post("/completion", dict(base, cache_prompt=False, n_probs=len(codes), post_sampling_probs=True,
                                                    logit_bias=[[i, 100.0] for i in cid]))["completion_probabilities"][0]["top_probs"]
        bc = {t["id"]: t["prob"] for t in biased_cold}
        zb = sum(bc[i] for i in cid)
        pb = [bc[i] / zb for i in cid]
        item = {"bench": bench, "run_id": r["_evaluation"]["run_id"], "n_options": len(codes), "covered_topN": covered_n, "p_cold": pb, "any_nan": any(x != x for x in pb)}
        if covered_n[200]:
            import math
            ex = [math.exp(plain_ids[i]) for i in cid]
            zp = sum(ex)
            item["bias_vs_plain_maxabs"] = max(abs(x / zp - y) for x, y in zip(ex, pb))
        # cached path: the engine's own call (prime + checkpoint restore), first question only
        resp, raw = InklingEngine.__call__(eng, r["state"], {k: q})
        a_ = resp["answers"][k]
        pc = [a_["probabilities"][key] for key in keys] if q["type"] == "choice" else [1 - a_["noul"], a_["noul"]]
        item["cached_vs_cold_maxabs"] = max(abs(x - y) for x, y in zip(pc, pb))
        item["cached_prompt_n"] = raw[k]["prompt_n"]
        item["cached_cache_n"] = raw[k]["cache_n"]
        res["items"].append(item)
        print(json.dumps(item), flush=True)
    it = res["items"]
    res["summary"] = {
        "items": len(it),
        "all_codes_in_top20": sum(x["covered_topN"][20] for x in it),
        "all_codes_in_top200": sum(x["covered_topN"][200] for x in it),
        "bias_vs_plain_maxabs": max((x["bias_vs_plain_maxabs"] for x in it if "bias_vs_plain_maxabs" in x), default=None),
        "bias_checked_items": sum("bias_vs_plain_maxabs" in x for x in it),
        "cached_vs_cold_maxabs": max(x["cached_vs_cold_maxabs"] for x in it),
        "cached_vs_cold_mean": sum(x["cached_vs_cold_maxabs"] for x in it) / max(1, len(it)),
    }
    print(json.dumps(res["summary"], indent=1))
    Path(a.out).write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
