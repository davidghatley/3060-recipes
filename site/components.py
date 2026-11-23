"""Components and page builders for the 3060-recipes site.

Every component has two versions: "exact" (the plain house component) and "elevated"
(same tokens, tighter hierarchy, more information per mark). CHOICE picks the one the
pages use; /components/ shows both side by side for review.
"""
import html
import re

BASE = REPO = SITE = ""
gh = md_html = None
e = html.escape

CHOICE = {  # component -> "exact" | "elevated"
    "nav": "elevated", "hero": "elevated", "figures": "elevated", "recipe_table": "elevated", "recipe_head": "elevated",
    "result_table": "elevated", "chart": "elevated", "command": "elevated", "finding": "elevated", "provenance": "elevated",
    "credit": "elevated", "skill": "elevated", "steps": "elevated", "support": "elevated", "footer": "elevated",
}

PROV = {  # value -> (label, meaning, pill class)
    "ours": ("Ours", "Found and measured on this bench.", "ss-pill--info"),
    "ours-measuring-others-work": ("Our measurement of their work", "Someone else's code, file or patch; the numbers are ours.", "ss-pill--mute"),
    "confirms": ("Confirms earlier work", "Already described by someone else; reproduced here.", "ss-pill--mute"),
    "independent-also-upstream": ("Found here and upstream", "Found here and also reported upstream by others; who was first is unclear.", "ss-pill--mute"),
}
GROUPS = [("looped-moe", "Looped MoE"), ("experts-in-ram", "Experts in RAM"), ("drafting", "Drafting and speculation"),
          ("quants", "Quants"), ("disk-bound", "Disk-bound giants"), ("method", "Method"), ("box-and-harness", "Box and harness")]
GLYPH = ["XXXXX", "X.XXX", "XXXXX", ".X.X.", ".X.X."]  # a card with one fan and its edge connector
MARK = ["...X...", "...X...", "...X...", "XXXXXXX", "X..X..X", "X..X..X", "XXXX..X"]
NAV = [("recipes", "Recipes"), ("findings", "Findings"), ("skills", "Skills"), ("contribute", "Contribute"), ("thanks", "Thanks"),
       ("resources", "Resources"), ("about", "About")]


def cells(rows, cls=""):
    n = len(rows)
    r = "".join(f'<rect x="{x}" y="{y}" width="1" height="1"/>' for y, row in enumerate(rows) for x, c in enumerate(row) if c == "X")
    return f'<svg class="{cls}" viewBox="0 0 {n} {n}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">{r}</svg>'


def fmt(v):
    if isinstance(v, (int, float)):
        return f"{v:,.0f}" if v >= 1000 else f"{v:g}"
    return str(v)


def headline(r, metric):
    xs = [x for x in r["results"] if x["metric"] == metric and isinstance(x["value"], (int, float))]
    return next((x for x in xs if x.get("headline")), xs[0] if xs else None)


def headline_sort(r):
    return int(r["updated"].replace("-", ""))


def v_of(name, v):
    return v or CHOICE[name]


def chapter(title, count=None, label=""):
    no = f'<span class="ss-chapter__no">{count}</span>' if count is not None else '<span class="ss-chapter__no">&rarr;</span>'
    return f'<header class="ss-chapter">{no}<span class="ss-chapter__label">{e(label)}</span><h2 id="{slug(title)}">{e(title)}</h2></header>'


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ------------------------------------------------------------------ nav
def nav(current, v=None):
    v = v_of("nav", v)
    if v == "exact":
        links = " · ".join(f'<a href="{BASE}{p}/">{t}</a>' for p, t in NAV)
        return f'<header class="ss-runhead"><span><a href="{BASE}"><b>3060 Recipes</b></a></span><span>{links}</span></header>'
    links = "".join(f'<a href="{BASE}{p}/"{" aria-current=\"page\"" if p == current else ""}>{t}</a>' for p, t in NAV)
    return (f'<header class="nav"><a class="nav__home" href="{BASE}" aria-label="3060 Recipes, home">{cells(GLYPH, "nav__glyph")}'
            f'<b>3060 Recipes</b></a><nav class="nav__links" aria-label="Site">{links}</nav></header>')


# ------------------------------------------------------------------ hero + figures
def hero(D, v=None):
    v = v_of("hero", v)
    lead = ("Measured ways to run models far larger than 12&nbsp;GB on one RTX&nbsp;3060. Each recipe gives the exact file, engine build and "
            "flags, and every number links to the run that produced it.")
    mast = '<h1 class="ss-mast"><span class="ss-mast__x">3060</span><span class="ss-mast__c">Recipes</span></h1>'
    if v == "exact":
        return f'{mast}<p class="ss-lead">{lead}</p>'
    return f'<div class="hero"><div class="hero__title">{mast}<p class="ss-lead">{lead}</p></div>{figures(home_figures(D))}</div>'


def ktok(n):
    """Context in k as the recipes name it: 131072 is 128k, 262144 is 262k."""
    return n // 1024 if n < 200_000 else round(n / 1000)


def home_figures(D):
    R = D["recipes"]
    big = max((float(m.group(1)) for r in R for m in [re.search(r"([\d.]+)\s*B", r["model"].get("params", ""))] if m), default=0)
    ctx = max(r["context_tokens"] for r in R)
    return [("VRAM", "12", "GB"), ("Largest model run", f"{big:g}", "B params"), ("Longest window", f"{ktok(ctx)}", "k tokens"),
            ("Recipes", str(len(R)), ""), ("Findings", str(len(D["findings"])), "")]


def figures(items, v=None):
    """items: (label, value, unit[, note])"""
    v = v_of("figures", v)
    if v == "exact":
        return '<div class="ss-spec">' + "".join(f"<span><i>{e(i[0])}</i> {e(i[1])} {e(i[2])}</span>" for i in items) + "</div>"
    out = ""
    for i in items:
        note = f'<span class="fig__note">{e(i[3])}</span>' if len(i) > 3 and i[3] else ""
        out += (f'<div class="fig"><dt>{e(i[0])}</dt><dd><span class="ss-px ss-px--s">{e(i[1])}</span>'
                f'<span class="fig__unit">{e(i[2])}</span>{note}</dd></div>')
    return f'<dl class="figs">{out}</dl>'


# ------------------------------------------------------------------ recipe table
def speed_cell(x):
    if not x:
        return '<td class="num">not measured</td>'
    b = x.get("baseline")
    extra = ""
    if b:
        w = max(4, round(96 * b / x["value"]))
        extra = (f'<span class="vs"><svg viewBox="0 0 96 8" width="96" height="8" role="img" aria-label="stock {fmt(b)}, tuned {fmt(x["value"])}">'
                 f'<rect class="vs__t" width="96" height="8"/><rect class="vs__s" width="{w}" height="8"/></svg>'
                 f'<span class="vs__x">{x["value"] / b:.2f}&times; stock {fmt(b)}</span></span>')
    return f'<td class="num"><b class="speed">{fmt(x["value"])}</b> {e(x["unit"])}{extra}</td>'


def recipe_table(R, v=None):
    v = v_of("recipe_table", v)
    rows = ""
    for r in R:
        d, p = headline(r, "decode"), headline(r, "prefill")
        name = f'<a href="{BASE}recipes/{r["id"]}/"><b>{e(r["title"])}</b></a>'
        if v == "exact":
            rows += (f'<tr><td>{name}</td><td>{e(r["model"]["name"])}</td><td>{e(r["weights"]["quant"])}</td><td class="num">{ktok(r["context_tokens"])}k</td>'
                     f'<td>{e(r["engine"]["name"])}</td><td class="num">{fmt(d["value"]) if d else ""}</td><td class="num">{fmt(p["value"]) if p else ""}</td></tr>')
        else:
            who = f' <span class="by">by @{e(r["contributor"]["github"])}</span>' if r["_community"] else ""
            rows += (f'<tr><td data-l="Recipe">{name}{who}<span class="sub">{e(r["model"].get("params", ""))} {e(r["model"]["architecture"])} · {e(r["weights"]["quant"])}</span></td>'
                     f'<td data-l="Context" class="num">{ktok(r["context_tokens"])}k</td>'
                     f'<td data-l="How"><span class="how">{e(r["placement"])}</span></td>'
                     + speed_cell(d).replace("<td", '<td data-l="Decode"', 1) + speed_cell(p).replace("<td", '<td data-l="Prefill"', 1) + "</tr>")
    if v == "exact":
        head = "<th>Recipe</th><th>Model</th><th>Quant</th><th class=num>Context</th><th>Engine</th><th class=num>Decode tok/s</th><th class=num>Prefill tok/s</th>"
        return f'<div class="ss-table-wrap"><table class="ss-table"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div>'
    head = '<th>Recipe</th><th class="num">Context</th><th>What goes where</th><th class="num">Decode</th><th class="num">Prefill</th>'
    return f'<div class="ss-table-wrap"><table class="ss-table rt"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div>'


# ------------------------------------------------------------------ recipe page parts
def recipe_head(r, v=None):
    v = v_of("recipe_head", v)
    if v == "exact":
        return f'<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">{e(r["title"])}</span></h1><p class="ss-lead">{e(r["summary"])}</p>'
    w = r["weights"]
    sub = (f'{fmt(w["size_gb"])} GB of {w["quant"]} on 12 GB' if w.get("size_gb") else f'{w["quant"]} on 12 GB')
    items = []
    for m, lab in (("decode", "Decode"), ("prefill", "Prefill")):
        x = headline(r, m)
        if x:
            items.append((f'{lab} · {x.get("label", "")}'.rstrip(" ·"), fmt(x["value"]), x["unit"], f'stock {fmt(x["baseline"])}' if x.get("baseline") else ""))
    items.append(("Context", f'{ktok(r["context_tokens"])}', "k tokens"))
    vr = next((x for x in r["results"] if x["metric"] == "vram_peak"), None)
    if vr:
        val = fmt(vr["value"])
        m = re.fullmatch(r"([\d.,]+)\s*[-–]\s*([\d.,]+)", str(val))
        items.append(("VRAM peak", m.group(2), vr["unit"], f"range {m.group(1)}–{m.group(2)}") if m else ("VRAM peak", val, vr["unit"]))
    return (f'<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">{e(r["title"])}</span><span class="ss-mast__c">{e(sub)}</span></h1>'
            f'<p class="ss-lead">{e(r["summary"])}</p>{figures(items)}')


def chart(r, v=None):
    v = v_of("chart", v)
    rows = [x for x in r["results"] if x["metric"] in ("decode", "prefill") and isinstance(x["value"], (int, float)) and (x.get("baseline") or x.get("ceiling"))]
    if not rows:
        return ""
    rows = rows[:8]
    scale = {m: max(max(x["value"], x.get("baseline", 0), x.get("ceiling", 0)) for x in rows if x["metric"] == m) for m in ("decode", "prefill") if any(x["metric"] == m for x in rows)}
    has_ceiling = any(x.get("ceiling") for x in rows)
    cw = 8.1  # mono 11 px at .14em, per character

    def clip(t, n):
        return t if len(t) <= n else t[: n - 1].rstrip() + "…"

    def draw(W, L, BW, stacked):
        """stacked: the label sits above the bars (phone width); otherwise in a left column."""
        RH = 64 if stacked else 52
        top = 20 if stacked else 0
        H = RH * len(rows) + (12 if stacked else 20)
        g = ""
        for i, x in enumerate(rows):
            y = 8 + i * RH + top
            s = BW / scale[x["metric"]]
            if stacked:
                lab = x["metric"].upper() + (f' · {x["label"].upper()}' if x.get("label") else "")
                g += f'<text class="lb" x="0" y="{y - 8}">{e(clip(lab, int(W / cw)))}</text>'
            else:
                g += f'<text class="lb" x="0" y="{y + 12}">{e(x["metric"].upper())}</text>'
                if x.get("label"):
                    g += f'<text class="lb mu" x="0" y="{y + 28}">{e(clip(x["label"].upper(), 26))}</text>'
            vx = L + x["value"] * s
            g += f'<rect class="t" x="{L}" y="{y}" width="{x["value"] * s:.0f}" height="{14 if v == "elevated" else 20}"/>'
            vtxt = fmt(x["value"])
            g += f'<text class="val" x="{vx + 6:.0f}" y="{y + 12}">{vtxt}</text>'
            val_end = vx + 6 + len(vtxt) * 8.5
            stock_end = L
            if x.get("baseline"):
                bx = L + x["baseline"] * s
                st = f"STOCK {fmt(x['baseline'])}"
                if v == "elevated":
                    g += f'<rect class="s" x="{L}" y="{y + 18}" width="{x["baseline"] * s:.0f}" height="6"/>'
                    g += f'<text class="lb mu" x="{bx + 6:.0f}" y="{y + 25}">{st}</text>'
                    stock_end = bx + 6 + len(st) * cw
                else:
                    g += f'<text class="lb mu" x="{L}" y="{y + 32}">{st}</text>'
            if x.get("ceiling") and v == "elevated":
                cx = L + x["ceiling"] * s
                ct = f"CEILING {fmt(x['ceiling'])}"
                fits_right = cx + 6 + len(ct) * cw <= W
                # beside the tick on the value line if the value label clears it, else on the stock line, else below
                if fits_right and val_end + 8 < cx:
                    ty = y + 12
                elif fits_right and stock_end + 8 < cx:
                    ty = y + 25
                else:
                    ty = y + 40
                tx, anchor = (cx + 6, "") if fits_right else (cx, ' text-anchor="end"')
                g += f'<path class="ax" d="M{cx:.0f}.5 {y - 4}V{y + 28}"/><text class="lb mu" x="{tx:.0f}" y="{ty}"{anchor}>{ct}</text>'
        if stacked:
            g += "".join(f'<path class="ax" d="M{L}.5 {8 + i * RH + top - 2}V{8 + i * RH + top + 26}"/>' for i in range(len(rows)))
        else:
            g += f'<path class="ax" d="M{L}.5 0V{H - 20}"/>'
        cls = "bars bars--narrow" if stacked else "bars bars--wide"
        return (f'<svg class="{cls}" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" '
                f'aria-label="Tuned versus stock speeds for {e(r["title"])}; values are in the results table">{g}</svg>')

    svg = draw(760, 232, 392, False) + draw(340, 0, 236, True)
    key = '<span class="k k--t"></span>TUNED <span class="k k--s"></span>STOCK FLAGS' + (' <span class="k k--c"></span>CEILING FROM MEASURED BANDWIDTH' if v == "elevated" and has_ceiling else "")
    return (f'<figure class="ss-plate"><header class="ss-plate__head ss-label"><span><b>PLATE 1</b> · TUNED VS STOCK, TOK/S</span><span>{e(r["updated"])}</span></header>'
            f'{svg}<p class="ss-label chartkey">{key}</p>'
            f'<figcaption class="ss-plate__cap">Decode and prefill share no scale; each metric is drawn to its own maximum. Stock means the engine\'s default flags on the same file.</figcaption></figure>')


def command(cmd, label="Run", note="", v=None):
    v = v_of("command", v)
    if v == "exact":
        return f'<div class="ss-code"><span class="ss-code__label">{e(label)}</span><pre>{e(cmd)}</pre></div>'
    n = f'<span class="cmd__note">{e(note)}</span>' if note else ""
    return (f'<div class="ss-code cmd"><span class="ss-code__label"><span>{e(label)}{n}</span>'
            f'<button class="copy" type="button" data-copy hidden>Copy</button></span><pre>{e(cmd)}</pre></div>')


def result_table(r, v=None):
    v = v_of("result_table", v)
    names = {"decode": "Decode", "prefill": "Prefill", "ttft": "Time to first token", "startup": "Startup", "vram_peak": "VRAM peak",
             "ram_peak": "RAM peak", "needles": "Needles", "quality": "Quality", "other": "Other"}
    rows = ""
    last = None
    for x in r["results"]:
        m = names[x["metric"]]
        src = f'<a href="{gh(x["source"])}"><code>{e(x["source"].split("/", 1)[-1] if v == "elevated" else x["source"])}</code></a>'
        mcell = m if (v == "exact" or m != last) else ""
        last = m
        val = f'<b>{fmt(x["value"])}</b> {e(x["unit"])}' if v == "elevated" else f'{fmt(x["value"])} {e(x["unit"])}'
        rows += (f'<tr><td>{mcell}</td><td>{e(x.get("label", ""))}</td><td class="num">{val}</td><td class="num">{fmt(x["baseline"]) if x.get("baseline") else ""}</td>'
                 f'<td class="num">{fmt(x["ceiling"]) if x.get("ceiling") else ""}</td><td>{src}</td></tr>')
    return ('<div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>Metric</th><th>Conditions</th><th class="num">Measured</th><th class="num">Stock</th>'
            f'<th class="num">Ceiling</th><th>Source line</th></tr></thead><tbody>{rows}</tbody></table></div>')


def provenance(p, v=None):
    v = v_of("provenance", v)
    lab, meaning, cls = PROV[p]
    if v == "exact":
        return f'<span class="ss-pill ss-pill--mute">{e(lab)}</span>'
    return f'<span class="ss-pill {cls}" title="{e(meaning)}">{e(lab)}</span>'


def finding_row(f, v=None):
    v = v_of("finding", v)
    first = re.split(r"(?<=[.!?])\s", f["body"].strip(), maxsplit=1)[0]
    link = f'<a href="{BASE}findings/{f["slug"]}/">{e(f["title"])}</a>'
    if v == "exact":
        return f'<li><h3 class="fd-x">{link}</h3><p>{e(first)}</p><p>{provenance(f["provenance"], "exact")}</p></li>'
    rec = " ".join(f'<a href="{BASE}recipes/{r}/">{e(r)}</a>' for r in f["recipes"])
    return (f'<li class="fd"><div class="fd__meta"><time datetime="{f["date"]}">{f["date"]}</time>{provenance(f["provenance"])}</div>'
            f'<div class="fd__main"><h3>{link}</h3><p>{e(first)}</p><p class="fd__rec">{rec}</p></div></li>')


def finding_list(fs, v=None):
    return f'<ul class="fds">{"".join(finding_row(f, v) for f in fs)}</ul>'


def credit_entry(c, v=None):
    v = v_of("credit", v)
    links = " · ".join(f'<a href="{e(l["url"])}">{e(l["label"])}</a>' for l in c.get("links", []))
    rec = ", ".join(f'<a href="{BASE}recipes/{r}/">{e(r)}</a>' for r in c.get("recipes", []))
    if v == "exact":
        return f'<tr id="{e(c["id"])}"><td><b>{e(c["name"])}</b></td><td>{e(c["made"])}</td><td>{e(c["used_for"])}</td><td>{links}</td></tr>'
    return (f'<div class="cr" id="{e(c["id"])}"><h3>{e(c["name"])}</h3><div class="cr__body"><p>{e(c["made"])}</p>'
            f'<p><span class="ss-label">Used here for</span> {e(c["used_for"])}</p>'
            f'<p class="cr__links">{links}{" · in " + rec if rec else ""}</p></div></div>')


def install_cmd(s):
    return f'mkdir -p ~/.claude/skills && curl -fsSL {SITE}skills/{s["dir"]}.tar.gz | tar -xz -C ~/.claude/skills'


def skill_card(s, v=None):
    v = v_of("skill", v)
    desc = re.split(r"(?<=[.])\s", s["description"], maxsplit=1)[0]
    if v == "exact":
        return f'<tr><td><a href="{BASE}skills/{s["dir"]}/"><code>{e(s["name"])}</code></a></td><td>{e(desc)}</td><td><a href="{BASE}skills/{s["dir"]}/SKILL.md">SKILL.md</a></td></tr>'
    return (f'<div class="sk" id="{e(s["dir"])}"><div class="sk__head"><h3><a href="{BASE}skills/{s["dir"]}/"><code>{e(s["name"])}</code></a></h3>'
            f'<span class="ss-label">{len(s["files"])} file{"s" if len(s["files"]) != 1 else ""} · MIT · <a href="{BASE}skills/{s["dir"]}/SKILL.md">SKILL.md</a></span></div>'
            f'<p>{e(desc)}</p>{command(install_cmd(s), "Install", " · Claude Code path; any harness can read SKILL.md by URL")}</div>')


def steps(items, v=None):
    """items: (title, html)"""
    v = v_of("steps", v)
    if v == "exact":
        return '<div class="ss-prose"><ol>' + "".join(f"<li><strong>{e(t)}</strong> {h}</li>" for t, h in items) + "</ol></div>"
    return '<ol class="steps">' + "".join(f'<li><span class="ss-px ss-px--s steps__n">{i}</span><div><h3>{e(t)}</h3>{h}</div></li>' for i, (t, h) in enumerate(items, 1)) + "</ol>"


def support(v=None):
    v = v_of("support", v)
    a = ("<p>This bench is one person's desktop. The recipes exist because model authors, quantizers and engine maintainers publish their work in the open, "
         "and the results go back the same way: measured, sourced and free to reuse.</p>"
         "<p>I am open to roles in inference, model optimisation and developer tooling, and to sponsorship of the bench.</p>")
    helps = [("A second card or more VRAM", "the same recipes on 16 and 24 GB cards, and multi-GPU placement"),
             ("Compute credits", "imatrix and KLD references for quants that are too large to make here"),
             ("Early access to models and engine builds", "a measured 12 GB recipe ready when the release lands"),
             ("A conversation", "if your team ships models or inference software and cares how they run on the cards people actually own")]
    contact = (f'<a class="ss-button ss-button--primary" href="https://github.com/davidghatley">GitHub · davidghatley</a> '
               f'<a class="ss-button" href="https://davidghatley.github.io/">Portfolio</a> '
               f'<a class="ss-button" href="{REPO}/discussions">Open a discussion</a>')
    if v == "exact":
        return f'<div class="ss-prose">{a}<ul>' + "".join(f"<li><strong>{e(t)}</strong>: {e(d)}</li>" for t, d in helps) + f'</ul></div><p class="sup__btns">{contact}</p>'
    rows = "".join(f"<tr><td><b>{e(t)}</b></td><td>{e(d)}</td></tr>" for t, d in helps)
    return (f'<div class="sup"><div class="sup__text"><div class="ss-prose">{a}</div><p class="sup__btns">{contact}</p></div>'
            f'<div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>What would help</th><th>What it unlocks</th></tr></thead><tbody>{rows}</tbody></table></div></div>')


def footer(md_rel, D, v=None):
    v = v_of("footer", v)
    lock = (f'<div class="ss-lockup">{cells(MARK, "ss-lockup__mark")}<span class="ss-lockup__lead"></span><span><span class="ss-lockup__name">David Hatley</span>'
            '<span class="ss-lockup__line">design · AI/ML · generative tools</span></span></div>')
    if v == "exact":
        return f'<footer class="ss-foot">{lock}<span class="ss-label">Updated {D["updated"]}</span></footer>'
    cols = [("This page", [(f"{BASE}{md_rel}", "As Markdown"), (f"{BASE}llms.txt", "llms.txt"), (f"{BASE}recipes.json", "recipes.json"), (f"{BASE}feed.atom", "Feed")]),
            ("Project", [(REPO, "GitHub"), (f"{BASE}contribute/", "Submit a recipe"), (f"{BASE}about/#support", "Support this work"), (f"{BASE}thanks/", "Thanks")])]
    c = "".join('<div class="foot__col"><span class="ss-label">' + t + "</span>" + "".join(f'<a href="{u}">{n}</a>' for u, n in ls) + "</div>" for t, ls in cols)
    return (f'<footer class="ss-foot foot">{lock}<div class="foot__cols">{c}</div>'
            f'<p class="foot__lic ss-label">Text and results CC BY 4.0 · code and skills MIT · updated {D["updated"]}</p></footer>')


# ------------------------------------------------------------------ pages
def home(D):
    R, F = D["recipes"], D["findings"]
    agent = command(f"curl -s {SITE}llms.txt          # map of the site, with rules of use\ncurl -s {SITE}recipes.json      # every recipe: model, quant, context, speeds, serve command\n"
                    f"curl -s {SITE}recipes/{R[0]['id']}.md   # one recipe, complete, as Markdown", "For agents", " · every page has a .md twin; nothing needs JavaScript")
    body = hero(D)
    body += chapter("Recipes", len(R), "Measured on the bench") + recipe_table(R)
    body += (f'<div class="ss-note ss-note--rule"><span class="ss-note__tag">Own a 12 GB 3060?</span><div class="ss-note__body">Run a recipe and <a href="{REPO}/issues/new?template=reproduction.yml">report your numbers</a>, '
             f'or <a href="{BASE}contribute/">submit your own</a>. Any CPU and RAM size counts; the page shows your hardware next to your result.</div></div>')
    body += chapter("Read this site as an agent", None, "llms.txt · JSON · Markdown") + agent
    body += (f'<div class="ss-prose"><p>Start at <a href="{BASE}llms.txt">llms.txt</a>. <a href="{BASE}AGENTS.md">AGENTS.md</a> says how to choose a recipe, check a result and submit one. '
             f'<a href="{BASE}skills/">Skills</a> package the whole workflow for any harness that reads Markdown.</p></div>')
    body += chapter("Latest findings", len(F), "What the runs taught us") + finding_list(F[:6])
    body += f'<p><a href="{BASE}findings/">All {len(F)} findings</a></p>'
    md = [f"# 3060 Recipes", "", "Measured ways to run models far larger than 12 GB on one RTX 3060. Each recipe gives the exact file, engine build and flags, and every number links to the run that produced it.",
          "", "## Recipes", "", "| Recipe | Model | Quant | Context | Decode tok/s (stock) | Prefill tok/s (stock) |", "|---|---|---|---|---|---|"]
    for r in R:
        d, p = headline(r, "decode"), headline(r, "prefill")
        md.append(f"| [{r['title']}]({SITE}recipes/{r['id']}.md) | {r['model']['name']} | {r['weights']['quant']} | {r['context_tokens']:,} | "
                  f"{fmt(d['value']) if d else ''}{' (' + fmt(d['baseline']) + ')' if d and d.get('baseline') else ''} | {fmt(p['value']) if p else ''}{' (' + fmt(p['baseline']) + ')' if p and p.get('baseline') else ''} |")
    md += ["", "## For agents", "", f"- Map: {SITE}llms.txt", f"- All recipes: {SITE}recipes.json", f"- All findings: {SITE}findings.json", f"- Skills: {SITE}skills/index.json", f"- How to use this site: {SITE}AGENTS.md",
           "", "## Latest findings", ""] + [f"- [{f['title']}]({SITE}findings/{f['slug']}.md) ({f['date']})" for f in F[:10]]
    md += ["", "## Contribute", "", f"Anyone with a 12 GB RTX 3060 can submit a recipe or a reproduction: {SITE}contribute.md"]
    return body, "\n".join(md)


def recipes_index(D):
    R = D["recipes"]
    own, com = [r for r in R if not r["_community"]], [r for r in R if r["_community"]]
    body = ('<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">Recipes</span><span class="ss-mast__c">One card, twelve gigabytes</span></h1>'
            '<p class="ss-lead">Speeds are tokens per second at the stated context and prompt size. Stock is the same file on the engine\'s default flags.</p>')
    body += recipe_table(own)
    body += chapter("Community recipes", len(com), "Other people's 3060s")
    body += recipe_table(com) if com else f'<div class="ss-prose"><p>None yet. The first one could be yours: <a href="{BASE}contribute/">how to submit</a>.</p></div>'
    md = ["# Recipes", "", f"Machine-readable: {SITE}recipes.json", ""] + [f"- [{r['title']}]({SITE}recipes/{r['id']}.md): {r['summary']}" for r in R]
    return body, "\n".join(md)


def recipe_page(r, D):
    b = recipe_head(r)
    b += chart(r)
    b += chapter("Run it", None, "Exact file, build and flags")
    b += command(r["serve"]["command"], "Serve", f' · from {r["_dir"]}/ in a clone of the repo')
    w, en, hw = r["weights"], r["engine"], r["hardware"]
    rows = [("Model", f'<a href="https://huggingface.co/{e(r["model"]["hf_repo"])}">{e(r["model"]["hf_repo"])}</a> on Hugging Face' + (f' · {e(r["model"]["license"])}' if r["model"].get("license") else "")),
            ("Weights", f'{e(w["format"])} {e(w["quant"])}' + (f', {w["size_gb"]:g} GB' if w.get("size_gb") else "") + f' from <a href="{e(w["source"])}">{e(w["source"].replace("https://huggingface.co/", ""))}</a>'
             + (f'<br><code>{e(w["file"])}</code>' if w.get("file") else "") + (f' at <code>{e(w["revision"][:12])}</code>' if w.get("revision") else "") + (f'<br>{e(w["notes"])}' if w.get("notes") else "")),
            ("Engine", f'<a href="{e(en["repo"])}">{e(en["name"])}</a> {e(en["version"])}' + (f' · CUDA {e(en["cuda"])}' if en.get("cuda") else "") + ("<br>" + "<br>".join(e(p) for p in en["patches"]) if en.get("patches") else "")),
            ("Placement", e(r["placement"])),
            ("Hardware", f'{e(hw["gpu"])} {hw["vram_gb"]:g} GB · {hw["ram_gb"]:g} GB RAM · {e(hw["cpu"])}' + (f' · {e(hw["disk"])}' if hw.get("disk") else "") + (f'<br>{e(hw["notes"])}' if hw.get("notes") else ""))]
    if r["serve"].get("api"):
        rows.append(("API", e(r["serve"]["api"]) + (f' on port {r["serve"]["port"]}' if r["serve"].get("port") else "")))
    if r["serve"].get("key_flags"):
        rows.append(("Key flags", " ".join(f"<code>{e(f)}</code>" for f in r["serve"]["key_flags"])))
    b += '<div class="ss-table-wrap"><table class="ss-table kv"><tbody>' + "".join(f"<tr><th scope=row>{k}</th><td>{v}</td></tr>" for k, v in rows) + "</tbody></table></div>"
    if r.get("caveats"):
        b += '<div class="ss-note"><span class="ss-note__tag">Trap</span><div class="ss-note__body"><ul>' + "".join(f"<li>{e(c)}</li>" for c in r["caveats"]) + "</ul></div></div>"
    b += chapter("Measured results", len(r["results"]), "Every number links to its line") + result_table(r)
    reps = r.get("reproductions", [])
    b += chapter("Reproductions", len(reps), "Other 3060s")
    if reps:
        b += ('<div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>Who</th><th>Date</th><th>Hardware</th><th class="num">Decode</th><th class="num">Prefill</th><th>Notes</th></tr></thead><tbody>'
              + "".join(f'<tr><td><a href="https://github.com/{e(x["github"])}">@{e(x["github"])}</a></td><td>{e(x["date"])}</td><td>{e(x["hardware"])}</td><td class="num">{fmt(x["decode"])}</td>'
                        f'<td class="num">{fmt(x.get("prefill", ""))}</td><td>{e(x.get("notes", ""))}</td></tr>' for x in reps) + "</tbody></table></div>")
    else:
        b += f'<div class="ss-prose"><p>None yet. If you ran this on your own 3060, <a href="{REPO}/issues/new?template=reproduction.yml">report your numbers</a> and they appear here with your hardware.</p></div>'
    if r["_findings"]:
        b += chapter("Findings from this recipe", len(r["_findings"]), "Kept for the next model") + finding_list(r["_findings"])
    cs = [D["credit_by_id"][c] for c in r.get("credits", []) if c in D["credit_by_id"]]
    if cs:
        b += chapter("Thanks", len(cs), "This recipe stands on")
        b += '<ul class="thx">' + "".join(f'<li><a href="{BASE}thanks/#{e(c["id"])}"><b>{e(c["name"])}</b></a> {e(c["used_for"])}</li>' for c in cs) + "</ul>"
    if r["_readme"]:
        text = re.sub(r"^# .*\n", "", r["_readme"], count=1)
        b += chapter("Full write-up", None, "README from the repo") + f'<div class="ss-prose">{md_html(text, r["_dir"])}</div>'
    b += (f'<p class="ss-label also"><a href="{BASE}recipes/{r["id"]}/recipe.json">recipe.json</a> · <a href="{BASE}recipes/{r["id"]}.md">Markdown</a> · '
          f'<a href="{REPO}/tree/main/{r["_dir"]}">Folder with scripts and raw runs</a> · <a href="{REPO}/blob/main/{r["_dir"]}/RESULTS.md">Full results log</a></p>')
    return b


def findings_index(D):
    F = D["findings"]
    ours = sum(1 for f in F if f["provenance"] == "ours")
    b = ('<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">Findings</span><span class="ss-mast__c">What the runs taught us</span></h1>'
         '<p class="ss-lead">Things learned on this bench that the next recipe should not have to learn again. Each entry says what is ours and what belongs to someone else.</p>')
    b += figures([("Findings", str(len(F)), ""), ("Ours", str(ours), ""), ("Measuring or confirming others", str(len(F) - ours), "")])
    b += '<div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>Label</th><th>Meaning</th></tr></thead><tbody>' + "".join(f"<tr><td>{provenance(k)}</td><td>{e(v[1])}</td></tr>" for k, v in PROV.items()) + "</tbody></table></div>"
    md = ["# Findings", "", f"Machine-readable: {SITE}findings.json", ""]
    seen = set()
    for gid, gt in GROUPS + [("", "Other")]:
        fs = [f for f in F if (f.get("group") == gid if gid else f["slug"] not in seen)]
        if not fs:
            continue
        seen |= {f["slug"] for f in fs}
        b += chapter(gt, len(fs), "") + finding_list(fs)
        md += [f"## {gt}", ""] + [f"- [{f['title']}]({SITE}findings/{f['slug']}.md) · {PROV[f['provenance']][0]}" for f in fs] + [""]
    return b, "\n".join(md)


def finding_page(f, D):
    b = f'<p class="ss-label crumbs"><a href="{BASE}findings/">Findings</a> · <time datetime="{f["date"]}">{f["date"]}</time> · {provenance(f["provenance"])}</p>'
    b += f'<h1 class="finding-title">{e(f["title"])}</h1>'
    b += f'<div class="ss-prose">{md_html(f["body"])}</div>'
    rows = [("Provenance", f'{e(PROV[f["provenance"]][0])}. {e(f.get("provenance_note", ""))}'),
            ("Builds on", e(", ".join(f["credit"])) or "Nothing external"),
            ("Applies to", e(f.get("applies_to", ""))),
            ("Recipes", " · ".join(f'<a href="{BASE}recipes/{r}/">{e(r)}</a>' for r in f["recipes"]) or "None"),
            ("Evidence", "<br>".join(f'<a href="{gh(x)}"><code>{e(x)}</code></a>' for x in f["evidence"]))]
    b += '<div class="ss-table-wrap"><table class="ss-table kv"><tbody>' + "".join(f"<tr><th scope=row>{k}</th><td>{v}</td></tr>" for k, v in rows) + "</tbody></table></div>"
    return b


ROLES = [("use", "Use a recipe"), ("make", "Make and submit a recipe"), ("share", "Share the result")]


def skills_index(D):
    S = D["skills"]
    b = ('<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">Skills</span><span class="ss-mast__c">For any agent, any harness</span></h1>'
         '<p class="ss-lead">A skill is a folder with a SKILL.md and a few scripts. These hold the method behind the recipes, with no machine-specific paths, so an agent on another 3060 can find a recipe, reproduce it, make a new one and submit it.</p>')
    b += command(f"curl -s {SITE}skills/index.json", "List them", " · names, descriptions, file URLs and tarballs")
    md = ["# Skills", "", f"Index: {SITE}skills/index.json", "", "Install: copy the folder into your harness's skills directory (Claude Code: `~/.claude/skills/<name>/`), or read SKILL.md by URL.", ""]
    for rid, rt in ROLES:
        ss = [s for s in S if s["role"] == rid]
        if not ss:
            continue
        b += chapter(rt, len(ss), "") + "".join(skill_card(s) for s in ss)
        md += [f"## {rt}", ""] + [f"- [{s['name']}]({SITE}skills/{s['dir']}/SKILL.md): {s['description']}\n  - `{install_cmd(s)}`" for s in ss] + [""]
    ext = D["external_skills"]
    b += chapter("Skills by others that these lean on", len(ext), "Linked, not copied")
    b += '<div class="creds">' + "".join(f'<div class="cr"><h3>{e(x["name"])}</h3><div class="cr__body"><p>{e(x["what"])}</p><p><span class="ss-label">By</span> {e(x["by"])}</p><p class="cr__links"><a href="{e(x["url"])}">{e(x["url"].replace("https://", ""))}</a></p></div></div>' for x in ext) + "</div>"
    md += ["## By others", ""] + [f"- [{x['name']}]({x['url']}) by {x['by']}: {x['what']}" for x in ext]
    b += chapter("Other harnesses", None, "")
    b += ('<div class="ss-prose"><p>The install line above uses Claude Code\'s folder. Nothing in a skill depends on it. For any other harness, put the folder where that harness loads skills or rules from, '
          'or give the agent the SKILL.md URL and ask it to follow it. Every skill is plain Markdown plus POSIX shell and Python standard-library scripts.</p></div>')
    return b, "\n".join(md)


def skill_page(s, D):
    b = f'<p class="ss-label crumbs"><a href="{BASE}skills/">Skills</a> · MIT · <a href="{BASE}skills/{s["dir"]}/SKILL.md">raw SKILL.md</a> · <a href="{BASE}skills/{s["dir"]}.tar.gz">tarball</a></p>'
    b += f'<h1 class="finding-title"><code>{e(s["name"])}</code></h1><p class="ss-lead">{e(s["description"])}</p>'
    b += command(install_cmd(s), "Install", " · Claude Code path; other harnesses: any folder they read")
    b += '<div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>Files</th></tr></thead><tbody>' + "".join(f'<tr><td><a href="{BASE}skills/{s["dir"]}/{e(fn)}"><code>{e(fn)}</code></a></td></tr>' for fn in s["files"]) + "</tbody></table></div>"
    b += f'<div class="ss-prose">{md_html(s["body"])}</div>'
    return b


def contribute(text, D):
    body = re.sub(r"^# .*\n", "", text, count=1)
    b = ('<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">Contribute</span><span class="ss-mast__c">Your 3060 counts</span></h1>'
         '<p class="ss-lead">A recipe measured on one desktop is a data point. The same recipe measured on twenty is a reference. Three ways in, from five minutes to a full recipe.</p>')
    b += steps([
        ("Report a reproduction", f'<p>Ran one of the recipes? Post your decode and prefill numbers with your CPU, RAM and driver. They appear on the recipe page under your name.</p><p><a class="ss-button" href="{REPO}/issues/new?template=reproduction.yml">Reproduction form</a></p>'),
        ("Send numbers without a pull request", f'<p>Have a working setup for a model that is not here, but no time to package it? Fill the form with the file, the engine build, the flags and what you measured.</p><p><a class="ss-button" href="{REPO}/issues/new?template=recipe.yml">Recipe form</a></p>'),
        ("Submit a full recipe", '<p>Scaffold a folder, fill <code>recipe.json</code>, validate, open a pull request. Your agent can do all of it with the <a href="' + BASE + 'skills/#submit-3060-recipe"><code>submit-3060-recipe</code></a> skill.</p>'
         + command("git clone " + REPO + " && cd 3060-recipes\npython3 scripts/new_recipe.py community/<your-recipe-id>\n# measure, fill recipe.json and README.md, then:\npython3 scripts/validate_recipe.py community/<your-recipe-id>", "Scaffold and validate")),
    ])
    b += f'<div class="ss-prose">{md_html(body, "")}</div>'
    return b


def thanks(D):
    b = ('<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">Thanks</span><span class="ss-mast__c">Whose work this is built on</span></h1>'
         '<p class="ss-lead">Nothing here runs without other people\'s models, quantized files, engines, patches and methods, nearly all of it published in the open. This page says who made what and exactly what it was used for.</p>')
    md = ["# Thanks", ""]
    for g in D["credit_groups"]:
        cs = [c for c in D["credits"] if c["group"] == g["id"]]
        if not cs:
            continue
        b += chapter(g["title"], len(cs), "") + '<div class="creds">' + "".join(credit_entry(c) for c in cs) + "</div>"
        md += [f"## {g['title']}", ""] + [f"- **{c['name']}**: {c['made']} Used here for: {c['used_for']} " + " ".join(f"[{l['label']}]({l['url']})" for l in c.get("links", [])) for c in cs] + [""]
    b += f'<div class="ss-prose"><p>Missing or mis-credited? <a href="{REPO}/issues/new?template=correction.yml">Send a correction</a> and it is fixed the same way a wrong number would be.</p></div>'
    return b, "\n".join(md)


KINDS = [("engine", "Engines"), ("method", "Method"), ("registry", "Registries"), ("api", "APIs"), ("quant-source", "Where the files come from"), ("tool", "Tools"), ("our-script", "Scripts from this repo")]


def resources(D):
    b = ('<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">Resources</span><span class="ss-mast__c">What the bench actually uses</span></h1>'
         '<p class="ss-lead">Each link is here because a recipe depends on it, with a line on how.</p>')
    md = ["# Resources", ""]
    for kid, kt in KINDS:
        rs = [r for r in D["resources"] if r["kind"] == kid]
        if not rs:
            continue
        b += chapter(kt, len(rs), "")
        b += '<div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>Resource</th><th>By</th><th>How it is used here</th></tr></thead><tbody>' + "".join(
            f'<tr><td><a href="{e(r["url"])}"><b>{e(r["title"])}</b></a></td><td>{e(r.get("by", ""))}</td><td>{e(r["why"])}</td></tr>' for r in rs) + "</tbody></table></div>"
        md += [f"## {kt}", ""] + [f"- [{r['title']}]({r['url']}) ({r.get('by', '')}): {r['why']}" for r in rs] + [""]
    return b, "\n".join(md)


def about(D):
    b = ('<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">About</span><span class="ss-mast__c">The bench and the method</span></h1>'
         '<p class="ss-lead">One desktop: an RTX 3060 with 12 GB, 62 GB of RAM, an i5-12500 and NVMe drives. The 3060 is one of the most widely owned cards there is, so a recipe that works here works for a lot of people.</p>')
    b += figures([("GPU", "3060", "RTX · 12 GB"), ("RAM", "62", "GB"), ("CPU", "6", "P-cores · i5-12500"), ("Storage", "NVMe", "weights stream from disk")])
    b += chapter("Method", None, "How a number gets on this site")
    b += steps([
        ("Ceiling first", "<p>Before tuning, work out the fastest the hardware could go: bytes read per token divided by measured memory bandwidth. Every result is reported against that ceiling, so it is clear how much is left.</p>"),
        ("One change per run", "<p>A baseline on stock flags, then one change at a time with controls on both sides. A change stays only if it beats run-to-run noise.</p>"),
        ("A load is not a run", "<p>A configuration counts when it has answered long prompts at the full served window, found needles at half and full depth, and passed a small code eval. Loading without error proves nothing.</p>"),
        ("Every number has a source line", f'<p>Raw runs are in the repo. Each figure on this site links to the line in <code>RESULTS.md</code> it was read from, and <a href="{BASE}contribute/">anyone can report</a> what the same recipe does on their card.</p>'),
    ])
    b += f'<div class="ss-prose"><p>The tuning loop follows the inference-optimisation skill by 0xSero and Sybil Solutions. The full list of people and projects is on the <a href="{BASE}thanks/">thanks page</a>.</p></div>'
    b += chapter("Support this work", None, "Roles and sponsorship").replace('id="support-this-work"', 'id="support"') + support()
    md = ["# About", "", "One desktop: NVIDIA RTX 3060 12 GB, 62 GB RAM, Intel i5-12500, NVMe storage.", "", "## Method", "",
          "1. Ceiling first: bytes read per token divided by measured memory bandwidth.", "2. One change per run, with controls; keep only what beats noise.",
          "3. A load is not a run: long prompts at the full window, needles at half and full depth, a code eval.", "4. Every number links to its source line in the repo.",
          "", "## Support this work", "", "David Hatley is open to roles in inference, model optimisation and developer tooling, and to sponsorship of the bench (hardware, compute credits, early access to models and engine builds).",
          "", "- GitHub: https://github.com/davidghatley", "- Portfolio: https://davidghatley.github.io/", f"- Discussions: {REPO}/discussions"]
    return b, "\n".join(md)


# ------------------------------------------------------------------ agent files
def agents_md(D):
    R = D["recipes"]
    L = ["# AGENTS.md: using 3060 Recipes", "",
         "This site documents measured ways to run large language models on one NVIDIA RTX 3060 with 12 GB of VRAM. It is written to be read by agents. Everything is static; nothing needs JavaScript or a login.",
         "", "## Where things are", "",
         f"- `{SITE}recipes.json`: every recipe with model, quant, context, engine, placement, headline speeds and the serve command.",
         f"- `{SITE}recipes/<id>.md`: one recipe in full. `{SITE}recipes/<id>/recipe.json`: the same with a source line for every number.",
         f"- `{SITE}findings.json`: what was learned, with provenance (ours, or whose).",
         f"- `{SITE}skills/index.json`: installable skills. `{SITE}llms-full.txt`: every recipe and finding in one file.",
         "- Any page URL plus `index.md`, or the page path plus `.md`, returns that page as Markdown.",
         "", "## Choosing a recipe", "",
         "1. Check the hardware: these numbers are for 12 GB of VRAM. System RAM matters as much: recipes that keep experts in RAM need the whole file in page cache. Compare the user's RAM with `hardware.ram_gb` and the weights size.",
         "2. Match the task to `use_cases` and the needed context to `context_tokens`.",
         "3. Read `placement`. It says what sits in VRAM, what sits in RAM and what streams from disk, which tells you what the user's machine must have.",
         "4. Quote speeds with their conditions (context depth, prompt size). A decode speed without a context length is not a usable number.",
         "", "## Recipes right now", ""]
    for r in R:
        d = headline(r, "decode")
        L.append(f"- `{r['id']}`: {r['model']['name']}, {r['weights']['quant']}, {r['context_tokens']:,} tokens" + (f", {fmt(d['value'])} tok/s decode" if d else "") + f". {SITE}recipes/{r['id']}.md")
    L += ["", "## Reproducing one", "",
          f"1. Clone {REPO} and open the recipe folder.", "2. Fetch the exact weights file and revision named in `weights`; verify the sha256 Hugging Face reports.",
          "3. Build or fetch the engine at the version in `engine`, with the listed patches. Different builds give different numbers, and some recipes depend on a specific commit.",
          "4. Run `serve.command`. Send a long request before trusting it: a configuration that loads can still fail on its first real prompt.",
          "5. Expect results within about 10% on the same CPU and RAM class. Larger gaps usually mean a different engine build, a slower disk, or less free VRAM because a desktop is using some.",
          "", "## Reporting back and contributing", "",
          f"- Numbers for an existing recipe: {REPO}/issues/new?template=reproduction.yml",
          f"- A new recipe: follow {SITE}contribute.md. The `submit-3060-recipe` skill automates it: {SITE}skills/submit-3060-recipe/SKILL.md",
          "- Do not open issues or pull requests on a user's behalf without their consent.",
          "", "## Rules of use", "",
          "- Text and results are CC BY 4.0: reuse them, and cite `3060 Recipes` with the page URL. Code and skills are MIT.",
          "- Model weights and engines have their own licences; check them before recommending commercial use.",
          "- These are measurements from specific builds on specific dates. Say when the recipe was last updated (`updated`).",
          f"- Credit the people whose work a recipe uses; they are listed in `credits` and on {SITE}thanks.md."]
    return "\n".join(L) + "\n"


def llms_txt(D, agents):
    R, F, S = D["recipes"], D["findings"], D["skills"]
    L = ["# 3060 Recipes", "", "> Measured recipes for running large language models on one NVIDIA RTX 3060 (12 GB VRAM): exact weights file, engine build, flags, and speeds with a source line for every number. Plus findings, agent skills, and a way for any 3060 owner to submit results.",
         "", f"Hardware class: RTX 3060 12 GB. Reference bench: 62 GB RAM, Intel i5-12500, NVMe. Updated {D['updated']}. Source: {REPO}",
         "", "## Start here", "", f"- [AGENTS.md]({SITE}AGENTS.md): how to choose, reproduce and report a recipe", f"- [recipes.json]({SITE}recipes.json): all recipes, machine-readable",
         f"- [llms-full.txt]({SITE}llms-full.txt): every recipe and finding in one file", "", "## Recipes", ""]
    for r in R:
        L.append(f"- [{r['title']}]({SITE}recipes/{r['id']}.md): {r['summary']}")
    L += ["", "## Findings", ""] + [f"- [{f['title']}]({SITE}findings/{f['slug']}.md)" for f in F]
    L += ["", "## Skills", ""] + [f"- [{s['name']}]({SITE}skills/{s['dir']}/SKILL.md): {re.split(r'(?<=[.])\\s', s['description'], maxsplit=1)[0]}" for s in S]
    L += ["", "## Contribute", "", f"- [Contribute]({SITE}contribute.md): submit a recipe or a reproduction from your own 3060", f"- [Recipe schema]({SITE}schema/recipe.schema.json)",
          "", "## Optional", "", f"- [Thanks]({SITE}thanks.md): people and projects the recipes are built on", f"- [Resources]({SITE}resources.md): engines, methods, APIs and scripts used",
          f"- [About]({SITE}about.md): the bench, the method, how to support the work", f"- [findings.json]({SITE}findings.json)", f"- [skills/index.json]({SITE}skills/index.json)", f"- [Feed]({SITE}feed.atom)"]
    return "\n".join(L) + "\n"


# ------------------------------------------------------------------ component sheet
def sheet(D):
    R = D["recipes"]
    r = next((x for x in R if any(y.get("ceiling") for y in x["results"])), R[0])
    F = D["findings"][:2]
    c = D["credits"][0]
    s = D["skills"][0] if D["skills"] else None
    demo_steps = [("Report a reproduction", "<p>Post your decode and prefill numbers with your CPU, RAM and driver.</p>"), ("Submit a full recipe", "<p>Scaffold, measure, validate, open a pull request.</p>")]
    comps = [
        ("nav", "Navigation", "Run head with links wraps to three lines on a phone and gives no sign of where you are.", "Project glyph and name left; links in one scrolling row; the current page carries the cobalt underline.", lambda v: nav("recipes", v)),
        ("hero", "Home title", "Mast and lead only: the first screen says what the site is but shows no evidence.", "Mast beside five real figures in Stem 7, so the first screen already carries data.", lambda v: hero(D, v)),
        ("figures", "Figures", "Spec strip at 11px: correct, but the headline numbers are the smallest type on the page.", "Stem 7 numerals at 32px under a heavy rule, unit and stock value beside them.", lambda v: figures([("Decode · empty context", "29", "tok/s", "stock 17.5"), ("Prefill · 8k", "145", "tok/s", "stock 39"), ("Context", "64", "k tokens")], v)),
        ("recipe_table", "Recipe table", "Seven columns of equal weight; speedup has to be worked out in your head.", "Five columns. Model and quant fold under the name, placement gets its own column, and each speed carries a tuned-vs-stock bar. Rows stack with labels on a phone.", lambda v: recipe_table(R, v)),
        ("recipe_head", "Recipe header", "Title and summary.", "Second mast line states the claim (size on 12 GB); headline results sit directly under the summary.", lambda v: recipe_head(r, v)),
        ("chart", "Speed plate", "Tuned bars only; stock is a caption and the ceiling is missing.", "Bullet rows: tuned in cobalt, stock as a thin ink bar beneath, ceiling as a tick. Direct labels, drawn 1:1.", lambda v: chart(r, v)),
        ("command", "Command block", "Code block with a label.", "Adds where to run it and a copy button that only appears when scripts run.", lambda v: command(r["serve"]["command"], "Serve", f' · from {r["_dir"]}/', v)),
        ("result_table", "Results table", "Metric repeated on every row; full paths make the source column the widest.", "Metric named once per group, measured value bold, source shortened to file and line.", lambda v: result_table(r, v)),
        ("finding", "Finding entry", "Title, sentence, label stacked: the date is missing and the list has no rhythm.", "Date and provenance in a fixed left column, title and first sentence right, recipes as quiet links.", lambda v: finding_list(F, v)),
        ("provenance", "Provenance label", "Every label grey: 'ours' looks the same as 'confirms'.", "'Ours' takes cobalt; the three that involve other people's work stay ink-muted. The word always carries the meaning.", lambda v: " ".join(provenance(k, v) for k in PROV)),
        ("credit", "Credit entry", "A four-column table row: reads as a ledger, and long sentences wrap badly.", "Name as a heading with what they made, then exactly what it was used for, then links.", lambda v: ('<div class="ss-table-wrap"><table class="ss-table"><tbody>' + credit_entry(c, v) + "</tbody></table></div>") if v == "exact" else credit_entry(c, v)),
        ("skill", "Skill card", "Table row with a link.", "Name, file count and licence on one line, one-sentence purpose, install command ready to copy.", (lambda v: ('<div class="ss-table-wrap"><table class="ss-table"><tbody>' + skill_card(s, v) + "</tbody></table></div>") if v == "exact" else skill_card(s, v)) if s else (lambda v: "")),
        ("steps", "Steps", "Ordered list in prose.", "Stem 7 numerals in cobalt, a heading per step, room for a button or command under each.", lambda v: steps(demo_steps, v)),
        ("support", "Support block", "Prose and a bullet list.", "Statement and contact buttons left; a table of what would help and what it unlocks right.", lambda v: support(v)),
        ("footer", "Footer", "Lockup and a date.", "Lockup, then the machine-readable versions of the page and the project links, then the licence line.", lambda v: footer("index.md", D, v)),
    ]
    out = ""
    for key, name, crit, elev, fn in comps:
        out += (f'<header class="ss-chapter"><span class="ss-chapter__no">&rarr;</span><span class="ss-chapter__label">{key} · using: {CHOICE[key]}</span><h2>{name}</h2></header>'
                f'<div class="variant"><p class="ss-label"><b>A · Exact</b> &nbsp; {e(crit)}</p><div class="variant__box">{fn("exact")}</div></div>'
                f'<div class="variant"><p class="ss-label"><b>B · Elevated</b> &nbsp; {e(elev)}</p><div class="variant__box">{fn("elevated")}</div></div>')
    notes = ('<header class="ss-chapter"><span class="ss-chapter__no">&rarr;</span><span class="ss-chapter__label">notes · unchanged</span><h2>Notes</h2></header>'
             '<p class="ss-label">The house notes are used as they are. Rule (vermilion) appears once per page; trap is ink.</p>'
             '<div class="ss-note ss-note--rule"><span class="ss-note__tag">Own a 12 GB 3060?</span><div class="ss-note__body">Run a recipe and report your numbers.</div></div>'
             '<div class="ss-note"><span class="ss-note__tag">Trap</span><div class="ss-note__body">A layout that leaves under 0.4 GB free after load dies on its first request.</div></div>')
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Component Sheet</title><meta name="robots" content="noindex">
<!-- sauce-lint surface: docs --><!-- sauce-lint allow vermilion-focus: a review sheet shows the same component twice -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@1,6..72,400&display=swap">
<link rel="stylesheet" href="{BASE}assets/tokens.css"><link rel="stylesheet" href="{BASE}assets/components.css"><link rel="stylesheet" href="{BASE}assets/site.css"></head>
<body class="ss-body"><div class="ss-page"><header class="ss-runhead"><span><b>Component sheet</b> · 3060 Recipes</span><span>{D["today"]}</span></header>
<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">Components</span><span class="ss-mast__c">Exact and elevated</span></h1>
<p class="ss-lead">Each component twice: A is the plain house component, B is the elevated version the pages use now. Say "use A for chart" and the generator switches.</p>
{out}{notes}</div><script src="{BASE}assets/site.js" defer></script></body></html>"""
