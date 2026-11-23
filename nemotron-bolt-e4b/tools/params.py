"""Per-token parameter and byte counts for a Gemma-4-E4B style GGUF (header only).
    python3 -I tools/params.py FILE
Counts what a decode step reads: block matmuls (K/V projections skipped on KV-shared layers), per_layer_model_proj,
the tied LM head (token_embd), and per-token rows of the embedding lookups. Also K/V bytes per token per layer."""
import struct, re, sys
T = {0: (1, 4), 1: (1, 2), 8: (32, 34), 12: (256, 144), 13: (256, 176), 14: (256, 210), 30: (1, 2)}
f = open(sys.argv[1], 'rb')
rd = lambda fmt: struct.unpack('<' + fmt, f.read(struct.calcsize('<' + fmt)))[0]
def rstr(): n = rd('Q'); return f.read(n).decode('utf-8', 'replace')
def rv(t):
    if t == 8: return rstr()
    if t == 9:
        et, n = rd('I'), rd('Q'); return [rv(et) for _ in range(n)]
    return rd({0: 'B', 1: 'b', 2: 'H', 3: 'h', 4: 'I', 5: 'i', 6: 'f', 7: '?', 10: 'Q', 11: 'q', 12: 'd'}[t])
f.read(4); rd('I'); nt = rd('Q'); nkv = rd('Q')
kv = {}
for _ in range(nkv):
    k = rstr(); kv[k] = rv(rd('I'))
ten = {}
for _ in range(nt):
    n = rstr(); nd = rd('I'); sh = [rd('Q') for _ in range(nd)]; t = rd('I'); rd('Q')
    el = 1
    for d in sh: el *= d
    bs, bb = T[t]; ten[n] = (sh, el, el // bs * bb)
L = kv['gemma4.block_count']; shared = kv['gemma4.attention.shared_kv_layers']; swa = kv['gemma4.attention.sliding_window_pattern']
first_shared = L - shared
p = b = 0
for n, (sh, el, by) in ten.items():
    m = re.match(r'blk\.(\d+)\.(\w+)\.weight', n)
    if m and len(sh) == 2:
        if int(m.group(1)) >= first_shared and m.group(2) in ('attn_k', 'attn_v'):
            continue
        p += el; b += by
lm = ten['token_embd.weight']; pmp = ten['per_layer_model_proj.weight']; ple = ten['per_layer_token_embd.weight']
p_all = p + lm[1] + pmp[1]; b_all = b + lm[2] + pmp[2]
print(f"block matmul params {p/1e9:.3f} B ({b/1e9:.3f} GB), per_layer_model_proj {pmp[1]/1e9:.3f} B ({pmp[2]/1e9:.3f} GB), "
      f"tied LM head {lm[1]/1e9:.3f} B ({lm[2]/1e9:.3f} GB)")
print(f"per decode token: {p_all/1e9:.3f} B params, {b_all/1e9:.3f} GB read; {2*p_all/1e9:.2f} GFLOP")
print(f"embedding lookups per token: token_embd row {lm[2]/lm[0][1]/1e3:.1f} KB, per_layer_token_embd row {ple[2]/ple[0][1]/1e3:.1f} KB "
      f"(table {ple[2]/1e9:.2f} GB)")
kg, ks = kv['gemma4.attention.key_length'], kv['gemma4.attention.key_length_swa']; hkv = kv['gemma4.attention.head_count_kv']
glob = [i for i in range(L) if not swa[i]]
print(f"layers {L}, KV-shared from layer {first_shared}; global layers {glob}; global with own KV {[i for i in glob if i < first_shared]}")
print(f"f16 K+V bytes/token: global layer {2*hkv*kg*2} B, swa layer {2*hkv*ks*2} B; "
      f"stored global {sum(1 for i in glob if i < first_shared)*2*hkv*kg*2} B/token; read by all {len(glob)} global layers {len(glob)*2*hkv*kg*2} B/token")
