#!/usr/bin/env python3
"""Extract the board's published numbers for the entrants we compare against.

Reads the Space's data/index.json (a local clone of multimodalart/jev-decision-index, pinned by commit)
and writes eval/published.json. Every published number in REPORT.md comes from this file.

usage: python -I eval/tools/published.py SPACE_DIR OUT.json
"""
import json
import subprocess
import sys
from pathlib import Path

CONTROLS = ["decider-2b-fp8-http", "kev-4b-r10", "decider-4b"]
TOP_N = 6  # top open-weight reproductions by Full score (v03 'v')


def main(space, out):
    space = Path(space)
    d = json.loads((space / "data" / "index.json").read_text())
    commit = subprocess.run(["git", "-C", str(space), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()

    def entry(m):
        v = m.get("v03") or {}
        return {
            "engine": m["engine"], "name": m["name"],
            "model_url": (m.get("meta") or {}).get("model_url"),
            "base_model": (m.get("meta") or {}).get("base_model"),
            "kind": (m.get("meta") or {}).get("kind"),
            "public_index": v.get("pub"), "same_skills": v.get("same_skills"), "new_domains": v.get("new_domains"),
            "full": v.get("v"), "rank_full": v.get("rank_v"),
            "calibration": {k: (m.get("calibration") or {}).get(k) for k in ("acc", "conf", "ece", "brier", "over95", "n", "benchmarks")},
            "latency_ms": m.get("latency"),
            "results": {k: {"score": r.get("score"), "metric": r.get("metric"), "requests": r.get("requests")} for k, r in (m.get("results") or {}).items()},
        }

    models = d["models"]
    open_w = [m for m in models if (m.get("meta") or {}).get("model_url") and (m.get("v03") or {}).get("v") is not None]
    open_w.sort(key=lambda m: -m["v03"]["v"])
    top = [entry(m) for m in open_w[:TOP_N]]
    controls = [entry(m) for m in models if m["engine"] in CONTROLS]
    jev = d["jev"]
    res = {
        "source": "huggingface.co/spaces/multimodalart/jev-decision-index data/index.json",
        "space_commit": commit,
        "generated_utc": d.get("generated_utc"),
        "calibration_note": d["suite"].get("calibration_note"),
        "benchmarks": {k: {"dataset": b["dataset"], "metric": b["metric"], "group": b.get("group"), "gold": b.get("gold"),
                           "chance": (b.get("baseline") or {}).get("value")} for k, b in d["benchmarks"].items()},
        "panel": {c["id"]: c["panel"] for c in d["categories"]},
        "jev": {"name": jev.get("name"), "version": jev.get("version"), "calibration": {k: jev["calibration"].get(k) for k in ("acc", "conf", "ece", "brier", "over95", "n")},
                "latency_ms": jev.get("latency"), "v03": jev.get("v03")},
        "controls": controls,
        "top_open": top,
    }
    Path(out).write_text(json.dumps(res, indent=1))
    for e in controls + top:
        print(f"{e['engine']:40s} pub {e['public_index']}  full {e['full']}  ece {e['calibration']['ece']}  {e['model_url']}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
