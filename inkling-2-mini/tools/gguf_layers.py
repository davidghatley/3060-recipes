"""Per-layer expert quant types and sizes of an Inkling GGUF.  python -I tools/gguf_layers.py FILE [FILE...]"""
import sys, re, collections
sys.path.insert(0, "/mnt/scratch/llama.cpp/src-master/gguf-py")
from gguf import GGUFReader

for path in sys.argv[1:]:
    r = GGUFReader(path)
    arch = r.fields["general.architecture"].contents()
    size = collections.defaultdict(int); kinds = collections.defaultdict(dict); other = 0; nonexp = collections.defaultdict(int)
    for t in r.tensors:
        m = re.match(r"blk\.(\d+)\.ffn_(.*)_exps\.weight$", t.name)
        if m:
            size[int(m.group(1))] += int(t.n_bytes); kinds[int(m.group(1))][m.group(2)] = t.tensor_type.name
        else:
            other += int(t.n_bytes); nonexp[t.name.split(".")[0] if not t.name.startswith("blk.") else "blk-dense"] += int(t.n_bytes)
    print(f"== {path}\n   arch {arch}, {len(r.tensors)} tensors, block_count {r.fields[arch + '.block_count'].contents()}")
    for il in sorted(size):
        print(f"L{il:2d} {size[il] / 2**20:7.0f} MiB  " + " ".join(f"{k}:{v}" for k, v in sorted(kinds[il].items())))
    core = sum(v for k, v in size.items() if 6 <= k <= 17)
    print(f"non-expert {other / 2**30:.2f} GiB ({', '.join(f'{k} {v / 2**20:.0f} MiB' for k, v in sorted(nonexp.items(), key=lambda x: -x[1])[:4])}); "
          f"core 6-17 experts {core / 2**30:.2f} GiB; all experts {sum(size.values()) / 2**30:.2f} GiB")
