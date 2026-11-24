"""../promo-data.json -> src/data.json, and copy.md -> out/copy-filled.md.   Run:  python3 -I tools/prep.py

promo-data.json holds the headline numbers from RESULTS.md. Each one names where it was measured, and this script
reads that source and refuses to call the set "measured" if any value is missing or differs:
  speed      [value, label, case(, field)] -> runs/ledger.jsonl (decode_tps; prefill_tps for pp-*; ttft_s for needle-*)
  needles    [ctx, label, case]            -> runs/ledger.jsonl ('found', and the prompt length behind the ctx label)
  codeeval   label                         -> runs/codeeval-<label>.json (passed / n)
  refusal    label                         -> runs/refusal-<label>.json (classifier counts; the hand reading is text)
  greedy     [plain, mtp]                  -> runs/greedy/<name>.json (texts compared exactly)
  longans    names                         -> runs/longans/<name>.json (finished, capped, zlib loop flags, decode range)
  kld        values                        -> runs/kld/summary.txt ('Mean KLD' per section)
  vram       default.vram_mib              -> ../best-config.json
  text       statement                     -> RESULTS.md (word for word; readme_ keys -> README.md, theory_ -> THEORY.md)
Derived numbers (speed-ups, the head's share of the bytes, percent of ceiling, prefill cost) are computed here, never
typed, and compared with the rounded figures RESULTS.md / README.md state. A missing value stays null: the plates
print a dash and their headers say DRAFT.
"""
import json, os, re, sys
from decimal import Decimal, ROUND_HALF_UP

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.dirname(HERE)
RUNS = os.path.join(REC, 'runs')
raw = json.load(open(os.path.join(REC, 'promo-data.json')))
DST = os.path.join(HERE, 'src', 'data.json')

ledger = {}
for line in open(os.path.join(RUNS, 'ledger.jsonl')):
    d = json.loads(line)
    ledger.setdefault((d['label'], d['case']), d)   # first row per (label, case); -med and needle rows are written once

problems, checked = [], []


def m(ref):
    if ref is None:
        problems.append('missing value')
        return None
    v, label, case = ref[:3]
    what = ref[3] if len(ref) > 3 else ('prefill_tps' if case.startswith('pp-') else 'ttft_s' if case.startswith('needle-') else 'decode_tps')
    row = ledger.get((label, case))
    if row is None:
        problems.append(f'{label} {case}: not in ledger')
        return None
    got = row.get(what)
    if got is None or abs(got - v) > 0.0005:
        problems.append(f'{label} {case} {what}: promo-data says {v}, ledger says {got}')
    checked.append(f'{label}/{case}/{what}')
    return v


def needle(ref):
    ctx, label, case = ref
    row = ledger.get((label, case))
    found = row.get('found') if row else None
    if found is None:
        problems.append(f'needle {label} {case}: not in ledger')
        return [ctx, None]
    # the ctx label is the prompt length in thousands to one decimal, as RESULTS.md writes it (61,841 -> 61.8k)
    k = Decimal(row['prompt_n']) / 1000
    if f"{k.quantize(Decimal('0.1'), ROUND_HALF_UP)}k" != ctx:
        problems.append(f'needle {label} {case}: label {ctx}, prompt {row["prompt_n"]}')
    checked.append(f'{label}/{case}/found')
    return [ctx, found]


def codeeval(label):
    p = os.path.join(RUNS, f'codeeval-{label}.json')
    if not os.path.exists(p):
        problems.append(f'codeeval {label}: no file')
        return None
    c = json.load(open(p))
    checked.append(f'codeeval/{label}')
    return [c['passed'], c['n']]


def greedy(pair):
    a, b = (json.load(open(os.path.join(RUNS, 'greedy', f'{x}.json')))['rows'] for x in pair)
    checked.append(f'greedy/{pair[0]}+{pair[1]}')
    return sum(x['text'] == y['text'] for x, y in zip(a, b)), len(a)


def longans(name):
    rows = json.load(open(os.path.join(RUNS, 'longans', f'{name}.json')))['rows']
    checked.append(f'longans/{name}')
    return rows


mean = lambda xs: sum(xs) / len(xs) if xs and all(x is not None for x in xs) else None
P = raw


def block(key, speeds, needles=(), extra=()):
    B = P[key]
    out = {k: m(B[k]) for k in speeds if k in B}
    out.update({k: needle(B[k]) for k in needles if k in B})
    out.update({k: B[k] for k in extra if k in B})
    if 'codeeval' in B:
        out['codeeval'] = codeeval(B['codeeval'])
    return out


SP = ('decode_off', 'decode_on', 'decode_deep', 'accept_off', 'accept_on', 'prefill_8k', 'prefill_32k', 'ttft_95')
NE = ('needles_50', 'needles_95')
stock = block('stock', SP, NE)
default = block('default', SP, NE, ('vram_mib',))
fast = block('fast', SP, NE)
nospec = block('nospec', SP, NE)
long_ = block('long', SP, NE)

bc = json.load(open(os.path.join(REC, 'best-config.json')))
if bc['default']['measured']['vram_card_mib'] != default['vram_mib']:
    problems.append(f'default vram: promo-data {default["vram_mib"]}, best-config {bc["default"]["measured"]["vram_card_mib"]}')
checked.append('best-config/vram_card_mib')

H = P['head_ab']
head_ab = {'ctl': [m(r) for r in H['ctl']], 'headq8': m(H['headq8']), 'mtp2': m(H['mtp2']), 'headq8_mtp2': m(H['headq8_mtp2'])}
head_ab['ctl_mean'] = mean(head_ab['ctl'])

# KLD from runs/kld/summary.txt: "== <name> ..." sections, each with one "Mean    KLD:" line
kld_txt = open(os.path.join(RUNS, 'kld', 'summary.txt')).read()
kld_found = {}
for sec in re.split(r'^== ', kld_txt, flags=re.M)[1:]:
    name = sec.split()[0] + '_' + sec.split()[1]          # e.g. headq8_wiki
    mm = re.search(r'Mean\s+KLD:\s+([0-9.]+)', sec)
    if mm:
        kld_found[name] = float(mm.group(1))
K = P['kld']
for key, sec in (('head_wiki', 'headq8_wiki'), ('head_code', 'headq8_code'), ('kv_q8_wiki', 'kv-q8_wiki'), ('kv_q8_code', 'kv-q8_code')):
    if kld_found.get(sec) != K[key]:
        problems.append(f'kld {key}: promo-data {K[key]}, summary.txt {kld_found.get(sec)}')
    checked.append(f'kld/{sec}')
kld = {k: v for k, v in K.items() if not k.startswith('_')}

LA = P['longans']
la_m, la_n, la_24 = longans(LA['mtp']), longans(LA['nospec']), longans(LA['long24k'])
def la_sum(rows):
    zs = [z for r in rows for z in (r['z_reasoning'], r['z_content']) if z is not None]
    return {'finished': sum(r['finish'] == 'stop' for r in rows), 'capped': sum(r['finish'] == 'length' for r in rows), 'n': len(rows),
            'loops': sum(any(z is not None and z < LA['z_floor'] for z in (r['z_reasoning'], r['z_content'])) for r in rows),
            'z_min': min(zs), 'z_max': max(zs), 'tps_min': min(r['decode_tps'] for r in rows), 'tps_max': max(r['decode_tps'] for r in rows)}
long_ans = {'mtp': la_sum(la_m), 'nospec': la_sum(la_n)}
for side in ('mtp', 'nospec'):
    s = long_ans[side]
    if (s['finished'], s['capped'], s['n'], s['loops']) != (LA['finished'], LA['capped'], LA['n'], LA['loops']):
        problems.append(f'longans {side}: {s}')
cap_m = [r['name'] for r in la_m if r['finish'] == 'length']
cap_n = [r['name'] for r in la_n if r['finish'] == 'length']
if cap_m != cap_n:
    problems.append(f'longans: capped prompts differ {cap_m} vs {cap_n}')
r24 = la_24[0]
if r24['gen_n'] != LA['gen_24k'] or min(z for z in (r24['z_reasoning'], r24['z_content']) if z is not None) < LA['z_floor']:
    problems.append(f'longans 24k: {r24["gen_n"]} tokens, z {r24["z_reasoning"]}')
long_ans['tokens_24k'] = r24['gen_n']
long_ans['z_24k'] = r24['z_reasoning']

G = P['greedy']
same_on, n_on = greedy(G['on'])
same_off, n_off = greedy(G['off'])
if (same_on, n_on, same_off, n_off) != (G['identical_on'], G['n_on'], G['identical_off'], G['n_off']):
    problems.append(f'greedy: files {same_on}/{n_on} on, {same_off}/{n_off} off')
greedy_out = {'identical_on': same_on, 'n_on': n_on, 'identical_off': same_off, 'n_off': n_off}

R = P['refusal']
rc = json.load(open(os.path.join(RUNS, f'refusal-{R["label"]}.json')))
checked.append(f'refusal/{R["label"]}')
refusal = {'answered': rc['counts']['answered'], 'refused': rc['counts']['refused'], 'n': rc['n'], 'answered_by_hand': R['answered_by_hand']}
if rc['counts']['answered'] != R['answered_by_hand'] or rc['n'] != R['n']:
    problems.append(f'refusal: classifier {rc["counts"]} of {rc["n"]} vs hand {R["answered_by_hand"]}/{R["n"]}')

ws = lambda s: re.sub(r'\s+', ' ', s)   # line wraps in the markdown do not count
docs = {p: ws(open(os.path.join(REC, f)).read()) for p, f in (('', 'RESULTS.md'), ('readme_', 'README.md'), ('theory_', 'THEORY.md'))}
for k, s in P['text'].items():
    if k.startswith('_'):
        continue
    src = docs['readme_'] if k.startswith('readme_') else docs['theory_'] if k.startswith('theory_') else docs['']
    if ws(s) not in src:
        problems.append(f'text {k}: not found word for word')
    checked.append(f'text/{k}')

Bt, C = P['bytes'], P['ceilings']
x = lambda a, b: a / b if (a and b) else None
g = lambda a, b: (a / b - 1) * 100 if (a and b) else None
derived = {
    'x_default': x(default['decode_off'], stock['decode_off']),
    'x_on': x(default['decode_on'], stock['decode_on']),
    'x_deep': x(default['decode_deep'], stock['decode_deep']),
    'x_fast': x(fast['decode_off'], stock['decode_off']),
    'x_fast_on': x(fast['decode_on'], stock['decode_on']),
    'head_pct': Bt['head_bf16'] / Bt['total'] * 100,
    'draft_pct': Bt['draft'] / Bt['total'] * 100,
    'bytes_sum': Bt['blocks'] + Bt['head_bf16'] + Bt['state'],
    'bytes_q8': Bt['blocks'] + Bt['head_q8'] + Bt['state'],
    'ceiling_pct': default['decode_off'] / C['default'] * 100,
    'fast_ceiling_pct': fast['decode_off'] / C['fast'] * 100,
    'plain_ceiling_pct': stock['decode_off'] / C['plain'] * 100,
    'prefill_cost_pct': -g(default['prefill_8k'], stock['prefill_8k']),
    'headq8_plain_pct': g(head_ab['headq8'], head_ab['ctl_mean']),
    'headq8_mtp_pct': g(head_ab['headq8_mtp2'], head_ab['mtp2']),
    'accept_off_pct': default['accept_off'] * 100, 'accept_on_pct': default['accept_on'] * 100,
}
rm = P['results_md']
for k in ('x_default', 'x_deep', 'x_fast', 'x_on'):
    if round(derived[k], 1) != rm[k]:
        problems.append(f'derived {k}: {derived[k]:.3f} vs stated {rm[k]}')
for k in ('head_pct', 'draft_pct', 'ceiling_pct', 'fast_ceiling_pct', 'plain_ceiling_pct', 'prefill_cost_pct', 'headq8_plain_pct', 'headq8_mtp_pct', 'accept_off_pct', 'accept_on_pct'):
    if round(derived[k]) != rm[k]:
        problems.append(f'derived {k}: {derived[k]:.3f} vs stated {rm[k]}')
if round(derived['bytes_sum'], 2) != Bt['total']:
    problems.append(f'bytes: {derived["bytes_sum"]:.3f} vs {Bt["total"]}')

out = {
    'status': 'draft' if problems else 'measured',
    'problems': problems,
    'model': P['model'], 'engine': P['engine'], 'bytes': Bt, 'ceilings': C,
    'stock': stock, 'default': default, 'fast': fast, 'nospec': nospec, 'long': long_, 'head_ab': head_ab, 'kld': kld,
    'longans': long_ans, 'greedy': greedy_out, 'refusal': refusal, 'derived': derived,
}
os.makedirs(os.path.dirname(DST), exist_ok=True)
json.dump(out, open(DST, 'w'), indent=1, ensure_ascii=False)
print(f"prep: {out['status']}; {len(checked)} source values checked", file=sys.stderr)
for p in problems:
    print(f'prep: PROBLEM {p}', file=sys.stderr)
used = {k for k in raw if not k.startswith('_')} - {'model', 'engine', 'bytes', 'ceilings', 'stock', 'default', 'fast', 'nospec', 'long', 'head_ab', 'kld', 'longans', 'greedy', 'refusal', 'results_md', 'text'}
if used:
    print(f"prep: promo-data keys not used: {', '.join(sorted(used))}", file=sys.stderr)


# ---------- copy.md -> out/copy-filled.md ----------
def r(v, q='0.1'):
    """round half up from the decimal string, as the plates do (JS toLocaleString)."""
    return '—' if v is None else f"{Decimal(repr(round(v, 6))).quantize(Decimal(q), ROUND_HALF_UP):,}"


D_ = derived
fill = {
    'stock_off': r(stock['decode_off']), 'stock_on': r(stock['decode_on']), 'stock_deep': r(stock['decode_deep']),
    'def_off': r(default['decode_off']), 'def_on': r(default['decode_on']), 'def_deep': r(default['decode_deep']),
    'fast_off': r(fast['decode_off']), 'fast_deep': r(fast['decode_deep']),
    'x_def': r(D_['x_default']), 'x_deep': r(D_['x_deep']), 'x_fast': r(D_['x_fast']),
    'accept': r(default['accept_off'], '0.01'), 'ceil_pct': r(D_['ceiling_pct'], '1'),
    'head_pct': r(D_['head_pct'], '1'), 'kld_head': r(kld['head_wiki'], '0.0001'),
    'stock_pp': r(stock['prefill_8k'], '1'), 'def_pp': r(default['prefill_8k'], '1'), 'pp_cost': r(D_['prefill_cost_pct'], '1'),
    'la_fin': str(long_ans['mtp']['finished']), 'la_n': str(long_ans['mtp']['n']), 'tok24k': f"{long_ans['tokens_24k'] // 1000}k",
    'needle_long': long_['needles_95'][0].replace('.0k', 'k'), 'ref_ans': str(refusal['answered_by_hand']), 'ref_n': str(refusal['n']),
    'g_on': f"{greedy_out['identical_on']}/{greedy_out['n_on']}",
}
COPY = os.path.join(HERE, 'copy.md')
if os.path.exists(COPY):
    src = open(COPY).read()
    text = src
    for k, v in fill.items():
        text = text.replace('{{' + k + '}}', v)
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    open(os.path.join(HERE, 'out', 'copy-filled.md'), 'w').write(text)
    left = sorted(set(re.findall(r'\{\{(\w+)\}\}', text)))
    print(f"prep: out/copy-filled.md written; tokens still open: {', '.join(left) or 'none'}", file=sys.stderr)
    unused = sorted(k for k in fill if '{{' + k + '}}' not in src)
    if unused:
        print(f"prep: fill values not used in copy.md: {', '.join(unused)}", file=sys.stderr)
