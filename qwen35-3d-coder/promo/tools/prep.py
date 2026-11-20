"""Turn timed captures + build sequences into race data for the Remotion video.
  python3 -I tools/prep.py <slug> [baseline_name] [tuned_name]   (default names baseline, tuned; reads captures/<slug>/{baseline,tuned}.json and public/frames/<slug>/<cfg>/meta.json)
Writes src/race.json. Every mesh appears at the moment the token stream finished the deepest page line it needs."""
import json, sys, os, bisect
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
slug = sys.argv[1]
NAMES = {"baseline": (sys.argv[2:3] or ["baseline"])[0], "tuned": (sys.argv[3:4] or ["tuned"])[0]}
DT = 0.1
out = {"slug": slug, "sides": {}}
for cfg in ("baseline", "tuned"):
    nm = NAMES[cfg]
    d = json.load(open(f"{ROOT}/captures/{slug}/{nm}.json"))
    meta = json.load(open(f"{ROOT}/public/frames/{slug}/{nm}/meta.json"))
    content, reasoning = d["content"], d["reasoning"]
    a = content.index("```html"); hs = content.index("\n", a) + 1; he = content.index("```", hs)
    html = content[hs:he]
    page = open(f"{ROOT}/captures/{slug}/{nm}.html").read()
    assert html.strip() == page.strip(), f"{cfg}: page != fenced html"
    ends, pos = [], 0
    for line in html.split("\n"):
        pos += len(line) + 1; ends.append(pos)
    # cumulative series from chunks
    ts, cc, rc, nt = [], [], [], []
    c = r = 0
    for ch in d["chunks"]:
        c += len(ch.get("content_delta") or ""); r += len(ch.get("reasoning_delta") or "")
        ts.append(ch["t"]); cc.append(c); rc.append(r); nt.append(ch.get("n_tokens") or 0)
    def t_at_content(x):
        i = bisect.bisect_left(cc, x); return ts[min(i, len(ts) - 1)]
    mesh_t = [t_at_content(hs + ends[min(L, len(ends)) - 1]) if L > 0 else d["first_content_t"] for L in meta["lines"]]
    total = d["total_s"]
    series = []
    k = 0
    for i in range(int(total / DT) + 2):
        t = i * DT
        k = bisect.bisect_right(ts, t)
        j = max(k - 1, 0)
        series.append([round(t, 2), nt[j] if k else 0, cc[j] if k else 0, rc[j] if k else 0])
    out["sides"][cfg] = {
        "label": d["config"], "dir": f"frames/{slug}/{nm}", "seed": d["sampling"]["seed"], "user": d["user"], "title": d["title"], "total_s": total,
        "first_content_t": d["first_content_t"], "reasoning_s": d["reasoning_s"], "content_s": d["content_s"],
        "tokens": d["timings"]["predicted_n"], "tps": round(d["timings"]["predicted_per_second"], 1),
        "html_start": hs, "content": content, "reasoning": reasoning,
        "levels": meta["levels"], "mesh_t": [round(x, 2) for x in mesh_t], "n_mesh": meta["n"],
        "dt": DT, "series": series,
    }
    print(cfg, f"total {total:.0f}s tokens {out['sides'][cfg]['tokens']} tps {out['sides'][cfg]['tps']} meshes {meta['n']} first mesh {min(mesh_t):.0f}s last {max(mesh_t):.0f}s")
json.dump(out, open(f"{ROOT}/src/race.json", "w"))
