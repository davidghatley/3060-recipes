"""Fetch only the mtp.* tensors of a sharded safetensors HF repo with HTTP range requests.

    python3 -I tools/fetch_mtp.py <resolve-base-url> <out.safetensors>

Reads model.safetensors.index.json, then each shard's header, then the byte ranges of mtp.* tensors,
and writes them unchanged (same dtype, same names) into one safetensors file. Standard library only.
"""
import json, struct, sys, urllib.request
from pathlib import Path

base, out = sys.argv[1].rstrip("/"), Path(sys.argv[2])


def get(url, rng=None):
    req = urllib.request.Request(url, headers={"Range": f"bytes={rng[0]}-{rng[1]}"} if rng else {})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


index = json.loads(get(f"{base}/model.safetensors.index.json"))
shards = sorted({f for k, f in index["weight_map"].items() if k.startswith("mtp.")})
tensors = {}
for shard in shards:
    url = f"{base}/{shard}"
    n = struct.unpack("<Q", get(url, (0, 7)))[0]
    header = json.loads(get(url, (8, 8 + n - 1)))
    for name, meta in header.items():
        if not name.startswith("mtp."):
            continue
        a, b = meta["data_offsets"]
        data = get(url, (8 + n + a, 8 + n + b - 1))
        assert len(data) == b - a, name
        tensors[name] = (meta["dtype"], meta["shape"], data)
        print(f"{name} {meta['dtype']} {meta['shape']} {len(data)} B", flush=True)

hdr, off, blobs = {}, 0, []
for name in sorted(tensors):
    dtype, shape, data = tensors[name]
    hdr[name] = {"dtype": dtype, "shape": shape, "data_offsets": [off, off + len(data)]}
    off += len(data)
    blobs.append(data)
hdr["__metadata__"] = {"format": "pt", "source": base}
hb = json.dumps(hdr).encode()
hb += b" " * (-len(hb) % 8)
out.parent.mkdir(parents=True, exist_ok=True)
with open(out, "wb") as f:
    f.write(struct.pack("<Q", len(hb)) + hb)
    for d in blobs:
        f.write(d)
print(f"wrote {len(tensors)} tensors, {off / 1e6:.1f} MB -> {out}")
