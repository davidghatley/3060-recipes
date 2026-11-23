"""Metadata, per-layer sizes and quant types of a Maxwell GGUF (or LoRA).  python3 -I tools/gguf_info.py FILE [--all-tensors]"""
import sys, re, collections
sys.path.insert(0, "/mnt/scratch/llama.cpp/src-r2/gguf-py")
from gguf import GGUFReader

path = sys.argv[1]
r = GGUFReader(path)
for k, f in r.fields.items():
    if k.startswith("tokenizer.ggml.") and k not in ("tokenizer.ggml.model", "tokenizer.ggml.pre", "tokenizer.ggml.eos_token_id", "tokenizer.ggml.bos_token_id"):
        continue
    try:
        v = f.contents()
    except Exception as e:
        v = f"<{e}>"
    s = repr(v)
    if k == "tokenizer.chat_template":
        s = f"<{len(v)} chars>"
    print(f"{k} = {s[:300]}")
exp = collections.defaultdict(int); kinds = collections.defaultdict(dict); nonexp = collections.defaultdict(int); types = collections.Counter()
for t in r.tensors:
    types[t.tensor_type.name] += int(t.n_bytes)
    m = re.match(r"blk\.(\d+)\.ffn_(gate|up|down)_exps\.weight$", t.name)
    if m:
        exp[int(m.group(1))] += int(t.n_bytes); kinds[int(m.group(1))][m.group(2)] = t.tensor_type.name
    else:
        key = re.sub(r"blk\.\d+\.", "blk.N.", t.name)
        nonexp[key] += int(t.n_bytes)
    if "--all-tensors" in sys.argv:
        print(f"T {t.name} {t.tensor_type.name} {list(t.shape)} {int(t.n_bytes)}")
print(f"== {len(r.tensors)} tensors; bytes by type: " + ", ".join(f"{k} {v/2**30:.2f} GiB" for k, v in types.most_common()))
for il in sorted(exp):
    print(f"L{il:2d} experts {exp[il]/2**20:7.1f} MiB  " + " ".join(f"{k}:{v}" for k, v in sorted(kinds[il].items())))
print(f"all experts {sum(exp.values())/2**30:.3f} GiB; non-expert {sum(nonexp.values())/2**30:.3f} GiB")
for k, v in sorted(nonexp.items(), key=lambda x: -x[1])[:30]:
    print(f"   {k:40s} {v/2**20:8.1f} MiB")
