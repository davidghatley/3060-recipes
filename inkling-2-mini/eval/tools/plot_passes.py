#!/usr/bin/env python3
"""Plot accuracy, sample index and ECE against loop passes.

usage: python -I eval/tools/plot_passes.py OUT.png PASSES:METRICS.json:SCORES_DIR [...]
The model was trained at 3 passes; every other count is drawn hollow and labelled out of distribution.
"""
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

TRAINED = 3


def main(out, specs):
    pts = []
    for s in specs:
        n, m, d = s.split(":")
        m = json.loads(Path(m).read_text())
        sc = json.loads((Path(d) / "scores.json").read_text())
        boot = json.loads((Path(d) / "bootstrap.json").read_text()) if (Path(d) / "bootstrap.json").exists() else None
        pts.append({"n": int(n), "acc": m["accuracy_bench_weighted"], "ece": m["calibration"]["ece"], "index": sc["decision_index"],
                    "ci": boot["ci95"]["index"] if boot else None})
    pts.sort(key=lambda p: p["n"])
    ink, grey = "#2f5d8a", "#9a9a9a"
    fig, axes = plt.subplots(1, 3, figsize=(11, 3.4), constrained_layout=True)
    for ax, key, label in zip(axes, ("acc", "index", "ece"), ("Accuracy (benchmark-weighted)", "Public index on the sample (0.3, chance-corrected)", "ECE (10 bins, benchmark-weighted)")):
        xs = [p["n"] for p in pts]
        ys = [p[key] for p in pts]
        ax.plot(xs, ys, color=ink, lw=1.5, zorder=1)
        for p in pts:
            trained = p["n"] == TRAINED
            if key == "index" and p["ci"]:
                ax.vlines(p["n"], p["ci"][0], p["ci"][1], color=ink if trained else grey, lw=1)
            ax.scatter([p["n"]], [p[key]], s=46, zorder=2, facecolor=ink if trained else "white", edgecolor=ink)
        ax.set_xticks(xs)
        ax.set_xticklabels([f"{x}\n(trained)" if x == TRAINED else f"{x}\n(OOD)" for x in xs])
        ax.set_xlabel("loop-core passes (layers 6–17)")
        ax.set_title(label, fontsize=9.5)
        ax.grid(axis="y", color="#e5e5e5", lw=0.8)
        for sp in ("top", "right"):
            ax.spines[sp].set_visible(False)
    fig.suptitle("Inkling 2 Mini, zero-shot logit readout, by loop passes (hollow = out of distribution)", fontsize=10)
    fig.savefig(out, dpi=160)
    print(json.dumps(pts))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
