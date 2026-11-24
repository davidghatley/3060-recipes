#!/usr/bin/env python3
"""Dense status image for a batch of recipes. Real numbers only: every figure is read from a file or a command.

    python3 -I scripts/status_report.py            # writes reports/status-<YYYYMMDD>-<n>.html and .png
    python3 -I scripts/status_report.py --no-png   # html only (no chromium)
    python3 -I scripts/status_report.py --name status-20261122-1   # overwrite a given image while fixing layout

Hand-written input: reports/status.json (headline, subhead, tiles, streams, decisions, next, footer, sizes).
Read automatically: the weights manifest + download log, df for the model drives, `gpu_run --status`,
and each recipe folder's runs/ledger.jsonl and best-config.json. A plate with no data says so.

Look: secret-sauce tokens and plates (dist/sauce-head.html), 2400 px wide, auto height, chromium headless (no GPU).
"""
import argparse, html, json, os, re, shutil, subprocess, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REP = ROOT / "reports"
SAUCE = Path.home() / "Projects/secret-sauce"
GPU_RUN = Path.home() / "anime-pipeline/tools/gpu_run"
DRIVES = [("/mnt/models", "Micron NVMe · weights that run"), ("/mnt/scratch", "BC501 NVMe · builds, holding"),
          ("/mnt/archive", "HDD · moved aside, cold"), ("/", "root · keep clear")]
W = 2400
e = lambda s: html.escape(str(s), quote=True)

STYLE = """<style>
html,body{margin:0;background:var(--paper);color:var(--ink)}
.wrap{display:grid;grid-template-columns:64px 1fr;width:2400px}
.main{padding:32px 40px 28px;display:grid;gap:20px;min-width:0}
.top{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:24px;border-bottom:var(--line-heavy) solid var(--ink);padding-bottom:16px}
.top h1{font:var(--type-display-m);margin:0}
.top p{font:var(--type-lead);margin:4px 0 0;color:var(--ink-muted)}
.phases{display:grid;gap:8px}
.ph{border:var(--line-hair) solid var(--rule);background:var(--sheet);padding:10px 12px;display:grid;gap:4px;align-content:start;min-width:0}
.ph b{font:var(--type-label);letter-spacing:.14em;text-transform:uppercase}
.ph em{font:var(--type-label);letter-spacing:.14em;text-transform:uppercase;font-style:normal;color:var(--ink-muted)}
.ph span{font:var(--type-small)}
.ph .bar{height:8px;background:var(--rule-faint);position:relative}
.ph .bar i{position:absolute;inset:0 auto 0 0;background:var(--cobalt)}
.grid3{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start}
.col{display:grid;gap:20px;align-content:start;min-width:0}
.ss-plate__body.one{grid-template-columns:minmax(0,1fr)}
svg text{font-family:"IBM Plex Mono",monospace;font-size:11px;fill:var(--ink)}
svg .bl{font-size:13px} svg .ax{fill:var(--ink-muted)} svg .lab{font-weight:600;letter-spacing:.1em;font-size:13px}
svg .val{font-size:11px} svg .on{font-size:11px;fill:var(--on-cobalt)}
svg .grid{stroke:var(--rule-faint);stroke-width:1}
svg .bfull{fill:var(--cobalt)} svg .bbase{fill:var(--cobalt-tint);stroke:var(--cobalt);stroke-width:1}
svg .ball{fill:var(--ink-muted)} svg .bctl{fill:var(--ink)}
svg .bpub{fill:var(--sheet);stroke:var(--ink);stroke-width:1.5}
svg .gap{fill:var(--sheet);stroke:var(--ink-muted);stroke-dasharray:3 2}
svg .diag{stroke:var(--ink-muted);stroke-dasharray:3 3}
.legend{display:flex;gap:20px;font:var(--type-small);color:var(--ink-muted);flex-wrap:wrap}
.legend i{display:inline-block;width:12px;height:12px;vertical-align:-1px;margin-right:6px}
.tbl{width:100%;border-collapse:collapse;font:var(--type-small)}
.tbl td,.tbl th{border-top:var(--line-hair) solid var(--rule);padding:6px 8px 6px 0;vertical-align:top;text-align:left}
.tbl th{font:var(--type-label);letter-spacing:.14em;text-transform:uppercase}
.tbl td:first-child{font:var(--type-data);white-space:nowrap}
.next{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.next div{border:var(--line-hair) solid var(--rule);background:var(--sheet);padding:10px 12px;font:var(--type-small)}
.next .gate{background:var(--vermilion);color:var(--on-vermilion);border-color:var(--ink)}
.next b{display:block;font:var(--type-label);letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px}
.none{font:var(--type-small);color:var(--ink-muted);border:var(--line-hair) dashed var(--rule);padding:16px}
.mono{font:var(--type-data);white-space:pre-wrap;margin:0}
</style>"""


def sh(cmd, timeout=20):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ""


# ---------------------------------------------------------------- data
def read_status():
    p = REP / "status.json"
    return json.loads(p.read_text()) if p.exists() else {}


def read_downloads(st):
    """Manifest rows with state done/partial/queued and sizes in GB. Sizes: file on disk, else the log's GET line,
    else status.json's sizes_gb (by basename), else unknown."""
    man = ROOT / st.get("manifest", "notes/trending-batch-1-weights.tsv")
    log = REP / st.get("download_log", "download-batch1.log")
    logtxt = log.read_text(errors="replace") if log.exists() else ""
    logsize = {m.group(1): int(m.group(2)) / 1000 for m in re.finditer(r"^GET \S+ (\S+) \((\d+) MB\)", logtxt, re.M)}
    hint = st.get("sizes_gb", {})
    rows = []
    if not man.exists():
        return rows, log.exists()
    for line in man.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        f = line.split("\t")
        if len(f) < 4:
            continue
        repo, path, dest = f[0], f[2], Path(f[3])
        part = Path(str(dest) + ".part")
        total = logsize.get(path) or hint.get(dest.name)
        if dest.exists() and not part.exists():
            got = dest.stat().st_size / 1e9
            state, total = "done", got
        elif part.exists():
            got, state = part.stat().st_size / 1e9, "partial"
        else:
            got, state = 0.0, "queued"
        group = dest.relative_to("/mnt/models/llm").parts[0] if str(dest).startswith("/mnt/models/llm/") else dest.parent.name
        rows.append(dict(repo=repo, name=dest.name, group=group, state=state, got=got, total=total))
    return rows, log.exists()


def read_df():
    out = []
    for mnt, note in DRIVES:
        try:
            u = shutil.disk_usage(mnt)
            out.append(dict(mnt=mnt, note=note, total=u.total / 1e9, used=(u.total - u.free) / 1e9, free=u.free / 1e9))
        except OSError:
            pass
    return out


NUM = (int, float)
DEC = re.compile(r"(^|_)(tps|decode|tg|gen)(_|$|\d)", re.I)
PRE = re.compile(r"(prefill|pp)", re.I)


def read_recipes():
    """Every top-level folder with a serve.sh / RESULTS.md / runs dir. Ledger schemas differ per recipe, so: count
    rows and distinct labels, keep the newest timestamp, and pick out decode-like and prefill-like tok/s fields."""
    out = []
    for d in sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith(".")):
        if d.name in ("scripts", "notes", "docs", "reports", "node_modules"):
            continue
        if not any((d / x).exists() for x in ("serve.sh", "RESULTS.md", "runs", "PLAN.md")):
            continue
        r = dict(name=d.name, rows=0, labels=0, dec=[], pre=[], last=None, best={}, files=[])
        r["files"] = [x for x in ("README.md", "RESULTS.md", "PLAN.md", "THEORY.md", "serve.sh", "best-config.json") if (d / x).exists()]
        led = d / "runs/ledger.jsonl"
        if led.exists():
            labels = set()
            for line in led.read_text(errors="replace").splitlines():
                try:
                    j = json.loads(line)
                except Exception:
                    continue
                if not isinstance(j, dict):
                    continue
                r["rows"] += 1
                labels.add(str(j.get("label") or j.get("config") or j.get("id") or j.get("session") or ""))
                for k, v in j.items():
                    if isinstance(v, NUM) and not isinstance(v, bool) and v > 0:
                        if PRE.search(k) and "tps" in k.lower():
                            r["pre"].append(float(v))
                        elif DEC.search(k) and not PRE.search(k) and ("tps" in k.lower() or "decode" in k.lower()):
                            r["dec"].append(float(v))
            r["labels"] = len(labels - {""})
            r["last"] = led.stat().st_mtime
        bc = d / "best-config.json"
        if bc.exists():
            try:
                j = json.loads(bc.read_text())
                flat = {}
                def walk(o, pre=""):
                    if isinstance(o, dict):
                        for k, v in o.items():
                            walk(v, f"{pre}{k}.")
                    elif isinstance(o, NUM) and not isinstance(o, bool):
                        flat[pre[:-1]] = float(o)
                walk(j)
                r["best"] = flat
            except Exception:
                pass
        out.append(r)
    return out


# ---------------------------------------------------------------- plates
def plate(n, title, status, body, cap=""):
    c = f'<p class="ss-plate__cap">{cap}</p>' if cap else ""
    return (f'<section class="ss-plate"><div class="ss-plate__head"><span class="ss-label">PLATE {n} · {e(title)}</span>'
            f'<span class="ss-label">{e(status)}</span></div><div class="ss-plate__body one">{body}</div>{c}</section>')


def none(msg):
    return f'<div class="none">{e(msg)}</div>'


def svg_downloads(rows):
    if not rows:
        return none("No weights manifest found."), "NO DATA"
    known = [r for r in rows if r["total"]]
    mx = max([r["total"] for r in known] + [1])
    LX, BW, RH = 440, 150, 22
    H = 34 + RH * len(rows) + 46
    s = [f'<svg viewBox="0 0 700 {H}" width="100%" role="img" aria-label="Download state per file">',
         '<text x="0" y="12" class="lab">FILES IN MANIFEST ORDER · GB ON DISK / GB TOTAL</text>']
    for i, r in enumerate(rows):
        y = 26 + i * RH
        nm = r["name"] if len(r["name"]) <= 56 else r["name"][:26] + "…" + r["name"][-29:]
        s.append(f'<text x="{LX-8}" y="{y+13}" class="val" text-anchor="end">{e(nm)}</text>')
        if r["total"]:
            w = max(BW * r["total"] / mx, 3)
            s.append(f'<rect x="{LX}" y="{y+2}" width="{w:.1f}" height="14" class="gap"/>')
            if r["got"] > 0:
                s.append(f'<rect x="{LX}" y="{y+2}" width="{max(w*min(r["got"]/r["total"],1),2):.1f}" height="14" class="{"bfull" if r["state"]=="done" else "bbase"}"/>')
            lab = f'{r["got"]:.2f} / {r["total"]:.2f}' if r["state"] != "done" else f'{r["total"]:.2f} ok'
        else:
            s.append(f'<rect x="{LX}" y="{y+2}" width="3" height="14" class="gap"/>')
            lab = "size not known yet" if r["state"] == "queued" else f'{r["got"]:.2f}'
        s.append(f'<text x="{LX+BW+8}" y="{y+13}" class="val">{lab}</text>')
    done = sum(r["got"] for r in rows)
    tot = sum(r["total"] or 0 for r in rows)
    nd = sum(r["state"] == "done" for r in rows)
    y = 26 + RH * len(rows) + 14
    s.append(f'<rect x="0" y="{y}" width="700" height="16" class="gap"/><rect x="0" y="{y}" width="{700*done/max(tot,1e-9):.1f}" height="16" class="bfull"/>')
    unk = sum(1 for r in rows if not r["total"])
    s.append(f'<text x="0" y="{y+32}" class="bl">{done:.1f} of {tot:.1f} GB on disk · {nd} of {len(rows)} files verified'
             + (f' · {unk} sizes unknown' if unk else '') + '</text></svg>')
    return "\n".join(s), f"{100*done/max(tot,1e-9):.0f}% · {nd}/{len(rows)} FILES"


def svg_groups(rows):
    groups = {}
    for r in rows:
        g = groups.setdefault(r["group"], [0.0, 0.0])
        g[0] += r["got"]; g[1] += r["total"] or 0
    if not groups:
        return none("No manifest rows.")
    mx = max(v[1] for v in groups.values()) or 1
    H = 26 + 30 * len(groups) + 6
    s = [f'<svg viewBox="0 0 700 {H}" width="100%" role="img" aria-label="Weights per recipe">',
         '<text x="0" y="12" class="lab">WEIGHTS PER RECIPE FOLDER · GB</text>']
    for i, (g, (got, tot)) in enumerate(groups.items()):
        y = 24 + i * 30
        s.append(f'<text x="232" y="{y+15}" class="bl" text-anchor="end">{e(g)}</text>')
        s.append(f'<rect x="240" y="{y}" width="{max(380*tot/mx,3):.1f}" height="20" class="gap"/>')
        if got:
            s.append(f'<rect x="240" y="{y}" width="{max(380*got/mx,2):.1f}" height="20" class="bfull"/>')
        s.append(f'<text x="{240+380*tot/mx+8:.1f}" y="{y+15}" class="val">{got:.1f} / {tot:.1f}</text>')
    s.append('</svg>')
    return "\n".join(s)


def svg_drives(dfs):
    if not dfs:
        return none("df returned nothing.")
    H = 26 + 58 * len(dfs)
    s = [f'<svg viewBox="0 0 700 {H}" width="100%" role="img" aria-label="Drive usage">',
         '<text x="0" y="12" class="lab">USED (INK) AND FREE (OUTLINE) · EACH BAR IS THE WHOLE DRIVE</text>']
    for i, d in enumerate(dfs):
        y = 28 + i * 58
        s.append(f'<text x="0" y="{y+10}" class="bl">{e(d["mnt"])}</text><text x="130" y="{y+10}" class="ax">{e(d["note"])}</text>')
        s.append(f'<rect x="0" y="{y+18}" width="520" height="20" class="gap"/><rect x="0" y="{y+18}" width="{520*d["used"]/d["total"]:.1f}" height="20" class="ball"/>')
        s.append(f'<text x="530" y="{y+33}" class="bl">{d["free"]:.0f} GB free</text><text x="640" y="{y+33}" class="ax">of {d["total"]:.0f}</text>')
    s.append('</svg>')
    return "\n".join(s)


def svg_recipes(recs):
    have = [r for r in recs if r["dec"] or r["pre"] or r["best"]]
    if not have:
        return none("No recipe in this batch has a measured run yet (no ledger rows, no best-config.json)."), "NO RUNS YET"
    H = 26 + 46 * len(have) + 20
    mxd = max([max(r["dec"]) for r in have if r["dec"]] + [1])
    mxp = max([max(r["pre"]) for r in have if r["pre"]] + [1])
    s = [f'<svg viewBox="0 0 700 {H}" width="100%" role="img" aria-label="Measured speeds per recipe">',
         '<text x="225" y="12" class="lab">DECODE TOK/S</text><text x="470" y="12" class="lab">PREFILL TOK/S</text>']
    for i, r in enumerate(have):
        y = 30 + i * 46
        s.append(f'<text x="215" y="{y+14}" class="bl" text-anchor="end">{e(r["name"])}</text><text x="215" y="{y+29}" class="ax" text-anchor="end">{r["rows"]} rows · {r["labels"]} configs</text>')
        for x0, vals, mx in ((225, r["dec"], mxd), (470, r["pre"], mxp)):
            if not vals:
                s.append(f'<text x="{x0}" y="{y+14}" class="ax">not in ledger</text>')
                continue
            lo, hi = min(vals), max(vals)
            s.append(f'<rect x="{x0}" y="{y}" width="{max(190*hi/mx,2):.1f}" height="18" class="bbase"/><rect x="{x0}" y="{y}" width="{max(190*lo/mx,2):.1f}" height="18" class="ball"/>')
            s.append(f'<rect x="{x0+190*hi/mx-3:.1f}" y="{y-2}" width="3" height="22" class="bfull"/>')
            s.append(f'<text x="{x0}" y="{y+32}" class="val">{lo:.1f} to {hi:.1f}</text>')
    s.append(f'<text x="0" y="{H-4}" class="ax">grey = slowest logged run · cobalt mark = fastest · all configs and depths mixed</text></svg>')
    return "\n".join(s), f"{len(have)} WITH RUNS"


def svg_tiles_scale(tiles):
    """Where each recipe stands on the skill's stages."""
    stages = ["queued", "weights", "baseline", "climb", "plateau", "qualify", "write-up", "promo"]
    if not tiles:
        return none("No tiles in status.json.")
    H = 44 + 30 * len(tiles)
    s = [f'<svg viewBox="0 0 700 {H}" width="100%" role="img" aria-label="Stage per recipe">']
    X0, CW = 215, 60
    for j, st_ in enumerate(stages):
        s.append(f'<text x="{X0+j*CW+CW/2-3}" y="12" class="ax" text-anchor="middle">{e(st_)}</text>')
    for i, t in enumerate(tiles):
        y = 24 + i * 30
        k = stages.index(t["stage"]) if t.get("stage") in stages else -1
        s.append(f'<text x="{X0-10}" y="{y+15}" class="bl" text-anchor="end">{e(t["name"])}</text>')
        for j in range(len(stages)):
            cls = "bfull" if j < k else ("bbase" if j == k else "gap")
            s.append(f'<rect x="{X0+j*CW}" y="{y}" width="{CW-6}" height="20" class="{cls}"/>')
    s.append(f'<text x="0" y="{H-4}" class="ax">cobalt = done · tint = current stage (reports/status.json) · outline = not started</text></svg>')
    return "\n".join(s)


def build(st, name):
    rows, has_log = read_downloads(st)
    dfs = read_df()
    recs = read_recipes()
    batch = set(t["name"] for t in st.get("tiles", []))
    brecs = [r for r in recs if r["name"] in batch] if batch else recs
    gpu = sh([str(GPU_RUN), "--status"]).strip() if GPU_RUN.exists() else ""
    dl_svg, dl_status = svg_downloads(rows)
    rc_svg, rc_status = svg_recipes(brecs)
    tiles = st.get("tiles", [])
    now = time.strftime("%H:%M")
    date = time.strftime("%Y-%m-%d")

    tiles_html = "".join(
        f'<div class="ph"><b>{i+1} · {e(t["name"])}</b><em>{e(t.get("state",""))}</em><div class="bar"><i style="width:{float(t.get("progress",0)):.0f}%"></i></div><span>{e(t.get("note",""))}</span></div>'
        for i, t in enumerate(tiles))

    streams = st.get("streams", [])
    streams_html = ('<table class="ss-table tbl"><tr><th>Stream</th><th>State</th><th>Detail</th></tr>' + "".join(
        f'<tr><td>{e(s["name"])}</td><td>{e(s.get("state",""))}</td><td>{e(s.get("note",""))}</td></tr>' for s in streams) + '</table>') if streams else none("No work streams listed in status.json.")

    dec = st.get("decisions", [])
    dec_html = ('<table class="ss-table tbl"><tr><th>Question</th><th>Finding</th><th>Decision</th></tr>' + "".join(
        f'<tr><td>{e(d.get("q",""))}</td><td>{e(d.get("finding",""))}</td><td>{e(d.get("decision",""))}</td></tr>' for d in dec) + '</table>') if dec else ""
    nxt = st.get("next", [])
    nxt_html = '<div class="next">' + "".join(
        f'<div class="{"gate" if n.get("gate") else ""}"><b>{i+1} · {e(n.get("title",""))}</b>{e(n.get("text",""))}</div>' for i, n in enumerate(nxt)) + '</div>' if nxt else ""
    dn_body = f'<div style="display:grid;gap:16px">{dec_html}{nxt_html}</div>' if (dec or nxt) else none("Nothing waiting and nothing queued in status.json.")
    waiting = sum(1 for n in nxt if n.get("gate"))

    files_tbl = '<table class="ss-table tbl"><tr><th>Recipe</th><th>Files present</th><th>Ledger</th></tr>' + "".join(
        f'<tr><td>{e(r["name"])}</td><td>{e(" · ".join(r["files"]) or "folder only")}</td><td>{r["rows"]} rows' + (f' · {time.strftime("%H:%M", time.localtime(r["last"]))}' if r["last"] else '') + '</td></tr>'
        for r in brecs) + '</table>' if brecs else none("No recipe folders for this batch yet.")

    eng = st.get("engines", [])
    eng_html = ('<table class="ss-table tbl"><tr><th>Build</th><th>State</th><th>For</th></tr>' + "".join(
        f'<tr><td>{e(x.get("name",""))}</td><td>{e(x.get("state",""))}</td><td>{e(x.get("for",""))}</td></tr>' for x in eng) + '</table>') if eng else ""
    gpu_html = f'<pre class="ss-code mono">{e(gpu)}</pre>' if gpu else none("gpu_run --status returned nothing.")

    foot = "".join(f'<span><i>{e(k)}</i> {e(v)}</span>' for k, v in st.get("footer", {}).items())
    head = (SAUCE / "dist/sauce-head.html").read_text()
    spine = st.get("spine", "3060-recipes · status")
    page = f'''<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><title>{e(name)}</title>
{head}
{STYLE}
<style>.phases{{grid-template-columns:repeat({max(len(tiles),1)},minmax(0,1fr))}}</style>
</head><body>
<!-- sauce-lint allow page-overflow: fixed 2400px status image, not a page --><div class="wrap" data-motion="still">
<aside class="ss-spine ss-spine--slim"><span style="writing-mode:vertical-rl;transform:rotate(180deg);font:var(--type-label);letter-spacing:.14em;text-transform:uppercase">{e(spine)}</span><span style="writing-mode:vertical-rl;transform:rotate(180deg);font:var(--type-label);letter-spacing:.14em">{date} · {now} local</span></aside>
<div class="main">
<header class="top"><div><h1>{e(st.get("headline","Status"))}</h1><p>{e(st.get("subhead",""))}</p></div>
<div class="legend"><span><i style="background:var(--cobalt)"></i>done / best</span><span><i style="background:var(--cobalt-tint);border:1px solid var(--cobalt)"></i>in progress</span><span><i style="background:var(--sheet);border:1px dashed var(--ink-muted)"></i>not started / free</span><span><i style="background:var(--ink-muted)"></i>used / baseline</span></div></header>
<section class="phases">{tiles_html}</section>
<div class="grid3">
<div class="col">
{plate(1, "WEIGHTS · DOWNLOAD", dl_status, f'<figure style="margin:0">{dl_svg}</figure>', "Read from the pinned manifest and the files on disk. A file counts as verified only after its sha256 matched and the .part suffix came off." if has_log else "No download log found; states are from the files on disk only.")}
{plate(2, "WEIGHTS PER RECIPE", f"{len(set(r['group'] for r in rows))} FOLDERS", f'<figure style="margin:0">{svg_groups(rows)}</figure>', "The same files grouped by the folder they land in under the weights drive. Outline = still to fetch.")}
{plate(5, "RECIPE FOLDERS", f"{sum(1 for r in brecs if r['rows'])} WITH A LEDGER", files_tbl, "What exists in each recipe folder at render time.")}
</div>
<div class="col">
{plate(3, "WHERE EACH RECIPE STANDS", f"{len(tiles)} RECIPES", f'<figure style="margin:0">{svg_tiles_scale(tiles)}</figure>', "Stages follow the inference-optimisation workflow: weights on disk, baseline, hill-climb, plateau, qualification gates, write-up, then the social package.")}
{plate(4, "MEASURED SPEEDS", rc_status, f'<figure style="margin:0">{rc_svg}</figure>' if rc_svg.startswith("<svg") else rc_svg, "Read from each recipe's runs/ledger.jsonl. Nothing is shown for a recipe until it has logged a run.")}
{plate(6, "WORK STREAMS", f"{sum(1 for s in streams if s.get('state','').lower() in ('running','building','downloading'))} RUNNING", streams_html, "Background work at render time, from reports/status.json.")}
</div>
<div class="col">
{plate(7, "STORAGE", f"{next((f'{d['free']:.0f} GB FREE ON FAST DRIVE' for d in dfs if d['mnt']=='/mnt/models'), '')}", f'<figure style="margin:0">{svg_drives(dfs)}</figure>', e(st.get("storage_note","")))}
{plate(8, "GPU LOCK AND ENGINES", "LIVE AT RENDER", f'<div style="display:grid;gap:16px">{gpu_html}{eng_html}</div>', "Top: the shared GPU lock as gpu_run reports it. Below: the llama.cpp builds this batch uses.")}
{plate(9, "DECISIONS AND NEXT", f"{waiting} WAITING ON DAVID" if waiting else f"{len(nxt)} QUEUED", dn_body, "The vermilion card is the only thing that needs an answer.")}
</div>
</div>
<footer class="ss-spec">{foot}</footer>
</div></div>
<script>document.fonts.ready.then(()=>{{document.title=String(document.documentElement.scrollHeight)}})</script>
</body></html>'''
    return page


def render(htmlp, pngp):
    chrome = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if not chrome:
        print("no chromium found; html only"); return False
    base = [chrome, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars"]
    dom = sh(base + ["--virtual-time-budget=8000", f"--window-size={W},800", "--dump-dom", f"file://{htmlp}"], timeout=120)
    m = re.search(r"<title>(\d+)</title>", dom)
    h = int(m.group(1)) if m else 2000
    subprocess.run(base + ["--virtual-time-budget=8000", f"--window-size={W},{h}", f"--screenshot={pngp}", f"file://{htmlp}"],
                   capture_output=True, timeout=180)
    print(f"png {pngp} {W}x{h}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name"); ap.add_argument("--no-png", action="store_true"); ap.add_argument("--no-lint", action="store_true")
    a = ap.parse_args()
    REP.mkdir(exist_ok=True)
    name = a.name
    if not name:
        day = time.strftime("%Y%m%d")
        n = 1 + max([int(m.group(1)) for p in REP.glob(f"status-{day}-*.png") if (m := re.search(r"-(\d+)\.png$", p.name))] + [0])
        name = f"status-{day}-{n}"
    st = read_status()
    htmlp, pngp = REP / f"{name}.html", REP / f"{name}.png"
    htmlp.write_text(build(st, name))
    print(f"html {htmlp}")
    if not a.no_png:
        render(htmlp, pngp)
    lint = SAUCE / "tools/lint/sauce-lint.mjs"
    if not a.no_lint and lint.exists() and shutil.which("node"):
        r = subprocess.run(["node", str(lint), str(htmlp), "--surface", "docs"], capture_output=True, text=True, timeout=300)
        print((r.stdout + r.stderr).strip()[-1500:])


if __name__ == "__main__":
    main()
