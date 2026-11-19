"""Summarize tensor types/bytes of a GGUF by tensor kind. python -I gguf_types.py FILE"""
import sys, collections, re
sys.path.insert(0, "/mnt/scratch/src/llama.cpp-flint/gguf-py")
from gguf import GGUFReader
r = GGUFReader(sys.argv[1])
agg = collections.defaultdict(lambda: [0, 0, set()])
per = collections.defaultdict(dict)
for t in r.tensors:
    m = re.match(r"blk\.(\d+)\.(.*)", t.name)
    kind = m.group(2) if m else t.name
    a = agg[kind]; a[0] += 1; a[1] += int(t.n_bytes); a[2].add(t.tensor_type.name)
    if m and "exps" in kind: per[int(m.group(1))][kind] = t.tensor_type.name
for k, (n, b, ty) in sorted(agg.items(), key=lambda x: -x[1][1]):
    print(f"{k:28s} n={n:3d} {b/2**30:7.3f} GiB {sorted(ty)}")
print("total", sum(a[1] for a in agg.values())/2**30, "GiB")
if "-v" in sys.argv:
    for l in sorted(per): print(l, per[l])
