"""Header-only GGUF reader (works on a partial download): metadata and tensor bytes grouped by kind and layer.
    python3 -I tools/gguf_info.py FILE [--tensors]
"""
import struct, sys, re, collections

# ggml type -> (block size, bytes per block)
T = {0: ("F32", 1, 4), 1: ("F16", 1, 2), 2: ("Q4_0", 32, 18), 3: ("Q4_1", 32, 20), 6: ("Q5_0", 32, 22), 7: ("Q5_1", 32, 24),
     8: ("Q8_0", 32, 34), 10: ("Q2_K", 256, 84), 11: ("Q3_K", 256, 110), 12: ("Q4_K", 256, 144), 13: ("Q5_K", 256, 176),
     14: ("Q6_K", 256, 210), 15: ("Q8_K", 256, 292), 16: ("IQ2_XXS", 256, 66), 17: ("IQ2_XS", 256, 74), 18: ("IQ3_XXS", 256, 98),
     19: ("IQ1_S", 256, 50), 20: ("IQ4_NL", 32, 18), 21: ("IQ3_S", 256, 110), 22: ("IQ2_S", 256, 82), 23: ("IQ4_XS", 256, 136),
     29: ("IQ1_M", 256, 56), 30: ("BF16", 1, 2), 34: ("TQ1_0", 256, 54), 35: ("TQ2_0", 256, 66), 39: ("MXFP4", 32, 17)}

def main():
    path = sys.argv[1]; show = "--tensors" in sys.argv
    f = open(path, "rb")
    rd = lambda fmt: struct.unpack("<" + fmt, f.read(struct.calcsize("<" + fmt)))[0]
    def rstr(): n = rd("Q"); return f.read(n).decode("utf-8", "replace")
    def rval(t):
        if t == 8: return rstr()
        if t == 9:
            et, n = rd("I"), rd("Q"); v = [rval(et) for _ in range(n)]
            return v if n <= 16 else f"[{n} x type {et}] first={v[:4]}"
        return rd({0: "B", 1: "b", 2: "H", 3: "h", 4: "I", 5: "i", 6: "f", 7: "?", 10: "Q", 11: "q", 12: "d"}[t])
    assert f.read(4) == b"GGUF"; ver, nt, nkv = rd("I"), rd("Q"), rd("Q")
    for _ in range(nkv):
        k = rstr(); v = rval(rd("I"))
        if not k.startswith("tokenizer.ggml.") or k.endswith(("model", "pre")):
            s = str(v); print(f"  {k} = {s[:200]}")
    tensors = []
    for _ in range(nt):
        name = rstr(); nd = rd("I"); shape = [rd("Q") for _ in range(nd)]; typ = rd("I"); rd("Q")
        tn, bs, bb = T.get(typ, (f"t{typ}", 1, 0)); n = 1
        for d in shape: n *= d
        tensors.append((name, tn, shape, n // bs * bb))
    groups = collections.defaultdict(int); types = collections.defaultdict(set); layer = collections.defaultdict(int)
    for name, tn, shape, nb in tensors:
        m = re.match(r"blk\.(\d+)\.(.*?)(\.weight|\.bias)?$", name)
        key = f"blk.*.{m.group(2)}" if m else name
        groups[key] += nb; types[key].add(tn)
        if m: layer[int(m.group(1))] += nb
        if show: print(f"    {name:45s} {tn:8s} {shape} {nb/2**20:.2f} MiB")
    tot = sum(groups.values())
    print(f"tensors {len(tensors)}, total {tot/1e9:.3f} GB ({tot/2**30:.3f} GiB)")
    for k, v in sorted(groups.items(), key=lambda x: -x[1]):
        if v > 2**20: print(f"  {k:36s} {v/1e9:7.3f} GB  {sorted(types[k])}")
    print("per layer (MB):", {k: round(v / 1e6) for k, v in sorted(layer.items())})

main()
