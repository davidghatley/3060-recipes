"""Compare two GGUFs tensor by tensor (bytes), and print MTP norm stats.
    python3 -I tools/cmp_gguf.py a.gguf b.gguf"""
import hashlib, sys
import numpy as np
sys.path.insert(0, "/mnt/scratch/src/llama.cpp-flint/gguf-py")
from gguf import GGUFReader
A, B = GGUFReader(sys.argv[1]), GGUFReader(sys.argv[2])
ta = {t.name: t for t in A.tensors}; tb = {t.name: t for t in B.tensors}
same = diff = 0; diffs = []
for n, t in ta.items():
    if n not in tb: continue
    u = tb[n]
    if t.tensor_type == u.tensor_type and bytes(t.data.tobytes()) == bytes(u.data.tobytes()): same += 1
    else: diff += 1; diffs.append((n, t.tensor_type.name, u.tensor_type.name))
print(f"common {same+diff}: identical {same}, different {diff}; only in A {len(set(ta)-set(tb))}, only in B {len(set(tb)-set(ta))}")
for d in diffs[:10]: print("  diff", d)
for n in sorted(set(tb) - set(ta))[:20]: print("  only B", n, tb[n].tensor_type.name)
for R in (A, B):
    for t in R.tensors:
        if "nextn.enorm" in t.name or "nextn.hnorm" in t.name or t.name == "blk.31.attn_norm.weight":
            print(t.name, "mean", float(np.asarray(t.data, dtype=np.float32).mean()))
