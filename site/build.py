#!/usr/bin/env python3
"""Build the 3060-recipes site into _site/.

Reads:  */recipe.json, community/*/recipe.json, findings/*.md, skills/*/SKILL.md,
        site/data/{credits,resources}.json, CONTRIBUTING.md, each recipe's README.md
Writes: HTML pages, a Markdown twin of every page, JSON indexes, llms.txt, llms-full.txt,
        AGENTS.md, sitemap.xml, robots.txt, feed.atom, skill folders and tarballs.

    python site/build.py            # build
    python site/build.py --check    # build, then fail on broken internal links or private paths
    SITE_BASE=/ SITE_URL=https://example.org python site/build.py   # custom domain
"""
import datetime, html, io, json, os, posixpath, re, shutil, sys, tarfile
from pathlib import Path

import markdown
import yaml

sys.path.insert(0, str(Path(__file__).parent))
import components as C  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"
BASE = os.environ.get("SITE_BASE", "/3060-recipes/")
ORIGIN = os.environ.get("SITE_URL", "https://davidghatley.github.io").rstrip("/")
SITE = ORIGIN + BASE
REPO = "https://github.com/davidghatley/3060-recipes"
RAW = "https://raw.githubusercontent.com/davidghatley/3060-recipes/main"
TITLE = "3060 Recipes"
TAGLINE = "Measured ways to run models far larger than 12 GB on one RTX 3060."
PRIVATE = re.compile(r"/home/|/mnt/|\.ts\.net|@me\.com|tailnet", re.I)

e = html.escape
C.BASE, C.REPO, C.SITE = BASE, REPO, SITE


def load_json(p):
    return json.loads(Path(p).read_text())


def md_html(text, link_base=None):
    """Markdown to HTML in house components; relative links point at the repo."""
    h = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists", "toc"],
                          extension_configs={"toc": {"permalink": False}})
    if link_base is not None:
        def fix(m):
            attr, url = m.group(1), m.group(2)
            if re.match(r"^(https?:|#|mailto:|/)", url):
                return m.group(0)
            path = posixpath.normpath(posixpath.join(link_base, url.split("#")[0]))
            frag = "#" + url.split("#")[1] if "#" in url else ""
            if attr == "src":
                return f'src="{RAW}/{path}"'
            kind = "tree" if (ROOT / path).is_dir() else "blob"
            return f'href="{REPO}/{kind}/main/{path}{frag}"'
        h = re.sub(r'(href|src)="([^"]+)"', fix, h)
    h = h.replace("<table>", '<div class="ss-table-wrap"><table class="ss-table">').replace("</table>", "</table></div>")
    h = re.sub(r"<pre><code[^>]*>", '<div class="ss-code"><pre>', h).replace("</code></pre>", "</pre></div>")
    return h


def neutral_paths(text):
    """Machine-specific paths in recipe READMEs become placeholders on the site."""
    text = re.sub(r"/mnt/models/llm/", "$MODELS/", text)
    text = re.sub(r"/mnt/scratch/", "$SCRATCH/", text)
    text = re.sub(r"/mnt/scratch\b", "$SCRATCH", text)
    text = re.sub(r"/mnt/[a-z]+/", "$DATA/", text)
    return re.sub(r"/home/[a-z]+/", "~/", text)


def frontmatter(path):
    text = Path(path).read_text()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return {}, text
    return yaml.safe_load(m.group(1)) or {}, m.group(2).strip()


# ---------------------------------------------------------------- data
def load():
    D = {}
    recipes = []
    for p in sorted(list(ROOT.glob("*/recipe.json")) + list(ROOT.glob("community/*/recipe.json"))):
        if "_site" in p.parts or ".venv" in p.parts:
            continue
        r = load_json(p)
        r["_dir"] = p.parent.relative_to(ROOT).as_posix()
        r["_community"] = r["_dir"].startswith("community/")
        readme = p.parent / "README.md"
        r["_readme"] = neutral_paths(readme.read_text()) if readme.exists() else ""
        recipes.append(r)
    recipes.sort(key=lambda r: (r["_community"], -C.headline_sort(r)))
    D["recipes"] = recipes

    findings = []
    for p in sorted((ROOT / "findings").glob("*.md")):
        if p.name.lower() == "readme.md":
            continue
        fm, body = frontmatter(p)
        fm["slug"] = p.stem
        fm["body"] = body
        fm["date"] = str(fm.get("date", ""))
        fm.setdefault("recipes", [])
        fm.setdefault("credit", [])
        fm.setdefault("evidence", [])
        findings.append(fm)
    findings.sort(key=lambda f: f["date"], reverse=True)
    D["findings"] = findings
    for r in recipes:
        r["_findings"] = [f for f in findings if r["id"] in f["recipes"]]

    cr = load_json(ROOT / "site/data/credits.json")
    D["credit_groups"], D["credits"] = cr["groups"], cr["credits"]
    D["credit_by_id"] = {c["id"]: c for c in D["credits"]}
    D["resources"] = load_json(ROOT / "site/data/resources.json")["resources"]

    roles = {"find-3060-recipe": "use", "gpu-queue": "use", "submit-3060-recipe": "make", "model-recipe": "make",
             "research-licence-gate": "make", "upstream-contribution": "share", "promo-package": "share", "dense-status-image": "share"}
    order = list(roles)
    skills = []
    for p in sorted((ROOT / "skills").glob("*/SKILL.md"), key=lambda p: (order.index(p.parent.name) if p.parent.name in order else 99, p.parent.name)):
        fm, body = frontmatter(p)
        files = sorted(f.relative_to(p.parent).as_posix() for f in p.parent.rglob("*") if f.is_file())
        skills.append({"name": fm.get("name", p.parent.name), "dir": p.parent.name, "description": fm.get("description", ""),
                       "role": roles.get(p.parent.name, "make"), "body": body, "files": files, "raw": p.read_text()})
    D["skills"] = skills
    D["external_skills"] = load_json(ROOT / "site/data/external-skills.json")["skills"]
    D["today"] = datetime.date.today().isoformat()
    D["updated"] = max([r["updated"] for r in recipes] + [f["date"] for f in findings] + ["2026-01-01"])
    return D


# ---------------------------------------------------------------- output helpers
PAGES = []  # (url_path, title, updated)


def write(rel, text):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text if isinstance(text, str) else json.dumps(text, indent=2, ensure_ascii=False) + "\n")


def page(path, title, desc, body, md, D, nav=None, jsonld=None, updated=None):
    """path '' is home, otherwise 'recipes/flint' (no slashes at the ends)."""
    url = SITE + (path + "/" if path else "")
    md_rel = (path + "/index.md") if path else "index.md"
    full_title = TITLE if not path else f"{title} · {TITLE}"
    ld = ""
    for obj in (jsonld or []):
        ld += '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>\n"
    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(full_title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<link rel="alternate" type="text/markdown" href="{BASE}{md_rel}" title="This page as Markdown">
<link rel="alternate" type="application/json" href="{BASE}recipes.json" title="All recipes as JSON">
<link rel="alternate" type="application/atom+xml" href="{BASE}feed.atom" title="New recipes and findings">
<link rel="help" type="text/plain" href="{BASE}llms.txt" title="Map of this site for language models">
<meta property="og:type" content="{'website' if not path else 'article'}">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{BASE}assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="{BASE}assets/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="{BASE}assets/apple-touch-icon.png">
<!-- sauce-lint surface: docs --><!-- sauce-lint allow font-face: Hopscotch (titles) and Tick 35 (word labels, 16 px) are foundry faces chosen by David for this site -->
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@1,6..72,400&display=swap">
<link rel="stylesheet" href="{BASE}assets/tokens.css">
<link rel="stylesheet" href="{BASE}assets/components.css">
<link rel="stylesheet" href="{BASE}assets/site.css">
{ld}</head>
<body class="ss-body">
<a class="skip" href="#main">Skip to content</a>
<div class="ss-page">
{C.nav(nav or path.split('/')[0])}
<main id="main" class="main">
{body}
</main>
{C.footer(md_rel, D)}
</div>
<script src="{BASE}assets/site.js" defer></script>
</body>
</html>
"""
    write((path + "/index.html") if path else "index.html", doc)
    md = md.strip() + "\n"
    write(md_rel, md)
    if path:
        write(path + ".md", md)
    PAGES.append((path, title, updated or D["updated"]))


def gh(src):
    """'flint/RESULTS.md:15-18' to a GitHub URL."""
    m = re.match(r"^(.+?):(\d+)(?:-(\d+))?$", src)
    if not m:
        return f"{REPO}/blob/main/{src}"
    frag = f"#L{m.group(2)}" + (f"-L{m.group(3)}" if m.group(3) else "")
    return f"{REPO}/blob/main/{m.group(1)}{frag}"


C.gh = gh
C.md_html = md_html


# ---------------------------------------------------------------- markdown twins
def recipe_md(r, D):
    L = [f"# {r['title']}", "", r["summary"], "",
         f"- Recipe id: `{r['id']}`  ·  status: {r['status']}  ·  updated {r['updated']}",
         f"- Model: [{r['model']['name']}](https://huggingface.co/{r['model']['hf_repo']}) ({r['model'].get('params', '')} {r['model']['architecture']})".replace("( ", "("),
         f"- Weights: {r['weights']['format']} {r['weights']['quant']}" + (f", {r['weights']['size_gb']} GB" if r['weights'].get('size_gb') else "") + f", from {r['weights']['source']}" + (f", file `{r['weights']['file']}`" if r['weights'].get('file') else "") + (f", revision `{r['weights']['revision']}`" if r['weights'].get('revision') else ""),
         f"- Engine: [{r['engine']['name']}]({r['engine']['repo']}) {r['engine']['version']}" + (f"; patches: {'; '.join(r['engine']['patches'])}" if r['engine'].get('patches') else "") + (f"; CUDA {r['engine']['cuda']}" if r['engine'].get('cuda') else ""),
         f"- Hardware: {r['hardware']['gpu']} {r['hardware']['vram_gb']:g} GB, {r['hardware']['ram_gb']:g} GB RAM, {r['hardware']['cpu']}" + (f", {r['hardware']['disk']}" if r['hardware'].get('disk') else ""),
         f"- Context: {r['context_tokens']:,} tokens",
         f"- Placement: {r['placement']}",
         f"- Contributor: [{r['contributor']['name']}](https://github.com/{r['contributor']['github']})",
         "", "## Run it", "", f"From `{r['_dir']}/` in a clone of {REPO}:", "", "```sh", r["serve"]["command"], "```", ""]
    if r["serve"].get("api"):
        L += [f"API: {r['serve']['api']}" + (f" on port {r['serve']['port']}" if r['serve'].get('port') else ""), ""]
    if r["serve"].get("key_flags"):
        L += ["Key flags: " + ", ".join(f"`{f}`" for f in r["serve"]["key_flags"]), ""]
    sp = ROOT / r["_dir"] / r["serve"].get("script", "serve.sh")
    if sp.exists():
        L += [f"The script itself (`{r['_dir']}/{sp.name}`, machine paths shown as `$MODELS`, `$SCRATCH`, `~`; "
              f"set them to where your weights and builds live):", "", "```sh", neutral_paths(sp.read_text()).strip(), "```", ""]
    L += ["## Measured results", "", "| Metric | Conditions | Value | Stock | Ceiling | Source |", "|---|---|---|---|---|---|"]
    for x in r["results"]:
        L.append(f"| {x['metric']} | {x.get('label', '')} | {x['value']} {x['unit']} | {x.get('baseline', '')} | {x.get('ceiling', '')} | [{x['source']}]({gh(x['source'])}) |")
    if r.get("caveats"):
        L += ["", "## Caveats", ""] + [f"- {c}" for c in r["caveats"]]
    if r["_findings"]:
        L += ["", "## Findings from this recipe", ""] + [f"- [{f['title']}]({SITE}findings/{f['slug']}.md)" for f in r["_findings"]]
    if r.get("credits"):
        L += ["", "## Credits", ""]
        for cid in r["credits"]:
            c = D["credit_by_id"].get(cid)
            if c:
                L.append(f"- {c['name']}: {c['used_for']}" + (f" ({c['links'][0]['url']})" if c.get("links") else ""))
    reps = r.get("reproductions", [])
    L += ["", "## Reproductions", ""]
    L += [f"- {x['date']} @{x['github']} on {x['hardware']}: decode {x['decode']} tok/s" for x in reps] or [f"None yet. Ran it on your own 3060? Report your numbers: {REPO}/issues/new?template=reproduction.yml"]
    L += ["", "## Machine-readable", "", f"- {SITE}recipes/{r['id']}/recipe.json", f"- Folder with scripts and raw runs: {REPO}/tree/main/{r['_dir']}",
          f"- Full results log: {RAW}/{r['_dir']}/RESULTS.md"]
    if r["_readme"]:
        body = re.sub(r"^# .*\n", "", r["_readme"], count=1).strip()
        body = re.sub(r"^(#{1,5}) ", lambda m: "#" + m.group(1) + " ", body, flags=re.M)
        L += ["", "## Full write-up (README)", "", body]
    return "\n".join(L)


def finding_md(f):
    return "\n".join([f"# {f['title']}", "", f"- Date: {f['date']}", f"- Provenance: {C.PROV[f['provenance']][0]}. {f.get('provenance_note', '')}",
                      f"- Recipes: {', '.join(f['recipes']) or 'none'}", f"- Builds on: {', '.join(f['credit']) or 'nothing external'}",
                      f"- Applies to: {f.get('applies_to', '')}",
                      "- Evidence: " + ", ".join(f"[{x}]({gh(x)})" for x in f["evidence"]), "", f["body"]])


# ---------------------------------------------------------------- build
def build():
    D = load()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ROOT / "site/assets", OUT / "assets")
    write(".nojekyll", "")
    R, F = D["recipes"], D["findings"]

    # ---- home
    body, md = C.home(D)
    page("", TITLE, TAGLINE + " Exact files, flags and numbers, readable by people and by agents.", body, md, D, nav="",
         jsonld=[{"@context": "https://schema.org", "@type": "WebSite", "name": TITLE, "url": SITE, "description": TAGLINE,
                  "author": {"@type": "Person", "name": "David Hatley", "url": "https://github.com/davidghatley"}},
                 {"@context": "https://schema.org", "@type": "Dataset", "name": "3060-recipes measured results",
                  "description": "Measured decode and prefill speeds, memory peaks and exact serve commands for large language models on one NVIDIA RTX 3060 12 GB.",
                  "url": SITE, "license": "https://creativecommons.org/licenses/by/4.0/", "creator": {"@type": "Person", "name": "David Hatley"},
                  "distribution": [{"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": SITE + "recipes.json"}]}])

    # ---- recipes
    body, md = C.recipes_index(D)
    page("recipes", "Recipes", "Every measured recipe for the 12 GB RTX 3060, with model, quant, context, engine and speed.", body, md, D)
    for r in R:
        body = C.recipe_page(r, D)
        public = {k: v for k, v in r.items() if not k.startswith("_")}
        public["$schema"] = SITE + "schema/recipe.schema.json"
        public["url"] = f"{SITE}recipes/{r['id']}/"
        public["folder"] = f"{REPO}/tree/main/{r['_dir']}"
        write(f"recipes/{r['id']}/recipe.json", public)
        hl = C.headline(r, "decode")
        ld = {"@context": "https://schema.org", "@type": "TechArticle", "headline": r["title"], "description": r["summary"],
              "url": f"{SITE}recipes/{r['id']}/", "dateModified": r["updated"], "license": "https://creativecommons.org/licenses/by/4.0/",
              "author": {"@type": "Person", "name": r["contributor"]["name"], "url": f"https://github.com/{r['contributor']['github']}"},
              "about": [{"@type": "SoftwareApplication", "name": r["model"]["name"], "url": f"https://huggingface.co/{r['model']['hf_repo']}"},
                        {"@type": "SoftwareApplication", "name": r["engine"]["name"], "url": r["engine"]["repo"]},
                        {"@type": "Product", "name": "NVIDIA GeForce RTX 3060 12 GB"}],
              "proficiencyLevel": "Expert", "dependencies": f"{r['engine']['name']} {r['engine']['version']}"}
        if hl:
            ld["abstract"] = f"{hl['value']} {hl['unit']} decode at {r['context_tokens']:,} tokens of context on one RTX 3060 12 GB."
        page(f"recipes/{r['id']}", r["title"], r["summary"], body, recipe_md(r, D), D, nav="recipes", jsonld=[ld], updated=r["updated"])

    # ---- findings
    body, md = C.findings_index(D)
    page("findings", "Findings", "What running oversized models on one RTX 3060 taught us, with evidence and honest provenance.", body, md, D)
    for f in F:
        page(f"findings/{f['slug']}", f["title"], f["body"].split("\n")[0][:200], C.finding_page(f, D), finding_md(f), D, nav="findings", updated=f["date"],
             jsonld=[{"@context": "https://schema.org", "@type": "TechArticle", "headline": f["title"], "datePublished": f["date"],
                      "url": f"{SITE}findings/{f['slug']}/", "author": {"@type": "Person", "name": "David Hatley"},
                      "license": "https://creativecommons.org/licenses/by/4.0/"}])

    # ---- skills
    body, md = C.skills_index(D)
    page("skills", "Skills", "Agent skills for finding, reproducing, making and submitting RTX 3060 recipes. Plain Markdown, any harness.", body, md, D)
    for s in D["skills"]:
        src = ROOT / "skills" / s["dir"]
        shutil.copytree(src, OUT / "skills" / s["dir"], dirs_exist_ok=True)
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tf:
            for fn in s["files"]:
                ti = tf.gettarinfo(str(src / fn), arcname=f"{s['dir']}/{fn}")
                ti.mtime, ti.uid, ti.gid, ti.uname, ti.gname = 0, 0, 0, "", ""
                with open(src / fn, "rb") as fh:
                    tf.addfile(ti, fh)
        (OUT / "skills" / f"{s['dir']}.tar.gz").write_bytes(buf.getvalue())
        page(f"skills/{s['dir']}", s["name"], s["description"][:300], C.skill_page(s, D), s["raw"], D, nav="skills")
    write("skills/index.json", {"$schema": SITE + "schema/skills.schema.json", "install": "Copy a skill folder into your harness's skills directory, or read SKILL.md by URL.",
                                "skills": [{"name": s["name"], "description": s["description"], "role": s["role"],
                                            "skill_md": f"{SITE}skills/{s['dir']}/SKILL.md", "tarball": f"{SITE}skills/{s['dir']}.tar.gz",
                                            "files": [f"{SITE}skills/{s['dir']}/{fn}" for fn in s["files"]], "license": "MIT"} for s in D["skills"]],
                                "external": D["external_skills"]})

    # ---- contribute, thanks, resources, about
    contrib = (ROOT / "CONTRIBUTING.md").read_text()
    page("contribute", "Contribute", "Anyone with a 12 GB RTX 3060 can submit a recipe or report their numbers for an existing one.", C.contribute(contrib, D), contrib, D)
    body, md = C.thanks(D)
    page("thanks", "Thanks", "The people and projects these recipes stand on: model authors, quantizers, engines, methods and platforms.", body, md, D)
    body, md = C.resources(D)
    page("resources", "Resources", "Engines, methods, registries, APIs and scripts used to make and measure these recipes.", body, md, D)
    body, md = C.about(D)
    page("about", "About", "The bench, the method, and how to support this work.", body, md, D)
    write("404.html", (OUT / "about/index.html").read_text().split('<main')[0] + f'<main id="main" class="main"><h1 class="ss-mast ss-mast--m"><span class="ss-mast__x">404</span><span class="ss-mast__c">Not on the bench</span></h1><p class="ss-lead">That page does not exist. The <a href="{BASE}recipes/">recipe list</a> and <a href="{BASE}llms.txt">llms.txt</a> map everything that does.</p></main></div></body></html>')

    # ---- machine indexes
    def slim(r):
        d = C.headline(r, "decode") or {}
        p = C.headline(r, "prefill") or {}
        return {"id": r["id"], "title": r["title"], "summary": r["summary"], "status": r["status"], "updated": r["updated"],
                "use_cases": r.get("use_cases", []), "model": r["model"], "quant": r["weights"]["quant"], "context_tokens": r["context_tokens"],
                "engine": f"{r['engine']['name']} {r['engine']['version']}", "hardware": r["hardware"], "placement": r["placement"],
                "decode_tok_s": d.get("value"), "decode_stock_tok_s": d.get("baseline"), "decode_conditions": d.get("label"),
                "prefill_tok_s": p.get("value"), "prefill_stock_tok_s": p.get("baseline"), "prefill_conditions": p.get("label"),
                "serve_command": r["serve"]["command"], "community": r["_community"], "contributor": r["contributor"]["github"],
                "reproductions": len(r.get("reproductions", [])),
                "url": f"{SITE}recipes/{r['id']}/", "markdown": f"{SITE}recipes/{r['id']}.md", "json": f"{SITE}recipes/{r['id']}/recipe.json",
                "folder": f"{REPO}/tree/main/{r['_dir']}"}
    write("recipes.json", {"$schema": SITE + "schema/recipes-index.schema.json", "name": TITLE, "description": TAGLINE, "updated": D["updated"],
                           "license": "CC-BY-4.0", "source": REPO, "hardware_class": "NVIDIA GeForce RTX 3060, 12 GB VRAM",
                           "how_to_use": "Pick by use_cases and context_tokens. Fetch `json` for every number with its source line, or `markdown` for the full recipe. Speeds were measured at the stated conditions; compare like with like.",
                           "recipes": [slim(r) for r in R]})
    write("findings.json", {"name": "3060-recipes findings", "updated": D["updated"], "license": "CC-BY-4.0",
                            "provenance_values": {k: v[1] for k, v in C.PROV.items()},
                            "findings": [{k: f.get(k) for k in ("slug", "title", "date", "group", "recipes", "provenance", "provenance_note", "credit", "evidence", "applies_to", "body")}
                                         | {"url": f"{SITE}findings/{f['slug']}/", "markdown": f"{SITE}findings/{f['slug']}.md"} for f in F]})
    write("credits.json", {"groups": D["credit_groups"], "credits": D["credits"]})
    shutil.copytree(ROOT / "schema", OUT / "schema")

    agents = C.agents_md(D)
    write("AGENTS.md", agents)
    write("llms.txt", C.llms_txt(D, agents))
    full = [f"# {TITLE}: full text", "", f"> {TAGLINE} Generated {D['today']} from {REPO}. License: CC BY 4.0 (text, results), MIT (code, skills).", "", agents]
    for r in R:
        full += ["", "---", "", recipe_md(r, D)]
    full += ["", "---", "", "# Findings"]
    for f in F:
        full += ["", "---", "", finding_md(f).replace("# ", "## ", 1)]
    write("llms-full.txt", "\n".join(full) + "\n")

    # ---- sitemap, robots, feed
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, _, upd in PAGES:
        sm.append(f"<url><loc>{SITE}{path + '/' if path else ''}</loc><lastmod>{upd}</lastmod></url>")
    for extra in ("llms.txt", "llms-full.txt", "recipes.json", "findings.json", "AGENTS.md"):
        sm.append(f"<url><loc>{SITE}{extra}</loc><lastmod>{D['updated']}</lastmod></url>")
    write("sitemap.xml", "\n".join(sm) + "\n</urlset>\n")
    bots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User",
            "Google-Extended", "Applebot-Extended", "CCBot", "Amazonbot", "meta-externalagent", "DuckAssistBot", "MistralAI-User"]
    write("robots.txt", "# Everything here is meant to be read by agents and crawlers. Start at llms.txt.\n"
          + "".join(f"User-agent: {b}\nAllow: /\n\n" for b in bots) + f"User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n# Map for language models: {SITE}llms.txt\n")
    items = [(r["updated"], f"Recipe: {r['title']}", f"{SITE}recipes/{r['id']}/", r["summary"]) for r in R] + \
            [(f["date"], f"Finding: {f['title']}", f"{SITE}findings/{f['slug']}/", f["body"].split("\n")[0]) for f in F]
    items.sort(reverse=True)
    feed = [f'<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>{TITLE}</title><id>{SITE}</id><link href="{SITE}"/><link rel="self" href="{SITE}feed.atom"/><updated>{D["updated"]}T00:00:00Z</updated><author><name>David Hatley</name></author>']
    for d, t, u, s in items[:60]:
        feed.append(f"<entry><title>{e(t)}</title><id>{u}</id><link href=\"{u}\"/><updated>{d}T00:00:00Z</updated><summary>{e(s)}</summary></entry>")
    write("feed.atom", "\n".join(feed) + "\n</feed>\n")

    # ---- component sheet (design review; not linked from the nav)
    write("components/index.html", C.sheet(D))
    return D


def check():
    bad = []
    files = {p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file()}
    for p in OUT.rglob("*"):
        if not p.is_file() or p.suffix not in (".html", ".md", ".txt", ".json", ".xml", ".atom"):
            continue
        text = p.read_text(errors="ignore")
        rel = p.relative_to(OUT).as_posix()
        if PRIVATE.search(text) and not rel.startswith("assets/"):
            for m in PRIVATE.finditer(text):
                bad.append(f"private detail in {rel}: ...{text[max(0, m.start() - 30):m.end() + 30]!r}")
                break
        if p.suffix == ".html":
            for url in re.findall(r'(?:href|src)="([^"]+)"', text):
                if not url.startswith(BASE):
                    continue
                t = url[len(BASE):].split("#")[0].split("?")[0]
                if t == "" or t.endswith("/"):
                    t += "index.html"
                if t not in files:
                    bad.append(f"broken link in {rel}: {url}")
    for b in sorted(set(bad)):
        print("CHECK:", b)
    print(f"{len(files)} files, {len(PAGES)} pages, {len(set(bad))} problems")
    return 1 if bad else 0


if __name__ == "__main__":
    build()
    sys.exit(check() if "--check" in sys.argv else 0)
