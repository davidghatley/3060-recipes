"""Static-hot-set hit rate at given cache fractions: experts ranked on file A (per layer), hits measured on file B.
    python -I static_cache.py A.gguf B.gguf frac1,frac2,...   (same-file A=B gives the oracle upper bound)"""
import sys, re
sys.path.insert(0, "/mnt/scratch/src/llama.cpp-flint/gguf-py")
from gguf import GGUFReader
import numpy as np
def load(p):
    out = {}
    for t in GGUFReader(p).tensors:
        m = re.match(r"blk\.(\d+)\.ffn_up_exps\.weight\.counts", t.name)
        if m: out[int(m.group(1))] = np.array(t.data, dtype=np.float64).reshape(-1)
    return out
A, B = load(sys.argv[1]), load(sys.argv[2])
for f in map(float, sys.argv[3].split(",")):
    hits = tot = 0.0
    for l in B:
        k = int(round(len(B[l]) * f)); top = np.argsort(A[l])[::-1][:k]
        hits += B[l][top].sum(); tot += B[l].sum()
    print(f"  frac {f:.3f}: {hits / tot:.3f}")
