"""../promo-data.json -> src/data.json for the promo.  Run from anywhere:  python3 -I tools/prep.py

The tuning run writes its headline numbers to inkling-2-mini/promo-data.json. This script reads that file,
matches its keys against the aliases below (key names are normalised: lower case, letters and digits only,
nested keys joined), and writes src/data.json. Anything missing or null stays null, and the video shows
a placeholder dash for it plus DRAFT in every plate header. Nothing here makes up a number.

Model facts that come from the model card rather than a run (size, loop, licence) live in MODEL below.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(HERE), 'promo-data.json')
DST = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'src', 'data.json')

# From the Thinking Machines model card (via the recipe brief), not from a run.
MODEL = {
    "name": "Inkling-2-Mini", "maker": "Thinking Machines", "total_b": 26.4, "active_b": 3.4,
    "loop_first": 6, "loop_last": 17, "loop_times": 3, "layers": 24,
    "attention": "sliding + global", "ctx_max": "1M", "inputs": "text + image", "license": "Apache-2.0",
    "needs_gb": 32, "src": "Thinking Machines model card (Inkling-2-Mini, 2026-11-20); 24 physical layers from the GGUF header (../THEORY.md)",
}

# target -> normalised aliases, first hit wins. Extend a list when the tuning run picks another name.
ALIAS = {
    "baseline_tps": ["baselinetoks", "baselinetps", "baselinetg", "baselinedecode", "baselinedecodetoks", "baselinedecodetps",
                     "baselinetgtoks", "stocktoks", "stocktps", "stocktg", "stockdecode", "decodebaseline", "tgbaseline",
                     "baseline", "decodestock", "tgstock", "beforetoks", "beforetps"],
    "tuned_tps": ["tunedtoks", "tunedtps", "tunedtg", "tuneddecode", "tuneddecodetoks", "tuneddecodetps", "tunedtgtoks",
                  "decodetuned", "tgtuned", "tuned", "besttoks", "besttps", "aftertoks", "aftertps", "finaltoks", "finaltps"],
    "speedup": ["speedup", "speedupx", "decodespeedup", "tgspeedup", "speedupdecode", "gain", "ratio"],
    "prefill_tps": ["prefilltoks", "prefilltps", "prefill", "tunedprefill", "tunedprefilltoks", "tunedprefilltps", "pp",
                    "pptoks", "pptps", "prefilltuned", "pptuned", "tunedpp"],
    "baseline_prefill_tps": ["baselineprefill", "baselineprefilltoks", "baselineprefilltps", "prefillbaseline", "baselinepp",
                             "ppbaseline", "stockprefill", "stockpp"],
    "prefill_prompt": ["prefillprompt", "prefilltokens", "prompttokens", "ppprompt", "prefillctx", "prefillat"],
    "ctx": ["context", "ctx", "contexttokens", "ctxtokens", "nctx", "contextlength", "ctxlen", "tunedctx", "tunedcontext"],
    "vram_gib": ["vramgib", "vramgb", "vram", "vramused", "vramusedgib", "vramusedgb", "tunedvram", "tunedvramgib", "vrampeak",
                 "vrampeakgib", "peakvram", "peakvramgib"],
    "vram_mib": ["vrammib", "vramusedmib", "tunedvrammib", "vrampeakmib", "peakvrammib"],
    "ram_gib": ["ramgib", "ramgb", "ram", "rampeak", "rampeakgib", "ramused", "ramusedgib", "hostram", "hostramgib"],
    "quant": ["quant", "quantization", "quantisation", "quanttype", "ggufquant", "tunedquant"],
    "gguf": ["gguf", "ggufname", "gguffile", "modelfile", "ggufpath", "modelpath"],
    "file_gb": ["filegb", "filegib", "ggufgb", "ggufgib", "sizegb", "sizegib", "weightsgb"],
    "kld": ["kld", "meankld", "kldmean", "kl", "kldivergence", "kldvsbf16", "kldbf16", "kldvsf16"],
    "kld_ref": ["kldref", "kldreference", "kldvs", "kldbaseline"],
    "build": ["build", "llamacppbuild", "llamabuild", "enginebuild"],
    "flags": ["flags", "keyflags", "tunedflags", "flagsnew", "flagstuned"],
    "cmd": ["cmd", "command", "servecmd", "servecommand", "tunedcmd", "tunedcommand"],
}


def norm(k):
    return re.sub(r"[^a-z0-9]", "", k.lower())


def flatten(d, pre=""):
    out = {}
    if isinstance(d, dict):
        for k, v in d.items():
            p = f"{pre}_{k}" if pre else str(k)
            if isinstance(v, dict) and not {"flag", "name"} & set(v):
                out.update(flatten(v, p))
            out[norm(p)] = v
    return out


def num(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"-?\d[\d,]*\.?\d*", str(v))
    return float(m.group(0).replace(",", "")) if m else None


def ctx_tokens(v):
    if v is None:
        return None
    if isinstance(v, str):
        m = re.match(r"\s*([\d.]+)\s*([kKmM]?)", v)
        if not m:
            return None
        n = float(m.group(1)) * {"": 1, "k": 1024, "m": 1024 * 1024}[m.group(2).lower()]
        return int(n)
    return int(v)


def flags_list(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = [s for s in re.split(r"\s+(?=--?[a-zA-Z])", v.strip()) if s]
    rows = []
    for x in v:
        if isinstance(x, str):
            rows.append({"flag": x, "note": None})
        elif isinstance(x, dict):
            f = x.get("flag") or x.get("name") or x.get("args")
            note = next((x[k] for k in ("gain", "effect", "delta", "note", "why", "what") if x.get(k) not in (None, "")), None)
            if f:
                rows.append({"flag": str(f), "note": None if note is None else str(note)})
    return rows or None


def cmd_lines(v):
    if v is None:
        return None
    if isinstance(v, list):
        return [str(s) for s in v]
    return [s.strip() for s in re.split(r"\\\n|\n", str(v)) if s.strip()]


raw = {}
if os.path.exists(SRC):
    try:
        raw = json.load(open(SRC))
    except json.JSONDecodeError as e:
        print(f"prep: {SRC} is not valid JSON yet ({e}); rendering placeholders", file=sys.stderr)
flat = flatten(raw)
got, used = {}, {}
for key, names in ALIAS.items():
    for n in names:
        if n in flat and flat[n] not in (None, "", []) and not isinstance(flat[n], dict):
            got[key] = flat[n]
            used[key] = n
            break

r = {
    "baseline_tps": num(got.get("baseline_tps")),
    "tuned_tps": num(got.get("tuned_tps")),
    "speedup": num(got.get("speedup")),
    "prefill_tps": num(got.get("prefill_tps")),
    "baseline_prefill_tps": num(got.get("baseline_prefill_tps")),
    "prefill_prompt": ctx_tokens(got.get("prefill_prompt")) if got.get("prefill_prompt") is not None else None,
    "ctx": ctx_tokens(got.get("ctx")),
    "vram_gib": num(got.get("vram_gib")),
    "ram_gib": num(got.get("ram_gib")),
    "quant": got.get("quant"),
    "gguf": got.get("gguf"),
    "file_gb": num(got.get("file_gb")),
    "kld": num(got.get("kld")),
    "kld_ref": got.get("kld_ref"),
    "build": got.get("build"),
    "flags": flags_list(got.get("flags")),
    "cmd": cmd_lines(got.get("cmd")),
}
if r["vram_gib"] is None and got.get("vram_mib") is not None:
    r["vram_gib"] = num(got["vram_mib"]) / 1024
elif r["vram_gib"] is not None and r["vram_gib"] > 100:  # a MiB value under a GiB-ish name
    r["vram_gib"] /= 1024
if r["speedup"] is None and r["baseline_tps"] and r["tuned_tps"]:
    r["speedup"] = r["tuned_tps"] / r["baseline_tps"]
    used["speedup"] = "tuned_tps / baseline_tps"
for k in ("quant", "gguf", "build", "kld_ref"):
    if r[k] is not None:
        r[k] = str(r[k])
# short labels for the screen: "llama.cpp master 29b52d398 (CUDA 12.9)" -> "master 29b52d398"; "Q8_0 (ggml-org), ..." -> "Q8_0"
if r["build"]:
    r["build"] = re.sub(r"^\s*llama\.?cpp\s*", "", r["build"], flags=re.I).split("(")[0].strip() or None
if r["kld_ref"]:
    r["kld_ref"] = re.split(r"[ ,(]", r["kld_ref"].strip())[0]
if raw.get("layers") is not None or flat.get("modellayers") is not None or flat.get("nlayers") is not None:
    MODEL["layers"] = int(num(raw.get("layers") or flat.get("modellayers") or flat.get("nlayers")))

# The headline set: these decide DRAFT vs MEASURED in the plate headers.
HEADLINE = ["baseline_tps", "tuned_tps", "speedup", "prefill_tps", "ctx", "vram_gib", "quant", "kld", "flags"]
missing = [k for k in HEADLINE if r[k] is None]
out = {
    "status": "draft" if missing else "measured",
    "missing": missing,
    "matched": used,
    "src": "../promo-data.json" if raw else "none yet (../promo-data.json missing or empty)",
    "model": MODEL,
    "hw": {"gpu": "RTX 3060 12 GB", "cpu": "i5-12500", "ram": "62 GB DDR5"},
    "engine": {"name": "llama.cpp", "pr": "#32694", "pr_author": "pcuenca", "build": r.pop("build")},
    "run": r,
}
os.makedirs(os.path.dirname(DST), exist_ok=True)
json.dump(out, open(DST, "w"), indent=1)
unknown = sorted(k for k in flat if k not in used.values() and not isinstance(flat[k], dict))
print(f"prep: {out['status']}; matched {len(used)} keys", file=sys.stderr)
print(f"prep: placeholders for: {', '.join(missing) or 'none'}", file=sys.stderr)
if unknown:
    print(f"prep: keys in promo-data.json not used: {', '.join(unknown)}", file=sys.stderr)

# copy.md -> out/copy-filled.md: known numbers replace their {{tokens}}; unknown ones stay as tokens.
COPY = os.path.join(HERE, "copy.md")
if os.path.exists(COPY) and len(sys.argv) <= 2:
    def ctxs(n):
        return None if n is None else (f"{n / 1048576:g}M" if n >= 1048576 else f"{round(n / 1024)}k")
    fill = {
        "tuned_tps": None if r["tuned_tps"] is None else f"{r['tuned_tps']:.1f}",
        "baseline_tps": None if r["baseline_tps"] is None else f"{r['baseline_tps']:.1f}",
        "speedup": None if r["speedup"] is None else f"{r['speedup']:.1f}x",
        "prefill_tps": None if r["prefill_tps"] is None else f"{r['prefill_tps']:,.0f}",
        "ctx": ctxs(r["ctx"]),
        "vram_gib": None if r["vram_gib"] is None else f"{r['vram_gib']:.1f}",
        "quant": r["quant"],
        "kld": None if r["kld"] is None else f"{r['kld']:.3f}",
        "flags": None if not r["flags"] else "\n".join(f"- `{f['flag']}`" + (f" ({f['note']})" if f["note"] else "") for f in r["flags"]),
    }
    text = open(COPY).read()
    for k, v in fill.items():
        if v is not None:
            text = text.replace("{{" + k + "}}", v)
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    open(os.path.join(HERE, "out", "copy-filled.md"), "w").write(text)
    left = sorted(set(re.findall(r"\{\{(\w+)\}\}", text.split("---", 1)[1] if "---" in text else text)))
    print(f"prep: out/copy-filled.md written; tokens still open: {', '.join(left) or 'none'}", file=sys.stderr)
