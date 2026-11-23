"""Merge a LoRA GGUF into a base GGUF and keep every tensor's type (llama-export-lora would write merged tensors as F16).
    python3 -I tools/merge_lora.py BASE.gguf LORA.gguf OUT.gguf [--scale 1.0]
For each edited weight W (Q8_0/F16/F32): W' = W + scale * (alpha / rank) * B @ A, re-quantized to W's own type.
llama.cpp applies a LoRA as y += scale * alpha/rank * B(A x), with lora_a ne = [n_in, r] and lora_b ne = [r, n_out]
(numpy shapes (r, n_in) and (n_out, r)), so the delta in numpy layout (n_out, n_in) is B @ A.
Only dense 2-D weights are merged; anything else in the adapter (e.g. 3-D expert tensors) is refused.
Every other tensor and all metadata are copied byte for byte."""
import argparse, sys, re
import numpy as np
sys.path.insert(0, "/mnt/scratch/llama.cpp/src-master/gguf-py")
import gguf
from gguf import GGUFReader, GGUFWriter, GGMLQuantizationType as T
from gguf.quants import dequantize, quantize

ap = argparse.ArgumentParser()
ap.add_argument("base"); ap.add_argument("lora"); ap.add_argument("out"); ap.add_argument("--scale", type=float, default=1.0)
a = ap.parse_args()

lr = GGUFReader(a.lora)
alpha = float(lr.fields["adapter.lora.alpha"].contents())
lt = {t.name: t for t in lr.tensors}
edits = {}
for name in lt:
    m = re.match(r"(.+)\.lora_a$", name)
    if m:
        A = np.array(lt[name].data, dtype=np.float32); B = np.array(lt[m.group(1) + ".lora_b"].data, dtype=np.float32)
        if A.ndim != 2: sys.exit(f"refusing {name}: {A.ndim}-D adapter tensor (only dense weights are supported)")
        edits[m.group(1)] = (A, B)
rank = next(iter(edits.values()))[0].shape[0]
k = a.scale * alpha / rank
print(f"{len(edits)} edited weights, rank {rank}, alpha {alpha}, effective scale {k}")

br = GGUFReader(a.base)
arch = br.fields["general.architecture"].contents()
w = GGUFWriter(a.out, arch, use_temp_file=False)
for f in br.fields.values():
    if f.name.startswith("GGUF.") or f.name == "general.architecture": continue
    vt = f.types[0]
    if vt == gguf.GGUFValueType.ARRAY:
        w.add_key_value(f.name, f.contents(), vt, sub_type=f.types[-1])
    else:
        w.add_key_value(f.name, f.contents(), vt)
w.add_string("general.lora_merged", a.lora.rsplit("/", 1)[-1])
done = 0; worst = 0.0
for t in br.tensors:
    raw = t.data
    if t.name in edits:
        A, B = edits.pop(t.name)
        W = dequantize(np.asarray(raw), t.tensor_type).reshape(B.shape[0], A.shape[1]).astype(np.float32)
        delta = k * (B @ A)
        Wn = W + delta
        q = quantize(Wn, t.tensor_type)
        back = dequantize(q, t.tensor_type).reshape(Wn.shape)
        rel = float(np.linalg.norm(back - Wn) / np.linalg.norm(delta))   # requant error relative to the edit itself
        worst = max(worst, rel); done += 1
        w.add_tensor(t.name, q, raw_shape=q.shape, raw_dtype=t.tensor_type)
    else:
        w.add_tensor(t.name, np.asarray(raw), raw_shape=np.asarray(raw).shape, raw_dtype=t.tensor_type)
if edits: sys.exit(f"adapter weights not found in base: {list(edits)[:5]}")
print(f"merged {done} tensors; worst re-quantization error relative to the edit's norm: {worst:.3f}")
w.write_header_to_file(); w.write_kv_data_to_file(); w.write_tensors_to_file(progress=False); w.close()
print("wrote", a.out)
