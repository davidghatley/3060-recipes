"""Write a copy of a SenseNova-Loop GGUF with a different loop count (header rewrite; tensor data copied byte for byte).
    python3 -I tools/set_loops.py IN.gguf OUT.gguf LOOPS

The GGUF stores the unrolled plan: block_count = n_physical + (loops-1) * (loop_end - loop_start) (+ the MTP layer),
attention.recurrent_layers has one entry per unrolled layer, and the layers after the loop block are named by their
unrolled index (blk.52-55 at 2 loops, plus blk.56 = MTP). This rewrites those three things and nothing else.
The model was trained at 2 loops; any other count is an out-of-distribution, lossy experiment (PLAN.md).
"""
import struct, sys, re, shutil

src, dst, loops = sys.argv[1], sys.argv[2], int(sys.argv[3])
f = open(src, "rb")
SZ = {0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8}


def rd(fmt):
    return struct.unpack("<" + fmt, f.read(struct.calcsize("<" + fmt)))[0]


def rstr():
    return f.read(rd("Q")).decode()


def rval(t):
    if t == 8: return rstr()
    if t == 9:
        et, n = rd("I"), rd("Q")
        return (et, [rval(et) for _ in range(n)])
    return rd({0: "B", 1: "b", 2: "H", 3: "h", 4: "I", 5: "i", 6: "f", 7: "?", 10: "Q", 11: "q", 12: "d"}[t])


def wstr(s):
    b = s.encode(); return struct.pack("<Q", len(b)) + b


def wval(t, v):
    if t == 8: return wstr(v)
    if t == 9:
        et, items = v
        return struct.pack("<IQ", et, len(items)) + b"".join(wval(et, x) for x in items)
    return struct.pack("<" + {0: "B", 1: "b", 2: "H", 3: "h", 4: "I", 5: "i", 6: "f", 7: "?", 10: "Q", 11: "q", 12: "d"}[t], v)


assert f.read(4) == b"GGUF"
ver, nt, nkv = rd("I"), rd("Q"), rd("Q")
kvs = []
for _ in range(nkv):
    k = rstr(); t = rd("I"); kvs.append([k, t, rval(t)])
kd = {k: (t, v) for k, t, v in kvs}
arch = kd["general.architecture"][1]
ls, le, lc = (kd[f"{arch}.loop.{x}"][1] for x in ("start", "end", "count"))
bc = kd[f"{arch}.block_count"][1]
width = le - ls
n_unrolled_old = bc - kd.get(f"{arch}.nextn_predict_layers", (0, 0))[1]
n_phys = n_unrolled_old - (lc - 1) * width
n_unrolled_new = n_phys + (loops - 1) * width
shift = n_unrolled_new - n_unrolled_old
print(f"physical {n_phys}, unrolled {n_unrolled_old} -> {n_unrolled_new} (loops {lc} -> {loops}), tail shift {shift:+d}")
align = kd.get("general.alignment", (4, 32))[1]

# recurrent_layers: rebuild from the physical pattern (one entry per unrolled layer, then the MTP entries)
et, rec = kd[f"{arch}.attention.recurrent_layers"][1]
phys_rec = rec[:le] + rec[n_unrolled_old - (n_phys - le):n_unrolled_old]
new_rec = rec[:le] + rec[ls:le] * (loops - 1) + phys_rec[le:] + rec[n_unrolled_old:]
for kv in kvs:
    if kv[0] == f"{arch}.block_count": kv[2] = bc + shift
    elif kv[0] == f"{arch}.loop.count": kv[2] = loops
    elif kv[0] == f"{arch}.attention.recurrent_layers": kv[2] = (et, new_rec)
    elif kv[0] == f"{arch}.hyper_connection.count": pass  # stream count, unrelated

tensors = []
for _ in range(nt):
    name = rstr(); nd = rd("I"); dims = [rd("Q") for _ in range(nd)]; typ = rd("I"); off = rd("Q")
    m = re.match(r"blk\.(\d+)\.(.*)$", name)
    if m and int(m.group(1)) >= le + (lc - 1) * width:
        name = f"blk.{int(m.group(1)) + shift}.{m.group(2)}"
    tensors.append((name, dims, typ, off))
hdr_end = f.tell()
data_start = (hdr_end + align - 1) // align * align

out = bytearray(b"GGUF" + struct.pack("<IQQ", ver, nt, nkv))
for k, t, v in kvs:
    out += wstr(k) + struct.pack("<I", t) + wval(t, v)
for name, dims, typ, off in tensors:
    out += wstr(name) + struct.pack("<I", len(dims)) + b"".join(struct.pack("<Q", d) for d in dims) + struct.pack("<IQ", typ, off)
out += b"\0" * ((-len(out)) % align)
with open(dst, "wb") as g:
    g.write(out)
    f.seek(data_start)
    shutil.copyfileobj(f, g, 64 << 20)
print(f"wrote {dst}: header {len(out)} B (was {data_start}), block_count {bc + shift}")
