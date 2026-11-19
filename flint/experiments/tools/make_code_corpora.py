"""Build code corpora for the routing-skew measurement (python -I make_code_corpora.py OUTDIR).
A: Python stdlib set 1, B: Python stdlib set 2 (disjoint files), C: C/C++ from llama.cpp/ggml. ~130 KB each (~35k tokens)."""
import os, sys
out = sys.argv[1]
LIB = os.path.dirname(os.__file__)
SRC = "/mnt/scratch/src/llama.cpp-flint"
sets = {
  "A-py1": [os.path.join(LIB, f) for f in ["argparse.py", "textwrap.py", "difflib.py", "inspect.py", "typing.py", "subprocess.py", "tarfile.py"]],
  "B-py2": [os.path.join(LIB, f) for f in ["shutil.py", "tempfile.py", "datetime.py", "pickle.py", "doctest.py", "unittest/case.py", "asyncio/base_events.py", "http/client.py", "configparser.py"]],
  "C-cpp": [os.path.join(SRC, f) for f in ["src/llama-quant.cpp", "src/llama-context.cpp", "ggml/src/ggml-backend.cpp", "src/llama-kv-cache.cpp", "common/sampling.cpp"]],
}
LIMIT = 130_000
for name, files in sets.items():
    text = ""
    for p in files:
        if os.path.exists(p) and len(text) < LIMIT:
            text += f"\n// ==== {os.path.basename(p)}\n" + open(p, encoding="utf-8", errors="replace").read()
    text = text[:LIMIT]
    with open(os.path.join(out, f"code-{name}.txt"), "w") as f:
        f.write(text)
    print(name, len(text))
