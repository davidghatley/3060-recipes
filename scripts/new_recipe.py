#!/usr/bin/env python3
"""Scaffold a new recipe folder.

    python3 scripts/new_recipe.py community/<recipe-id>     # someone else's 3060
    python3 scripts/new_recipe.py <recipe-id>               # maintainer recipe at the repo root

Writes README.md, RESULTS.md, recipe.json, serve.sh and runs/. Never overwrites an existing file.
"""
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

README = """# {title}

<!-- One paragraph: what model, what it is good at, and why it is hard on a 12 GB card. -->

## Result

| | Stock flags | This recipe |
|---|---|---|
| Decode, empty context | ? tok/s | ? tok/s |
| Decode at ?k context | ? tok/s | ? tok/s |
| Prefill, ~8k prompt | ? tok/s | ? tok/s |
| VRAM peak | | ? GB |

Measured on: RTX 3060 12 GB, ? GB RAM, <CPU>, <disk>. Details and raw runs: [RESULTS.md](RESULTS.md).

## Use it

```sh
./serve.sh
```

<!-- Exact weights file and revision, engine build, and what each important flag does. -->

## Credits

- Model: <authors, link>
- Weights file: <quantizer, link>
- Engine and patches: <project, PR numbers, links>
"""

RESULTS = """# {title}: results

- Hardware: NVIDIA GeForce RTX 3060 12 GB (driver ?, CUDA ?), ? GB RAM, <CPU>, <disk>
- Model: <hf owner/name> @ <revision>, file <name> (<size> GB, sha256 <...>)
- Engine: <repo> @ <commit or build>, patches: <none | PR numbers>
- Date: {date}

## Verdict

<!-- One or two sentences. -->

## Speed

| Metric | Conditions | Stock | Tuned | Samples |
|---|---|---|---|---|
| Decode | empty context | | | |
| Decode | ?k context | | | |
| Prefill | ~8k prompt | | | |
| Prefill | ~?k prompt | | | |
| Time to first token | ~8k prompt | | | |

## Memory

| | Peak |
|---|---|
| VRAM | |
| RAM (including page cache) | |

## Quality

- Needles at ~50% and ~95% of the window: ?/3, ?/3
- Code eval or KLD: <result, or "not measured">

## What was tried

| Change | Result | Kept? |
|---|---|---|

## Not measured yet
"""

SERVE = """#!/usr/bin/env bash
# Serve {title}. Every knob has an environment override; the defaults are the measured recipe.
set -euo pipefail
MODEL=${{MODEL:?set MODEL to the path of the weights file}}
PORT=${{PORT:-8080}}
CTX=${{CTX:-32768}}
SERVER=${{SERVER:-llama-server}}
exec "$SERVER" -m "$MODEL" --host 127.0.0.1 --port "$PORT" -c "$CTX" \\
  -ngl 99 --flash-attn on \\
  ${{EXTRA:-}}
"""


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    rel = sys.argv[1].strip("/")
    rid = Path(rel).name
    if not re.match(r"^[a-z0-9][a-z0-9-]*$", rid):
        print(f"recipe id '{rid}' must be lowercase letters, digits and hyphens")
        return 2
    d = ROOT / rel
    d.mkdir(parents=True, exist_ok=True)
    (d / "runs").mkdir(exist_ok=True)
    (d / "runs/.gitkeep").touch()
    title = rid.replace("-", " ").title()
    date = datetime.date.today().isoformat()
    recipe = {
        "id": rid, "title": title, "summary": "TODO: what runs, how, and the headline speed, in one or two sentences.",
        "status": "draft", "updated": date, "use_cases": [],
        "model": {"name": "TODO", "hf_repo": "owner/name", "params": "TODO", "architecture": "dense | MoE"},
        "weights": {"format": "GGUF", "quant": "TODO", "source": "https://huggingface.co/owner/name-GGUF", "file": "TODO.gguf", "revision": "TODO"},
        "engine": {"name": "llama.cpp", "repo": "https://github.com/ggml-org/llama.cpp", "version": "TODO build or commit", "patches": []},
        "hardware": {"gpu": "NVIDIA GeForce RTX 3060", "vram_gb": 12, "ram_gb": 0, "cpu": "TODO", "disk": "NVMe SSD"},
        "serve": {"command": "MODEL=/path/to/file.gguf ./serve.sh", "script": "serve.sh", "port": 8080, "api": "OpenAI-compatible /v1", "key_flags": []},
        "context_tokens": 32768,
        "placement": "TODO: what is in VRAM, what is in RAM, what streams from disk.",
        "results": [{"metric": "decode", "label": "empty context", "value": 0, "unit": "tok/s", "headline": True, "source": f"{rel}/RESULTS.md:20"}],
        "caveats": [], "credits": [], "findings": [],
        "contributor": {"name": "TODO", "github": "TODO"},
    }
    files = {"README.md": README.format(title=title), "RESULTS.md": RESULTS.format(title=title, date=date),
             "serve.sh": SERVE.format(title=title), "recipe.json": json.dumps(recipe, indent=2) + "\n"}
    for name, text in files.items():
        p = d / name
        if p.exists():
            print(f"kept   {p.relative_to(ROOT)} (already exists)")
            continue
        p.write_text(text)
        if name == "serve.sh":
            p.chmod(0o755)
        print(f"wrote  {p.relative_to(ROOT)}")
    print(f"\nNext: measure, fill the files, then  python3 scripts/validate_recipe.py {rel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
