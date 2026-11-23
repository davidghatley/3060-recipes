"""Parameter counts per forward pass from a GGUF header (matmul weights only, token_embd excluded).
    python3 -I tools/params.py FILE"""
import struct, re, sys
f = open(sys.argv[1], 'rb')
rd = lambda fmt: struct.unpack('<' + fmt, f.read(struct.calcsize('<' + fmt)))[0]
def rstr(): n = rd('Q'); return f.read(n).decode('utf-8', 'replace')
def skip(t):
    if t == 8: rstr(); return
    if t == 9:
        et, n = rd('I'), rd('Q')
        for _ in range(n): skip(et)
        return
    f.read({0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8}[t])
f.read(4); rd('I'); nt = rd('Q'); nkv = rd('Q')
for _ in range(nkv): rstr(); skip(rd('I'))
el = {}
for _ in range(nt):
    name = rstr(); nd = rd('I'); sh = [rd('Q') for _ in range(nd)]; rd('I'); rd('Q')
    n = 1
    for d in sh: n *= d
    el[name] = n
per = {}
for n, v in el.items():
    m = re.match(r'blk\.(\d+)\.', n)
    if m: per[int(m.group(1))] = per.get(int(m.group(1)), 0) + v
loop = sum(v for k, v in per.items() if 4 <= k < 28)
trunk = sum(v for k, v in per.items() if k != 56)
out = el['output.weight']
print(f"physical trunk {trunk/1e9:.3f} B, loop block {loop/1e9:.3f} B, lm head {out/1e9:.3f} B, MTP layer {per.get(56,0)/1e9:.3f} B, "
      f"token_embd {el['token_embd.weight']/1e9:.3f} B, all {sum(el.values())/1e9:.3f} B")
print(f"per forward pass at loop 2: {(trunk+loop+out)/1e9:.3f} B params -> {2*(trunk+loop+out)/1e9:.1f} GFLOP per token")
