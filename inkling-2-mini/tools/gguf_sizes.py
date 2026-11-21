"""Tensor bytes of a GGUF, grouped (experts per layer, attention, embeddings...). python -I tools/gguf_sizes.py FILE"""
import sys, re, collections
sys.path.insert(0, "/mnt/scratch/llama.cpp/src-master/gguf-py")
from gguf import GGUFReader
r = GGUFReader(sys.argv[1])
for k, f in r.fields.items():
    if k.startswith(("general.name", "inkling", "general.arch")) or "loop" in k or "block_count" in k:
        try: v = f.contents()
        except Exception: v = "?"
        if isinstance(v, list) and len(v) > 30: v = f"list[{len(v)}]"
        print(f"  {k} = {v}")
groups = collections.defaultdict(int); types = collections.defaultdict(set); per_layer = collections.defaultdict(int)
for t in r.tensors:
    m = re.match(r"blk\.(\d+)\.(.*)", t.name)
    kind = "other"
    if m:
        il, rest = int(m.group(1)), m.group(2)
        kind = "experts" if "_exps" in rest else ("router" if "inp" in rest and "gate" in rest else "layer-dense")
        if kind == "experts": per_layer[il] += int(t.n_bytes)
    else:
        kind = t.name.split(".")[0]
    groups[kind] += int(t.n_bytes); types[kind].add(t.tensor_type.name)
tot = sum(groups.values())
for k, v in sorted(groups.items(), key=lambda x: -x[1]): print(f"{k:14s} {v/2**30:7.3f} GiB  {sorted(types[k])}")
print(f"{'total':14s} {tot/2**30:7.3f} GiB")
print("experts per layer (MiB):", {k: round(v / 2**20) for k, v in sorted(per_layer.items())})
ex = [t for t in r.tensors if t.name.startswith("blk.0.") and "_exps" in t.name]
for t in ex: print(" ", t.name, t.tensor_type.name, list(t.shape), round(int(t.n_bytes)/2**20,1), "MiB")
for t in r.tensors:
    if t.name.startswith("blk.6.") or not t.name.startswith("blk."): print("   ", t.name, t.tensor_type.name, list(t.shape))
