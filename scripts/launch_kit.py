#!/usr/bin/env python3
"""Build the batch launch-kit page (one HTML file, republished as one artifact).

Reads reports/launch-kit.json:
  {"title": ..., "recipes": [{"dir": "qwen38-27b-family", "name": "Qwen3.8-27B family",
    "status": "measured, not posted", "sent": {"time": "...", "files": [...]}}]}
and for each recipe <dir>/promo/out/post.md (thread sections, alt text, thanks table) plus the
stills in <dir>/promo/out/*.png. Writes reports/launch-kit.html.

Page shell: the Secret Sauce tool recipe, inlined (pass --head, the output of
`python3 tools/inline.py --page recipes/tool.html`); only the head and the sauce <style> are kept.
"""
import argparse, base64, html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def esc(s):
    return html.escape(s, quote=True)


def inline_md(s):
    s = esc(s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    return s


def parse_post(text):
    out = {"blocking": [], "posts": [], "alts": [], "thanks": [], "thanks_head": None}
    lines = text.splitlines()
    i, section = 0, None
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("**Blocking before posting"):
            section = "blocking"
        elif ln.startswith("## "):
            h = ln[3:].strip()
            if h.lower().startswith("alt text"):
                section = "alt"
            elif h.lower().startswith("thanks and handles"):
                section = "thanks"
            elif re.match(r"\d+/", h):
                section = "post"
                out["posts"].append({"head": h, "attach": "", "text": ""})
            else:
                section = None
        elif section == "blocking":
            if ln.startswith("- "):
                out["blocking"].append(ln[2:].strip())
            elif ln.startswith("  ") and out["blocking"]:
                out["blocking"][-1] += " " + ln.strip()
            elif ln.strip() and not ln.startswith(" "):
                section = None
        elif ln.startswith("```") and section in ("post", "alt"):
            j = i + 1
            buf = []
            while j < len(lines) and not lines[j].startswith("```"):
                buf.append(lines[j]); j += 1
            body = "\n".join(buf)
            if section == "post" and out["posts"] and not out["posts"][-1]["text"]:
                out["posts"][-1]["text"] = body
            elif section == "alt" and out["alts"] and not out["alts"][-1]["text"]:
                out["alts"][-1]["text"] = body
            i = j
        elif section == "post" and out["posts"] and (ln.startswith("Attach:") or ln.startswith("No attachment")):
            out["posts"][-1]["attach"] = ln.strip()
        elif section == "alt" and re.match(r"\*\*.+\*\*$", ln.strip()):
            out["alts"].append({"name": ln.strip().strip("*"), "text": ""})
        elif section == "thanks" and ln.startswith("|"):
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if set("".join(cells)) <= set("-: "):
                pass
            elif out["thanks_head"] is None:
                out["thanks_head"] = cells
            else:
                out["thanks"].append(cells)
        i += 1
    return out


def copy_block(text, cid, label):
    return (f'<div class="copy"><pre class="ss-code" id="{cid}">{esc(text)}</pre>'
            f'<button class="ss-button ss-button--primary" type="button" data-copy="{cid}">{esc(label)}</button></div>')


def recipe_section(r, idx):
    d = ROOT / r["dir"] / "promo" / "out"
    post = parse_post((d / "post.md").read_text())
    rid = re.sub(r"[^a-z0-9]+", "-", r["dir"].lower())
    parts = [f'<section class="recipe" id="{rid}">',
             f'<h2 class="ss-chapter"><span class="ss-chapter__no">{idx}</span>'
             f'<span class="ss-chapter__title">{esc(r["name"])}</span></h2>',
             f'<p class="meta"><span class="ss-pill ss-pill--info">{esc(r.get("status", "draft"))}</span>'
             f' <span class="ss-label">{len(post["posts"])} posts · repo folder {esc(r["dir"])}/</span></p>']
    if post["blocking"]:
        items = "".join(f"<li>{inline_md(b)}</li>" for b in post["blocking"])
        parts.append(f'<div class="ss-note ss-note--verify"><span class="ss-note__tag">Verify before posting</span>'
                     f'<div class="ss-note__body"><ul>{items}</ul></div></div>')
    stills = sorted(p for p in d.glob("*.png"))
    if stills:
        figs = []
        for p in stills:
            b64 = base64.b64encode(p.read_bytes()).decode()
            figs.append(f'<button class="thumb" type="button" data-full="{esc(p.name)}">'
                        f'<img src="data:image/png;base64,{b64}" alt="{esc(p.name)}" loading="lazy">'
                        f'<span class="ss-label">{esc(p.name)}</span></button>')
        parts.append('<h3 class="sub">Stills <span class="ss-label">tap to enlarge</span></h3>'
                     f'<div class="thumbs">{"".join(figs)}</div>')
    parts.append('<h3 class="sub">Thread</h3><div class="posts">')
    for k, p in enumerate(post["posts"], 1):
        cid = f"{rid}-p{k}"
        parts.append(f'<article class="post"><header class="posthead"><span class="ss-label">{esc(p["head"])}</span>'
                     f'<span class="count ss-label" data-for="{cid}"></span></header>'
                     f'{copy_block(p["text"], cid, "Copy post")}'
                     f'<p class="attach">{inline_md(p["attach"]) if p["attach"] else "No attachment."}</p></article>')
    parts.append("</div>")
    if post["alts"]:
        parts.append('<h3 class="sub">Alt text</h3><div class="posts">')
        for k, a in enumerate(post["alts"], 1):
            cid = f"{rid}-a{k}"
            parts.append(f'<article class="post"><header class="posthead"><span class="ss-label">{esc(a["name"])}</span></header>'
                         f'{copy_block(a["text"], cid, "Copy alt text")}</article>')
        parts.append("</div>")
    if post["thanks"]:
        head = "".join(f"<th>{esc(h)}</th>" for h in post["thanks_head"])
        rows = "".join("<tr>" + "".join(f"<td>{inline_md(c)}</td>" for c in row) + "</tr>" for row in post["thanks"])
        handles = " ".join(c for row in post["thanks"] for c in re.findall(r"@\w+", row[2] if len(row) > 2 else ""))
        parts.append('<h3 class="sub">Thanks and handles</h3>'
                     f'<div class="scroll"><table class="ss-table"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div>')
        if handles:
            parts.append(copy_block(handles, f"{rid}-handles", "Copy all verified handles"))
    sent = r.get("sent")
    if sent:
        files = "".join(f"<li><code>{esc(f)}</code></li>" for f in sent["files"])
        parts.append(f'<h3 class="sub">On your phone</h3><p class="attach">Sent over Taildrop {esc(sent["time"])}:</p>'
                     f'<ul class="files">{files}</ul>')
    parts.append("</section>")
    return "\n".join(parts)


LAYOUT = """<style>
/* layout only: one column of recipe sections, each with stills, post cards and tables */
.recipe { display: grid; gap: var(--space-4); padding-block: var(--space-6); border-top: var(--line-hair) solid var(--ink); }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: 0; }
.sub { font: var(--type-h3); margin: var(--space-4) 0 0; display: flex; gap: var(--space-2); align-items: baseline; flex-wrap: wrap; }
.thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: var(--space-4); }
.thumb { display: grid; gap: var(--space-2); padding: 0; border: 0; background: none; cursor: zoom-in; text-align: left; min-width: 0; }
.thumb img { width: 100%; height: auto; display: block; border: var(--line-hair) solid var(--rule); }
.thumb .ss-label { overflow-wrap: anywhere; }
.posts { display: grid; gap: var(--space-4); }
.post { display: grid; gap: var(--space-2); min-width: 0; }
.posthead { display: flex; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
.copy { display: grid; gap: var(--space-2); justify-items: start; min-width: 0; }
.copy pre { width: 100%; box-sizing: border-box; white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
.attach { font: var(--type-small); margin: 0; color: var(--ink-muted); }
.scroll { overflow-x: auto; }
.files { margin: 0; padding-left: var(--space-6); font: var(--type-small); }
.count.over { color: var(--vermilion); }
dialog.lb { padding: 0; border: var(--line-hair) solid var(--ink); background: var(--paper); max-width: min(96vw, 1600px); }
dialog.lb img { display: block; max-width: 100%; max-height: 86vh; height: auto; }
dialog.lb form { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-2); }
dialog.lb::backdrop { background: var(--ink); opacity: .7; }
</style>"""

SCRIPT = """<script>
(function () {
  function xlen(t) { /* X weighting: URLs count 23, CJK/emoji-ish count 2; arrows count 2 as X does */
    var n = 0, s = t.replace(/https?:\\/\\/\\S+/g, function () { n += 23; return ""; });
    for (var ch of s) { var c = ch.codePointAt(0); n += (c <= 0x10FF || (c >= 0x2000 && c <= 0x200D) || (c >= 0x2010 && c <= 0x201F) || (c >= 0x2032 && c <= 0x2037)) ? 1 : 2; }
    return n;
  }
  document.querySelectorAll(".count[data-for]").forEach(function (el) {
    var n = xlen(document.getElementById(el.dataset.for).textContent);
    el.textContent = n + " / 280"; if (n > 280) el.classList.add("over");
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]"); if (!b) return;
    var pre = document.getElementById(b.dataset.copy), label = b.textContent;
    function done(msg) { b.textContent = msg; setTimeout(function () { b.textContent = label; }, 1400); }
    function fallback() { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); done("Selected, press copy"); }
    try { navigator.clipboard.writeText(pre.textContent).then(function () { done("Copied"); }, fallback); } catch (err) { fallback(); }
  });
  var lb = document.getElementById("lb"), lbImg = document.getElementById("lb-img"), lbName = document.getElementById("lb-name");
  document.addEventListener("click", function (e) {
    var t = e.target.closest(".thumb"); if (!t) return;
    lbImg.src = t.querySelector("img").src; lbImg.alt = t.dataset.full; lbName.textContent = t.dataset.full;
    if (lb.showModal) lb.showModal();
  });
  lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
})();
</script>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--head", required=True, help="inlined tool recipe (secret-sauce tools/inline.py output)")
    ap.add_argument("--config", default=str(ROOT / "reports/launch-kit.json"))
    ap.add_argument("--out", default=str(ROOT / "reports/launch-kit.html"))
    a = ap.parse_args()
    cfg = json.loads(Path(a.config).read_text())
    src = Path(a.head).read_text()
    link = re.search(r'<link rel="stylesheet"[^>]+>', src).group(0)
    sauce = src[src.index("<style>"):src.index("</style>") + len("</style>")]
    secs = [recipe_section(r, i) for i, r in enumerate(cfg["recipes"], 1)]
    lockup = re.search(r'<div class="ss-lockup">.*?</div>', src, re.S).group(0)
    page = f"""<title>{esc(cfg["title"])}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<!-- sauce-lint surface: docs -->
{link}
{sauce}
{LAYOUT}
<div class="ss-body"><div class="ss-page">
<header class="ss-runhead"><span><b>3060-recipes</b> · trending batch 1</span><span>{len(cfg["recipes"])} packages</span></header>
<h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">{esc(cfg["title"])}</span></h1>
<p class="ss-lead">{esc(cfg.get("lead", ""))}</p>
{"".join(secs)}
<footer class="ss-foot">{lockup}<span class="ss-label">Built by scripts/launch_kit.py from each recipe's promo/out/post.md</span></footer>
</div></div>
<dialog class="lb" id="lb"><form method="dialog"><span class="ss-label" id="lb-name"></span><button class="ss-button" type="submit">Close</button></form><img id="lb-img" alt=""></dialog>
{SCRIPT}
"""
    Path(a.out).write_text(page)
    print(a.out, len(page), "bytes,", len(secs), "recipes")


if __name__ == "__main__":
    sys.exit(main())
