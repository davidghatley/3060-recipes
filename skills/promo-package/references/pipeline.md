# Pipeline skeleton

Adapt, do not copy blindly. The point is the shape: one input file, one generated data file, no hand-typed numbers.

## prep.py

```python
"""../promo-data.json -> src/data.json, and copy.md -> out/copy-filled.md.  python3 tools/prep.py"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(HERE), "promo-data.json")

# Facts from someone else's page, with the source. Plates showing these say "reported".
FACTS = {"name": "...", "maker": "...", "src": "<page>, <date read>"}

# target key -> accepted spellings (normalised: lower case, letters and digits only, nested keys joined)
ALIAS = {
    "baseline": ["baseline", "baselinetps", "stock", "before"],
    "tuned":    ["tuned", "tunedtps", "best", "after"],
    "speedup":  ["speedup", "gain", "ratio"],
}
HEADLINE = ["baseline", "tuned"]          # DRAFT until all of these are present

def norm(k): return re.sub(r"[^a-z0-9]", "", k.lower())

def flatten(d, pre=""):
    out = {}
    for k, v in d.items():
        p = f"{pre}_{k}" if pre else k
        if isinstance(v, dict): out.update(flatten(v, p))
        out[norm(p)] = v
    return out

raw = flatten(json.load(open(SRC)))
used, data = set(), {}
for target, names in ALIAS.items():
    hit = next((n for n in names if raw.get(n) is not None), None)
    data[target] = raw.get(hit) if hit else None
    if hit: used.add(hit)
if data.get("speedup") is None and data.get("baseline") and data.get("tuned"):
    data["speedup"] = round(data["tuned"] / data["baseline"], 2)          # derived, never typed
data["missing"] = [k for k in HEADLINE if data.get(k) is None]
data["status"] = "DRAFT" if data["missing"] else "MEASURED"
data["facts"] = FACTS
json.dump(data, open(os.path.join(HERE, "src", "data.json"), "w"), indent=1)

copy = open(os.path.join(HERE, "copy.md")).read()
def fill(m):
    v = data.get(m.group(1))
    return str(v) if v is not None else m.group(0)                          # unfilled tokens stay visible
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
open(os.path.join(HERE, "out", "copy-filled.md"), "w").write(re.sub(r"\{\{(\w+)\}\}", fill, copy))

print("status:", data["status"], "| placeholders:", ", ".join(data["missing"]) or "none")
print("unused keys:", ", ".join(sorted(set(raw) - used)) or "none")
```

In components, format through one helper so a null can never print as `null`, `NaN` or `0`:

```ts
export const show = (v: number | null | undefined, digits = 1) => (v == null ? "—" : v.toFixed(digits));
```

## render.sh

```sh
#!/usr/bin/env bash
#   ./render.sh          everything      ./render.sh stills    stills only
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
R=(--public-dir=public --gl=swangle --log=error)        # add --browser-executable=<chromium> if Remotion's download is unwanted
REM="nice -n 19 node_modules/.bin/remotion"
python3 tools/prep.py
mkdir -p out/stills out/video
for id in HeaderLight HeaderDark SocialLight SocialDark SquareLight SquareDark; do
  $REM still src/index.ts $id "out/stills/$id.png" "${R[@]}"
done
[ "${1:-all}" = stills ] && exit 0
for comp in MainLight:light-16x9 MainDark:dark-16x9 MainLightV:light-9x16 MainDarkV:dark-9x16; do
  id=${comp%%:*}; tag=${comp#*:}
  $REM render src/index.ts $id "out/video/promo-$tag.mp4" "${R[@]}" --concurrency=4 --codec=h264 --crf=18 --pixel-format=yuv420p
  ffmpeg -loglevel error -y -i "out/video/promo-$tag.mp4" -i public/audio/bed.m4a -map 0:v -map 1:a \
    -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest "out/video/promo-$tag-music.mp4"
done
# one frame per plate, taken from timeline.json, for the frame check
for f in $(python3 -c "import json;print(*[b['check_frame'] for b in json.load(open('src/timeline.json'))['plates']])"); do
  $REM still src/index.ts MainLight "out/stills/frame-$f.png" --frame=$f "${R[@]}"
done
```

## Timeline

Keep every beat as a named timestamp in `src/timeline.json` and have scenes, the frame check and any sound
cues read it. Retiming to fit a music bed is then one file's edit.

## Counting post length

```python
import re
def x_len(s):                                   # X counts any URL as 23
    return len(re.sub(r"https?://\S+|\b[\w.-]+\.(?:com|org|io|co|ai|dev)/\S*", "x" * 23, s))
```
