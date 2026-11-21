#!/usr/bin/env python3
"""Run the decision-index kit CLI with eval/ importable, so --engine engines.inkling:InklingEngine works.

usage (kit venv): python -I eval/run_kit.py run --engine engines.inkling:InklingEngine --rows ROWS --out DIR [--option k=v ...]
Everything after the script name goes to `python -m decision_index`.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decision_index.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.argv = ["decision_index"] + sys.argv[1:]
    sys.exit(main())
