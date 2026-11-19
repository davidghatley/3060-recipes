"""Per-layer expert routing concentration from llama-imatrix GGUF output (the <tensor>.counts arrays).
    python -I routing_skew.py A.imatrix.gguf [B.imatrix.gguf ...]
For each file: per layer, share of selections taken by the top 25% / 50% of experts (and top 10%, top 32),
experts never selected, normalized entropy. For pairs: overlap of top-25% sets, Spearman rho of counts."""
import sys, re, math
sys.path.insert(0, "/mnt/scratch/src/llama.cpp-flint/gguf-py")
from gguf import GGUFReader
import numpy as np

def load(path):
    r = GGUFReader(path); out = {}
    for t in r.tensors:
        m = re.match(r"blk\.(\d+)\.ffn_up_exps\.weight\.counts", t.name)
        if m: out[int(m.group(1))] = np.array(t.data, dtype=np.float64).reshape(-1)
    return out

def share(c, frac):
    s = np.sort(c)[::-1]; k = max(1, int(round(len(s) * frac))); return s[:k].sum() / s.sum()

def rank(x):
    o = np.argsort(x, kind="stable"); r = np.empty(len(x)); r[o] = np.arange(len(x)); return r

files = sys.argv[1:]
data = [load(f) for f in files]
for f, d in zip(files, data):
    L = sorted(d)
    rows = []
    for l in L:
        c = d[l]; p = c / c.sum(); nz = p[p > 0]
        rows.append((l, share(c, .10), share(c, .25), share(c, .5), int((c == 0).sum()), -(nz * np.log(nz)).sum() / math.log(len(c)), c.sum() / 6))
    a = np.array([r[1:] for r in rows])
    print(f"\n== {f}\n   tokens/layer ~{a[0,5]:.0f}; uniform would give top10%=0.100 top25%=0.250 top50%=0.500")
    print(" layer  top10%  top25%  top50%  unused  H/Hmax")
    for r in rows: print(f"  {r[0]:4d}  {r[1]:.3f}   {r[2]:.3f}   {r[3]:.3f}   {r[4]:5d}  {r[5]:.3f}")
    print(f"  mean  {a[:,0].mean():.3f}   {a[:,1].mean():.3f}   {a[:,2].mean():.3f}   {a[:,3].mean():5.1f}  {a[:,4].mean():.3f}")
    print(f"  min   {a[:,0].min():.3f}   {a[:,1].min():.3f}   {a[:,2].min():.3f}")
    print(f"  max   {a[:,0].max():.3f}   {a[:,1].max():.3f}   {a[:,2].max():.3f}")
for i in range(len(files)):
    for j in range(i + 1, len(files)):
        A, B = data[i], data[j]; L = sorted(set(A) & set(B)); ov, rho, ovs = [], [], []
        for l in L:
            k = 64; ta = set(np.argsort(A[l])[::-1][:k]); tb = set(np.argsort(B[l])[::-1][:k])
            ov.append(len(ta & tb) / k)
            # share of B's selections covered by A's top-25% set (what a cache chosen on A would hit on B)
            ovs.append(B[l][list(ta)].sum() / B[l].sum())
            ra, rb = rank(A[l]), rank(B[l]); rho.append(np.corrcoef(ra, rb)[0, 1])
        print(f"\n== {files[i]}  vs  {files[j]}")
        print(f"  top-25% set overlap: mean {np.mean(ov):.3f} (min {np.min(ov):.3f}, max {np.max(ov):.3f}); random would be 0.25")
        print(f"  B's selections hit by A's top-25% experts: mean {np.mean(ovs):.3f} (min {np.min(ovs):.3f})")
        print(f"  Spearman rho of per-expert counts: mean {np.mean(rho):.3f} (min {np.min(rho):.3f}, max {np.max(rho):.3f})")
