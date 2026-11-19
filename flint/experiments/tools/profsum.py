"""Median per-token breakdown from [FLINT-PROF] PROF lines (decode graphs only: splits>=60)."""
import sys, re, statistics as st
for f in sys.argv[1:]:
    rows = []
    for l in open(f, errors="replace"):
        if not l.startswith("PROF "): continue
        d = dict((k, int(v)) for k, v in re.findall(r"(\w+)=(\d+)", l.replace("gpu:", "").replace("cpu:", "")))
        g = re.search(r"gpu:.*?copy_us=(\d+) comp_us=(\d+)", l); c = re.search(r"cpu:.*?copy_us=(\d+) comp_us=(\d+)", l)
        if d.get("splits", 0) >= 60 and g and c: rows.append((d["total_us"], *map(int, g.groups()), *map(int, c.groups())))
    if not rows: print(f, "no decode PROF lines"); continue
    m = [st.median(x) / 1000 for x in zip(*rows)]
    print(f"{f}: n={len(rows)} total {m[0]:.2f} ms | gpu copy {m[1]:.2f} comp {m[2]:.2f} | cpu copy {m[3]:.2f} comp {m[4]:.2f} | other {m[0]-sum(m[1:]):.2f}")
