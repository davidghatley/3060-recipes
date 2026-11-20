"""Decode bytes per token and bandwidth ceiling for a Qwen3.5 GGUF, from its real tensor sizes.

    python3 -I tools/ceiling.py <model.gguf> [--bw 340] [--ctx 0,4096,16384,32768] [--kv-bytes 2]

Counts every tensor once per token (the tied token_embd is read in full as the LM head; the embedding
lookup itself is one row). MTP (blk.<n_layer>.*) tensors are reported separately: they are only read by
the draft. Adds per-token KV reads for the full-attention layers and Gated DeltaNet state read+write.
"""
import argparse, sys
from collections import defaultdict

sys.path.insert(0, "/mnt/scratch/src/llama.cpp-flint/gguf-py")
from gguf import GGUFReader  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("gguf")
ap.add_argument("--bw", type=float, default=340.0, help="achievable VRAM bandwidth, GB/s")
ap.add_argument("--ctx", default="0,4096,16384,32768")
ap.add_argument("--kv-bytes", type=float, default=2.0, help="bytes per KV element (f16=2, q8_0=1.0625)")
a = ap.parse_args()

r = GGUFReader(a.gguf)
f = lambda k: r.fields[k].contents()
arch = f("general.architecture")
n_layer = f(f"{arch}.block_count") - (f(f"{arch}.nextn_predict_layers") if f"{arch}.nextn_predict_layers" in r.fields else 0)
n_kv, hd = f(f"{arch}.attention.head_count_kv"), f(f"{arch}.attention.key_length")
interval = f(f"{arch}.full_attention_interval")
n_full = n_layer // interval
n_rec = n_layer - n_full
d_state, n_vhead = f(f"{arch}.ssm.state_size"), f(f"{arch}.ssm.time_step_rank")

cat = defaultdict(int)
types = defaultdict(set)
for t in r.tensors:
    name = t.name
    if name.startswith("blk."):
        il = int(name.split(".")[1])
        if il >= n_layer:
            c = "mtp"
        elif "ffn" in name:
            c = "ffn"
        elif (il + 1) % interval == 0:
            c = "attn_full"
        else:
            c = "gdn"
    elif name == "token_embd.weight":
        c = "lm_head(tied embd)"
    elif name == "output.weight":
        c = "lm_head"
    else:
        c = "other"
    cat[c] += t.n_bytes
    types[c].add(t.tensor_type.name)

trunk = sum(v for k, v in cat.items() if k != "mtp")
print(f"{a.gguf}\nlayers {n_layer} ({n_full} full attention, {n_rec} Gated DeltaNet)")
for k, v in sorted(cat.items(), key=lambda kv: -kv[1]):
    print(f"  {k:20s} {v / 1e9:7.3f} GB  {sorted(types[k])}")
print(f"  {'TRUNK (per token)':20s} {trunk / 1e9:7.3f} GB")
state = n_rec * n_vhead * d_state * d_state * 4 * 2  # f32 state, read + write
kv_per_tok = n_full * 2 * n_kv * hd * a.kv_bytes
print(f"GDN state r+w per token {state / 1e6:.1f} MB; KV per context token {kv_per_tok / 1e3:.1f} KB")
print(f"ceiling at {a.bw:.0f} GB/s:")
for c in map(int, a.ctx.split(",")):
    b = trunk + state + kv_per_tok * c
    print(f"  ctx {c:6d}: {b / 1e9:.3f} GB/token -> {a.bw / (b / 1e9):6.1f} tok/s ({b / 1e9 / a.bw * 1e3:.2f} ms)")
