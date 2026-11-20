"""Build a convert source dir = official FP16 shards (symlinks) + the base model's MTP shard, with a merged index.
    python3 -I tools/make_src.py <hf-fp16 dir> <mtp.safetensors> <out dir>"""
import json, os, struct, sys
from pathlib import Path
src, mtp, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
for f in src.iterdir():
    if f.name != "model.safetensors.index.json" and not (out / f.name).exists():
        os.symlink(f.resolve(), out / f.name)
if not (out / "model-mtp.safetensors").exists():
    os.symlink(mtp.resolve(), out / "model-mtp.safetensors")
idx = json.load(open(src / "model.safetensors.index.json"))
with open(mtp, "rb") as fh:
    n = struct.unpack("<Q", fh.read(8))[0]; hdr = json.loads(fh.read(n))
for k in hdr:
    if k != "__metadata__":
        idx["weight_map"][k] = "model-mtp.safetensors"
json.dump(idx, open(out / "model.safetensors.index.json", "w"), indent=1)
print(f"{out}: {len(idx['weight_map'])} tensors")
