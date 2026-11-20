"""Score an eval run: generation outcome + headless render results -> per-item table and summary.

    <venv>/bin/python -I tools/score.py runs/eval-<name>      (needs Pillow)

Per item:
  finished  finish_reason == "stop" (not truncated at max_tokens)
  html      an HTML page could be extracted
  throws    an uncaught exception or unhandled rejection while loading/running (first 6 s)
  webgl     a WebGL context was created
  drawn     the largest canvas in the t=6 s screenshot is not blank: >= 2% of its pixels differ from the
            dominant colour by > 24 (L1 over RGB/3), on a 4x-downsampled crop
  animated  the t=3 s and t=6 s screenshots differ in >= 0.2% of canvas pixels
  pass      finished and html and not throws and webgl and drawn
Writes <run>/score.json and prints a summary line.
"""
import json, sys
from collections import Counter
from pathlib import Path

from PIL import Image, ImageChops

run = Path(sys.argv[1])
rend = run / "render"


def crop(img, rect):
    if rect and rect[2] >= 16 and rect[3] >= 16:
        x, y, w, h = rect
        box = (max(0, int(x)), max(0, int(y)), min(img.width, int(x + w)), min(img.height, int(y + h)))
        if box[2] - box[0] >= 16 and box[3] - box[1] >= 16:
            img = img.crop(box)
    return img.convert("RGB").resize((max(1, img.width // 4), max(1, img.height // 4)))


def nonblank_frac(img):
    px = list(img.get_flattened_data())
    mode = Counter((r // 8, g // 8, b // 8) for r, g, b in px).most_common(1)[0][0]
    mr, mg, mb = (c * 8 + 4 for c in mode)
    return sum((abs(r - mr) + abs(g - mg) + abs(b - mb)) / 3 > 24 for r, g, b in px) / len(px)


rows = []
for gj in sorted(run.glob("scene-*.json")):
    g = json.loads(gj.read_text())
    r = {"id": g["id"], "level": g["level"], "finished": g["finish_reason"] == "stop", "html": g["html_found"],
         "tokens": (g.get("timings") or {}).get("predicted_n"), "throws": None, "webgl": None,
         "drawn": None, "animated": None, "nonblank": None}
    rj = rend / f"{g['id']}.json"
    if g["html_found"] and rj.exists():
        rr = json.loads(rj.read_text())
        r["throws"] = bool(rr.get("exceptions") or rr.get("errors") or rr.get("rejections"))
        r["first_error"] = (rr.get("exceptions") or rr.get("errors") or rr.get("rejections") or [None])[0]
        r["webgl"] = (rr.get("webgl") or 0) > 0
        a, b = rend / f"{g['id']}.a.png", rend / f"{g['id']}.b.png"
        if a.exists() and b.exists():
            ia, ib = crop(Image.open(a), rr.get("canvas")), crop(Image.open(b), rr.get("canvas"))
            r["nonblank"] = round(nonblank_frac(ib), 4)
            r["drawn"] = r["nonblank"] >= 0.02
            diff = ImageChops.difference(ia, ib).convert("L").point(lambda v: 255 if v > 8 else 0)
            r["animated"] = sum(1 for v in diff.get_flattened_data() if v) / (diff.width * diff.height) >= 0.002
    r["pass"] = bool(r["finished"] and r["html"] and r["throws"] is False and r["webgl"] and r["drawn"])
    rows.append(r)

n = len(rows)
summ = {k: sum(1 for r in rows if r.get(k)) for k in ("finished", "html", "throws", "webgl", "drawn", "animated", "pass")}
summ["n"] = n
(run / "score.json").write_text(json.dumps({"summary": summ, "items": rows}, indent=1))
print(run.name, json.dumps(summ))
for r in rows:
    if not r["pass"]:
        print("  FAIL", r["id"], f"L{r['level']}", {k: r.get(k) for k in ("finished", "html", "throws", "webgl", "drawn", "first_error")})
