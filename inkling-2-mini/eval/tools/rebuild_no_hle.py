#!/usr/bin/env python3
"""Finish the 0.3 suite rebuild when HLE (catalog 45) is missing.

`suite rebuild` skips the 0.2 cut (and so 0.3) unless the 0.1 rows are byte-identical to the lab's, which
cannot happen without the gated HLE source. This runs the same kit steps on the HLE-less 0.1 rows:
release_v2.main (the ToolRet/BRIGHT cut + the seven added benchmarks) and gsm8k_v3.main (0.3 GSM8K).
The added rows and the GSM8K rows contain no HLE, so their sha256 are still checked against the edition's.
Then stage with `suite import --no-verify` and check per-benchmark counts with check_suite_counts().

usage (kit venv): python -I eval/tools/rebuild_no_hle.py WORK_DIR
"""
import json
import sys
from pathlib import Path

from decision_index import editions
from decision_index.suite.build import gsm8k_v3, release_v2
from decision_index.suite.build.layout import Layout
from decision_index.suite.download import hub_file


def main(work):
    layout = Layout(work)
    v1 = layout.suite / "release-v1-rebuilt" / "selected-rows.jsonl"
    assert v1.exists(), v1
    v2 = release_v2.main(layout, v1, hub_file("0.2", "excluded-questions.json"), log=print)
    e3 = editions.get("0.3")
    rows = Path(v2["out"]) / "selected-rows.jsonl.gz"
    gsm = gsm8k_v3.main(layout, rows, log=print)
    gsm["byte_identical"] = gsm["gsm8k_sha256"] == e3["gsm8k_sha256"]
    out = {"release_v2": {k: v for k, v in v2.items() if k != "added" or True}, "gsm8k": gsm}
    print(json.dumps(out, indent=1, default=str))


if __name__ == "__main__":
    main(sys.argv[1])
