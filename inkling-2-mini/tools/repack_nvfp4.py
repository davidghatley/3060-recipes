"""Bit-exact repack of Inkling-2-Mini's native NVFP4 experts into ggml NVFP4 (no requantization).

    python -I tools/repack_nvfp4.py TEMPLATE.gguf HF_DIR OUT.gguf [--verify REF.gguf]

TEMPLATE is a ggml-org Inkling-2-Mini GGUF (IQ4_NL: everything except the NVFP4 experts is Q8_0/F32, and the MXFP8
experts of layers 20-23 are Q8_0). Every tensor is copied from it unchanged, except ffn_gate_up_exps / ffn_down_exps of
the layers whose checkpoint experts are NVFP4 (0-19). Those are rebuilt from the safetensors in HF_DIR:
  * 4-bit E2M1 codes and E4M3 block scales (16 elements) copied bit for bit into ggml's block_nvfp4
    (4 sub-block UE4M3 scales + 32 nibble bytes per 64 elements; ggml decodes kvalues_mxfp4 * ue4m3 * 0.5 = E2M1 * E4M3),
  * the per-expert outer scale amax / outer_scale_denominator written as `<name>.scale` F32 [n_expert],
    which llama.cpp's generic loader picks up as ffn_up_exps_s / ffn_down_exps_s.
Row order follows llama.cpp's conversion/inkling2.py: w13 rows are interleaved (gate, up) in the checkpoint; the GGUF
holds the even rows first, then the odd rows.
--verify dequantizes a few experts of the output and compares them with REF (e.g. the Q8_0 GGUF).
Needs llama.cpp >= the loop-scale fix (re-share the loop slots after the generic .scale pass), else passes 2-3 run unscaled.
"""
import argparse, json, re, sys
from pathlib import Path
import numpy as np

sys.path.insert(0, "/mnt/scratch/llama.cpp/src-master/gguf-py")
import gguf  # noqa: E402
from safetensors import safe_open  # noqa: E402
import torch  # noqa: E402

E2M1 = np.array([0, .5, 1, 1.5, 2, 3, 4, 6, -0., -.5, -1, -1.5, -2, -3, -4, -6], np.float32)


def e4m3_table():
    t = np.zeros(256, np.float32)
    for b in range(256):
        s, e, m = b >> 7, (b >> 3) & 15, b & 7
        v = (m / 8) * 2.0 ** -6 if e == 0 else (1 + m / 8) * 2.0 ** (e - 7)
        t[b] = -v if s else v
    t[0x7F] = t[0xFF] = np.nan
    return t


E4M3 = e4m3_table()


class Ckpt:
    def __init__(self, d):
        self.d = Path(d)
        self.map = json.load(open(self.d / "model.safetensors.index.json"))["weight_map"]
        self.files = {}

    def get(self, name):
        f = self.map[name]
        if f not in self.files:
            self.files[f] = safe_open(str(self.d / f), framework="pt")
        t = self.files[f].get_tensor(name)
        return t.view(torch.uint8).numpy() if t.element_size() == 1 else t.float().numpy()


def pack(w, s, w13):
    """w: uint8 [E, rows, cols/2] (low nibble = even element), s: uint8 E4M3 [E, rows, cols/16] -> uint8 [E, rows, cols/64*36]."""
    if w13:  # de-interleave rows: even (first half of the GGUF rows), then odd
        w = np.concatenate([w[:, 0::2], w[:, 1::2]], axis=1)
        s = np.concatenate([s[:, 0::2], s[:, 1::2]], axis=1)
    E, R, half = w.shape
    nb = half // 8                      # 16-element sub-blocks per row
    vals = np.empty((E, R, nb, 16), np.uint8)
    wb = w.reshape(E, R, nb, 8)
    vals[..., 0::2] = wb & 15
    vals[..., 1::2] = wb >> 4
    qs = vals[..., :8] | (vals[..., 8:] << 4)            # ggml: qs[j] = elem j | elem j+8 << 4
    d = (s.reshape(E, R, nb) & 0x7F).astype(np.uint8)   # UE4M3 (block scales are positive)
    ns = nb // 4
    raw = np.concatenate([d.reshape(E, R, ns, 4), qs.reshape(E, R, ns, 32)], axis=-1)
    return np.ascontiguousarray(raw.reshape(E, R, ns * 36))


def dequant_nvfp4(raw_row):
    """ggml-side decode of one row of block_nvfp4 bytes (for --verify)."""
    b = raw_row.reshape(-1, 36)
    d, qs = b[:, :4], b[:, 4:].reshape(-1, 4, 8)
    dv = np.where((d == 0) | (d == 0x7F), 0, E4M3[d & 0x7F])
    lo, hi = E2M1[qs & 15], E2M1[qs >> 4]
    return (np.concatenate([lo, hi], axis=-1) * dv[..., None]).reshape(-1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("template"); ap.add_argument("hf_dir"); ap.add_argument("out")
    ap.add_argument("--verify", default="")
    ap.add_argument("--layers", default="", help="comma list / a-b ranges of layers to repack (default: every NVFP4 layer)")
    a = ap.parse_args()
    only = set()
    for part in filter(None, a.layers.split(",")):
        lo, _, hi = part.partition("-"); only.update(range(int(lo), int(hi or lo) + 1))
    ck = Ckpt(a.hf_dir)
    rd = gguf.GGUFReader(a.template)
    arch = rd.fields[gguf.Keys.General.ARCHITECTURE].contents()
    wr = gguf.GGUFWriter(a.out, arch)
    for field in rd.fields.values():
        if field.name == gguf.Keys.General.ARCHITECTURE or field.name.startswith("GGUF."):
            continue
        vt = field.types[0]
        st = field.types[-1] if vt == gguf.GGUFValueType.ARRAY else None
        val = field.contents()
        if field.name == "general.name":
            val = val + (f" (native NVFP4 experts, layers {a.layers})" if only else " (native NVFP4 experts)")
        wr.add_key_value(field.name, val, vt, sub_type=st)

    plan = []  # (name, kind, payload)
    for t in rd.tensors:
        m = re.match(r"blk\.(\d+)\.ffn_(gate_up|down)_exps\.weight$", t.name)
        src = None
        if m:
            il, kind = int(m.group(1)), m.group(2)
            base = f"model.llm.layers.{il}.mlp.experts.{'w13' if kind == 'gate_up' else 'w2'}_weight"
            if base + "_amax" in ck.map and (not only or il in only):
                src = (base, kind == "gate_up")
        if src is None:
            plan.append((t.name, "copy", t))
            wr.add_tensor_info(t.name, t.data.shape, t.data.dtype, t.data.nbytes, t.tensor_type)
            continue
        E, R, C = int(t.shape[2]), int(t.shape[1]), int(t.shape[0])
        nbytes = E * R * (C // 64) * 36
        plan.append((t.name, "nvfp4", src))
        wr.add_tensor_info(t.name, (E, R, (C // 64) * 36), np.dtype(np.uint8), nbytes, gguf.GGMLQuantizationType.NVFP4)
        sname = t.name.replace(".weight", ".scale")
        plan.append((sname, "scale", src))
        wr.add_tensor_info(sname, (E,), np.dtype(np.float32), E * 4, gguf.GGMLQuantizationType.F32)

    wr.write_header_to_file(); wr.write_kv_data_to_file(); wr.write_ti_data_to_file()
    for name, kind, p in plan:
        if kind == "copy":
            wr.write_tensor_data(p.data, tensor_endianess=rd.endianess)
        elif kind == "nvfp4":
            base, w13 = p
            raw = pack(ck.get(base), ck.get(base + "_scale"), w13)
            wr.write_tensor_data(raw)
            print("packed", name, raw.shape, flush=True)
        else:
            base, _ = p
            amax = ck.get(base + "_amax").astype(np.float32).reshape(-1)
            den = ck.get(base + "_outer_scale_denominator").astype(np.float32).reshape(-1)[0]
            wr.write_tensor_data((amax / den).astype(np.float32))
    wr.close()
    print("wrote", a.out)

    if a.verify:
        out = gguf.GGUFReader(a.out); ref = gguf.GGUFReader(a.verify)
        ot = {t.name: t for t in out.tensors}; rt = {t.name: t for t in ref.tensors}
        from gguf.quants import dequantize
        worst = 0.0
        for name in ("blk.0.ffn_gate_up_exps.weight", "blk.7.ffn_down_exps.weight", "blk.19.ffn_gate_up_exps.weight"):
            o, r = ot[name], rt[name]
            sc = ot[name.replace(".weight", ".scale")].data
            for e in (0, 63, 127):
                for row in (0, 1151, 1152, int(o.shape[1]) - 1):
                    if row >= int(o.shape[1]):
                        continue
                    mine = dequant_nvfp4(np.asarray(o.data[e, row])) * sc[e]
                    theirs = dequantize(np.asarray(r.data[e, row:row + 1]), r.tensor_type).reshape(-1)
                    rel = float(np.linalg.norm(mine - theirs) / max(np.linalg.norm(theirs), 1e-12))
                    worst = max(worst, rel)
            print(f"verify {name}: worst relative L2 vs {Path(a.verify).name} so far {worst:.5f}")
        print("VERIFY", "OK" if worst < 0.02 else "MISMATCH", round(worst, 5))


if __name__ == "__main__":
    main()
