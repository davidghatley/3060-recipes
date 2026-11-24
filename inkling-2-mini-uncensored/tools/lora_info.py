"""What a LoRA GGUF edits: tensor groups, rank, dtype, bytes, and adapter metadata.
    python3 -I tools/lora_info.py ADAPTER.gguf [BASE.gguf]
With BASE it also checks that every edited tensor exists in the base file with a matching shape."""
import sys, re, collections
sys.path.insert(0, "/mnt/scratch/llama.cpp/src-master/gguf-py")
from gguf import GGUFReader

r = GGUFReader(sys.argv[1])
for k, f in r.fields.items():
    if k.startswith(("general.", "adapter.")):
        try: v = f.contents()
        except Exception: v = "?"
        print(f"  {k} = {v}")
groups = collections.defaultdict(lambda: [0, 0, set(), set(), set()])
pairs = {}
for t in r.tensors:
    m = re.match(r"(?:blk\.(\d+)\.)?(.+?)\.weight\.lora_([ab])$", t.name)
    if not m:
        print("  other tensor:", t.name, t.tensor_type.name, list(t.shape)); continue
    il, name, ab = m.groups()
    g = groups[name]; g[0] += 1; g[1] += int(t.n_bytes); g[2].add(t.tensor_type.name); g[3].add(il)
    g[4].add(tuple(int(x) for x in t.shape) if ab == "a" else ())
    pairs.setdefault((il, name), {})[ab] = [int(x) for x in t.shape]
tot = 0
for name, (n, b, ty, layers, shp) in sorted(groups.items()):
    tot += b
    a_shapes = sorted(s for s in shp if s)
    print(f"{name:24s} {n:4d} tensors  {b / 2**20:8.1f} MiB  {','.join(sorted(ty))}  layers {len([x for x in layers if x is not None]) or 'n/a'}  lora_a shape {a_shapes[0] if a_shapes else '-'}")
print(f"total {tot / 2**20:.1f} MiB in {len(r.tensors)} tensors, {len(pairs)} edited weights")
if len(sys.argv) > 2:
    base = {t.name: [int(x) for x in t.shape] for t in GGUFReader(sys.argv[2]).tensors}
    missing = [f"blk.{il}.{n}.weight" if il else f"{n}.weight" for il, n in pairs if (f"blk.{il}.{n}.weight" if il else f"{n}.weight") not in base]
    print(f"edited weights missing from base: {len(missing)} {missing[:5]}")
    for (il, n), ab in list(pairs.items())[:3]:
        bn = f"blk.{il}.{n}.weight" if il else f"{n}.weight"
        print(f"  {bn}: base {base.get(bn)}  lora_a {ab.get('a')}  lora_b {ab.get('b')}")
