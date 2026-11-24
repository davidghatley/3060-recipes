"""../promo-data.json -> src/data.json, and copy.md -> out/copy-filled.md.   Run:  python3 -I tools/prep.py

promo-data.json holds the headline numbers from RESULTS.md. Each one names where it was measured, and this script
reads that source and refuses to call the set "measured" if any value is missing or differs:
  speed      [value, label, case]  -> runs/ledger.jsonl (decode_tps; prefill_tps for pp-* and needle-* cases)
  needles    [ctx, label, case]    -> runs/ledger.jsonl ('found')
  KLD        [value, run]          -> runs/kld/summary.txt ('Mean    KLD' under '== <run>')
  codeeval   label                 -> runs/codeeval-<label>.json (passed / n)
  card line  mib                   -> runs/server-m00-card-line.log (the failed CUDA0 allocation, bytes / 2^20)
  text       statement             -> RESULTS.md (word for word; keys starting readme_ -> README.md)
Derived numbers (speed-ups, lever gains, means of controls) are computed here, never typed, and compared with the
rounded figures RESULTS.md states. A missing value stays null: the plates print a dash and their headers say DRAFT.
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
    ledger.setdefault((d['label'], d['case']), d)   # first row per (label, case); -med rows are written once

kld_runs, cur = {}, None
for line in open(os.path.join(RUNS, 'kld', 'summary.txt')):
    mm = re.match(r'== (\S+ \S+) ', line)
    if mm:
        cur = mm.group(1)
    mm = re.match(r'Mean\s+KLD:\s+([0-9.]+)', line)
    if mm and cur:
        kld_runs[cur] = float(mm.group(1))

problems, checked, used = [], [], set()


def m(ref):
    if ref is None:
        problems.append('missing value')
        return None
    v, label, case = ref
    what = 'prefill_tps' if case.startswith(('pp-', 'needle-')) else 'decode_tps'
    row = ledger.get((label, case))
    if row is None:
        problems.append(f'{label} {case}: not in ledger')
        return None
    got = row.get(what)
    if got is None or abs(got - v) > 0.005:
        problems.append(f'{label} {case}: promo-data says {v}, ledger says {got}')
    checked.append(f'{label}/{case}')
    return v


def needle(ref):
    ctx, label, case = ref
    row = ledger.get((label, case))
    found = row.get('found') if row else None
    if found is None:
        problems.append(f'needle {label} {case}: not in ledger')
    checked.append(f'{label}/{case}')
    return [ctx, found]


def kld(ref):
    v, run = ref
    got = kld_runs.get(run)
    if got is None or abs(round(got, 3) - v) > 0.0005:
        problems.append(f'KLD {run}: promo-data says {v}, summary.txt says {got}')
    checked.append(f'kld/{run}')
    return v


def codeeval(label):
    p = os.path.join(RUNS, f'codeeval-{label}.json')
    if not os.path.exists(p):
        problems.append(f'codeeval {label}: no file')
        return None
    c = json.load(open(p))
    checked.append(f'codeeval/{label}')
    return [c['passed'], c['n']]


mean = lambda xs: sum(xs) / len(xs) if xs and all(x is not None for x in xs) else None
ms = lambda refs: mean([m(r) for r in refs])
P = raw

stock = {k: m(P['stock'][k]) for k in ('decode', 'prefill_8k', 'decode_32k', 'prefill_32k')}
stock['vram_gb'] = P['stock']['vram_gb']
T = P['tuned']
tuned = {k: m(T[k]) for k in ('decode', 'decode_32k', 'prefill_8k', 'prefill_32k', 'prefill_65k')}
tuned.update({'needles_32k': needle(T['needles_32k']), 'codeeval': codeeval(T['codeeval']), 'vram_gb': T['vram_gb'],
              'cache_mib': T['cache_mib'], 'ub': T['ub']})

L = P['levers']
lev = {
    'pinned': ms(L['pinned_controls']), 'cache': m(L['cache_decode']),
    'lm_ctl': ms(L['loadmode_controls_pp']), 'lm': m(L['loadmode_pp']),
    'q8_empty': m(L['q8_empty']), 'f16_empty': ms(L['f16_empty']),
    'q8_32k': ms(L['q8_32k']), 'f16_32k': m(L['f16_32k']),
    'ub512_pp': ms(L['ub512_pp']), 'ub1024_pp': m(L['ub1024']['prefill']), 'ub1024_dec': m(L['ub1024']['decode']),
    'pinned_layers': L['pinned_layers'], 'cache_mib': L['cache_mib_tuning'],
}
U = P['uncensored']
unc = {'decode': m(U['decode']), 'control': ms(U['controls']), 'controls': [m(c) for c in U['controls']],
       'decode_32k': m(U['decode_32k']), 'kld': [kld(k) for k in U['kld']]}

# the card line: the failed CUDA0 buffer in its server log, in MiB
log = open(os.path.join(REC, P['card_line']['log'])).read()
mm = re.search(r'failed to allocate CUDA0 buffer of size (\d+)', log)
card_mib = round(int(mm.group(1)) / 1048576) if mm else None
if card_mib != P['card_line']['mib']:
    problems.append(f"card line: promo-data says {P['card_line']['mib']} MiB, log says {card_mib}")
checked.append('card-line/log')

ws = lambda s: re.sub(r'\s+', ' ', s)   # line wraps in the markdown do not count
results_md = ws(open(os.path.join(REC, 'RESULTS.md')).read())
readme_md = ws(open(os.path.join(REC, 'README.md')).read())
for k, s in P['text'].items():
    if k.startswith('_'):
        continue
    if ws(s) not in (readme_md if k.startswith('readme_') else results_md):
        problems.append(f'text {k}: not found word for word')
    checked.append(f'text/{k}')

g = lambda a, b: (a / b - 1) * 100 if (a and b) else None
derived = {
    'speedup_decode': tuned['decode'] / stock['decode'],
    'speedup_decode_32k': tuned['decode_32k'] / stock['decode_32k'],
    'speedup_prefill_8k': tuned['prefill_8k'] / stock['prefill_8k'],
    'speedup_prefill_32k': tuned['prefill_32k'] / stock['prefill_32k'],
    'cache_gain_pct': g(lev['cache'], lev['pinned']),
    'loadmode_gain_pct': g(lev['lm'], lev['lm_ctl']),
    'q8_slower_at_32k_pct': (1 - lev['q8_32k'] / lev['f16_32k']) * 100,
    'ub1024_prefill_pct': g(lev['ub1024_pp'], lev['ub512_pp']),
    'ub1024_decode_pct': g(lev['ub1024_dec'], lev['f16_empty']),
    'lora_cost_pct': g(unc['decode'], unc['control']),
}
rm = P['results_md']
for k, dp in [('speedup_decode', 2), ('speedup_decode_32k', 2), ('speedup_prefill_8k', 2), ('cache_gain_pct', 0),
              ('loadmode_gain_pct', 0), ('q8_slower_at_32k_pct', 0), ('ub1024_prefill_pct', 0), ('ub1024_decode_pct', 1)]:
    if round(derived[k], dp) != rm[k]:
        problems.append(f'derived {k}: {derived[k]:.3f} vs RESULTS.md {rm[k]}')

out = {
    'status': 'draft' if problems else 'measured',
    'problems': problems,
    'model': P['model'], 'engine': P['engine'], 'weights': P['weights'], 'ctx': P['ctx'],
    'stock': stock, 'tuned': tuned, 'levers': lev, 'uncensored': unc, 'derived': derived,
    'card_line': {'flags': P['card_line']['flags'], 'mib': card_mib},
}
os.makedirs(os.path.dirname(DST), exist_ok=True)
json.dump(out, open(DST, 'w'), indent=1, ensure_ascii=False)
print(f"prep: {out['status']}; {len(checked)} source values checked", file=sys.stderr)
for p in problems:
    print(f'prep: PROBLEM {p}', file=sys.stderr)


# ---------- copy.md -> out/copy-filled.md ----------
def r(v, q='0.1'):
    """round half up from the decimal string, as the plates do (JS toLocaleString)."""
    return '—' if v is None else str(Decimal(repr(round(v, 6))).quantize(Decimal(q), ROUND_HALF_UP))


D_ = derived
fill = {
    'stock_dec': r(stock['decode']), 'stock_32k': r(stock['decode_32k']), 'stock_pp': r(stock['prefill_8k'], '1'),
    'dec': r(tuned['decode']), 'dec_32k': r(tuned['decode_32k']), 'pp': r(tuned['prefill_8k'], '1'),
    'pp_32k': r(tuned['prefill_32k'], '1'), 'pp_65k': r(tuned['prefill_65k'], '1'),
    'x_dec': r(D_['speedup_decode'], '0.01') + '×', 'x_32k': r(D_['speedup_decode_32k'], '0.01') + '×',
    'x_pp': r(D_['speedup_prefill_8k'], '0.01') + '×',
    'pinned': r(lev['pinned']), 'cache': r(lev['cache']), 'cache_gain': r(D_['cache_gain_pct'], '1'),
    'lm_ctl': r(lev['lm_ctl'], '1'), 'lm': r(lev['lm'], '1'), 'lm_gain': r(D_['loadmode_gain_pct'], '1'),
    'q8_32k': r(lev['q8_32k']), 'f16_32k': r(lev['f16_32k']), 'q8_slower': r(D_['q8_slower_at_32k_pct'], '1'),
    'ub_pp_gain': r(D_['ub1024_prefill_pct'], '1'), 'ub_dec_cost': r(-D_['ub1024_decode_pct'], '0.1'),
    'unc_dec': r(unc['decode']), 'unc_ctl_a': r(unc['controls'][0]), 'unc_ctl_b': r(unc['controls'][1]),
    'needles_32k': tuned['needles_32k'][1] or '—', 'card_mib': f'{card_mib:,}' if card_mib else '—',
    'vram': r(tuned['vram_gb'], '0.01'), 'code': '/'.join(map(str, tuned['codeeval'] or [])),
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
