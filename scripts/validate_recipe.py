#!/usr/bin/env python3
"""Validate recipe.json files against schema/recipe.schema.json (standard library only).

    python3 scripts/validate_recipe.py                 # every recipe in the repo
    python3 scripts/validate_recipe.py community/my-recipe [more dirs or recipe.json files]
    python3 scripts/validate_recipe.py --findings      # also check findings/*.md frontmatter

Checks: types, required keys, enums, patterns, no unknown keys; every `source` path:line exists in
the repo and the line range is inside the file; the value appears near the cited line; credit ids
exist in site/data/credits.json; no private paths (/home/, /mnt/, e-mail addresses).
Exit 0 when clean, 1 on any error. Warnings do not fail.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = json.loads((ROOT / "schema/recipe.schema.json").read_text())
PRIVATE = re.compile(r"/home/|/mnt/|[\w.+-]+@[\w-]+\.[\w.]+|\.ts\.net")
TYPES = {"string": str, "integer": int, "number": (int, float), "boolean": bool, "object": dict, "array": list}


def check(node, schema, path, errs):
    t = schema.get("type")
    if "enum" in schema and node not in schema["enum"]:
        errs.append(f"{path}: {node!r} not one of {schema['enum']}")
        return
    if t:
        ts = t if isinstance(t, list) else [t]
        ok = any(isinstance(node, TYPES[x]) and not (x in ("integer", "number") and isinstance(node, bool)) for x in ts)
        if not ok:
            errs.append(f"{path}: expected {t}, got {type(node).__name__}")
            return
    if isinstance(node, str):
        if "pattern" in schema and not re.search(schema["pattern"], node):
            errs.append(f"{path}: {node!r} does not match {schema['pattern']}")
        if "maxLength" in schema and len(node) > schema["maxLength"]:
            errs.append(f"{path}: longer than {schema['maxLength']} characters ({len(node)})")
        if schema.get("format") == "date" and not re.match(r"^\d{4}-\d{2}-\d{2}$", node):
            errs.append(f"{path}: not a YYYY-MM-DD date")
    if isinstance(node, dict):
        for k in schema.get("required", []):
            if k not in node:
                errs.append(f"{path}: missing required key '{k}'")
        props = schema.get("properties", {})
        for k, v in node.items():
            if k in props:
                check(v, props[k], f"{path}.{k}", errs)
            elif schema.get("additionalProperties") is False:
                errs.append(f"{path}: unknown key '{k}'")
    if isinstance(node, list):
        if len(node) < schema.get("minItems", 0):
            errs.append(f"{path}: needs at least {schema['minItems']} item(s)")
        if "items" in schema:
            for i, v in enumerate(node):
                check(v, schema["items"], f"{path}[{i}]", errs)


def num_variants(v):
    if not isinstance(v, (int, float)):
        v = str(v)
        return [v, v.replace("-", "\u2013"), v.replace("-", "\u2013").replace(" ", ""), v.split("-")[0]]
    out = {f"{v:g}", f"{v:,.0f}", f"{v:.1f}", f"{v:.2f}", str(v)}
    if v >= 1000:
        out.add(f"{v:,.0f}".replace(",", " "))
    return [s for s in out if s]


def validate(path, credit_ids):
    errs, warns = [], []
    try:
        r = json.loads(path.read_text())
    except json.JSONDecodeError as ex:
        return [f"{path}: invalid JSON: {ex}"], []
    check(r, SCHEMA, "recipe", errs)
    if r.get("id") and r["id"] != path.parent.name:
        errs.append(f"recipe.id: '{r['id']}' must equal the folder name '{path.parent.name}'")
    for i, x in enumerate(r.get("results", [])):
        m = re.match(r"^(.+?):(\d+)(?:-(\d+))?$", str(x.get("source", "")))
        if not m:
            continue
        f = ROOT / m.group(1)
        if not f.is_file():
            errs.append(f"results[{i}].source: {m.group(1)} does not exist")
            continue
        lines = f.read_text(errors="ignore").splitlines()
        a, b = int(m.group(2)), int(m.group(3) or m.group(2))
        if a < 1 or b > len(lines) or a > b:
            errs.append(f"results[{i}].source: lines {a}-{b} outside {m.group(1)} ({len(lines)} lines)")
            continue
        window = "\n".join(lines[max(0, a - 4):b + 3]).replace(" ", " ")
        if not any(s in window for s in num_variants(x.get("value"))):
            warns.append(f"results[{i}] ({x.get('metric')} {x.get('value')}): value not found within 3 lines of {x['source']}")
    for c in r.get("credits", []):
        if credit_ids is not None and c not in credit_ids:
            errs.append(f"credits: '{c}' is not an id in site/data/credits.json")
    for fslug in r.get("findings", []):
        if not (ROOT / "findings" / f"{fslug}.md").is_file():
            errs.append(f"findings: findings/{fslug}.md does not exist")
    text = path.read_text()
    for mm in PRIVATE.finditer(text):
        errs.append(f"private detail: {text[max(0, mm.start() - 20):mm.end() + 20]!r}")
    if not (path.parent / "README.md").is_file():
        warns.append("no README.md next to recipe.json")
    return errs, warns


FM_KEYS = ["title", "date", "group", "recipes", "provenance", "provenance_note", "credit", "evidence", "applies_to"]
PROV = {"ours", "ours-measuring-others-work", "confirms", "independent-also-upstream"}
GROUPS = {"looped-moe", "experts-in-ram", "drafting", "disk-bound", "method", "box-and-harness", "quants"}


def validate_findings(recipe_ids):
    errs = []
    try:
        import yaml  # noqa: F401
    except ImportError:
        return ["--findings needs PyYAML (pip install pyyaml)"]
    import yaml
    for p in sorted((ROOT / "findings").glob("*.md")):
        if p.name.lower() == "readme.md":
            continue
        text = p.read_text()
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
        if not m:
            errs.append(f"{p.name}: no frontmatter")
            continue
        try:
            fm = yaml.safe_load(m.group(1))
        except yaml.YAMLError as ex:
            errs.append(f"{p.name}: bad YAML: {ex}")
            continue
        for k in FM_KEYS:
            if k not in fm:
                errs.append(f"{p.name}: missing '{k}'")
        if fm.get("provenance") not in PROV:
            errs.append(f"{p.name}: provenance {fm.get('provenance')!r}")
        if fm.get("group") not in GROUPS:
            errs.append(f"{p.name}: group {fm.get('group')!r}")
        for rid in fm.get("recipes") or []:
            if rid not in recipe_ids:
                errs.append(f"{p.name}: unknown recipe '{rid}'")
        for ev in fm.get("evidence") or []:
            f = ROOT / str(ev).split(":")[0]
            if not f.exists():
                errs.append(f"{p.name}: evidence {ev} does not exist")
        if PRIVATE.search(text):
            errs.append(f"{p.name}: private detail {PRIVATE.search(text).group(0)!r}")
        if len(m.group(2).split()) < 30:
            errs.append(f"{p.name}: body under 30 words")
    return errs


def main(argv):
    do_findings = "--findings" in argv
    args = [a for a in argv if not a.startswith("--")]
    cp = ROOT / "site/data/credits.json"
    credit_ids = {c["id"] for c in json.loads(cp.read_text())["credits"]} if cp.exists() else None
    if args:
        paths = [Path(a) / "recipe.json" if Path(a).is_dir() else Path(a) for a in args]
    else:
        paths = sorted(p for p in list(ROOT.glob("*/recipe.json")) + list(ROOT.glob("community/*/recipe.json")) if "_site" not in p.parts)
    bad = 0
    for p in paths:
        p = p.resolve()
        errs, warns = validate(p, credit_ids)
        rel = p.relative_to(ROOT) if p.is_relative_to(ROOT) else p
        print(f"{'FAIL' if errs else 'ok  '} {rel}" + (f"  ({len(warns)} warning{'s' if len(warns) != 1 else ''})" if warns else ""))
        for x in errs:
            print("   error:", x)
        for x in warns:
            print("   warn: ", x)
        bad += bool(errs)
    if do_findings:
        ids = {json.loads(p.read_text()).get("id") for p in ROOT.glob("*/recipe.json")} | {p.parent.name for p in ROOT.glob("community/*/recipe.json")}
        fe = validate_findings(ids)
        print(f"{'FAIL' if fe else 'ok  '} findings/ ({len(list((ROOT / 'findings').glob('*.md')))} files)")
        for x in fe:
            print("   error:", x)
        bad += bool(fe)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
