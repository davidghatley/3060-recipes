"""../promo-data.json -> src/data.json, and copy.md -> out/copy-filled.md.   Run:  python3 -I tools/prep.py

promo-data.json holds the headline numbers from RESULTS.md. Each one names where it was measured, and this script
reads that source and refuses to call the set "measured" if any value is missing or differs:
  speed      [value, label, case]  -> runs/ledger.jsonl (decode_tps / prefill_tps)
  needles    [ctx, label, case]    -> runs/ledger.jsonl ('found')
  KLD        [value, run]          -> runs/kld/summary.txt ('Mean    KLD' under '== <run>')
  refusal    label                 -> runs/refusal-reread.json (answered / hedged / refused)
  codeeval   label                 -> runs/codeeval-<label>.json (passed / n)
  image      smoke file            -> runs/<file> (the answer names red and blue)
  base KLD   text                  -> ../inkling-2-mini/RESULTS.md (base recipe, reported there)
Derived numbers (speed-ups, percent costs, the mean of two controls, the KLD ratio) are computed here, never typed,
and compared with the rounded figures RESULTS.md states. A missing value stays null: the plates print a dash and
their headers say DRAFT.
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
    ledger.setdefault((d['label'], d['case']), d)   # the -med rows are written once per run

kld_runs, ppl_ratio, cur = {}, {}, None
for line in open(os.path.join(RUNS, 'kld', 'summary.txt')):
    mm = re.match(r'== (\S+ \S+) ', line)
    if mm:
        cur = mm.group(1)
    mm = re.match(r'Mean\s+KLD:\s+([0-9.]+)', line)
    if mm and cur:
        kld_runs[cur] = float(mm.group(1))
    mm = re.match(r'Mean PPL\(Q\)/PPL\(base\)\s+:\s+([0-9.]+)', line)
    if mm and cur:
        ppl_ratio[cur] = float(mm.group(1))
refusal = json.load(open(os.path.join(RUNS, 'refusal-reread.json')))

problems, checked = [], []


def m(ref, what='decode_tps'):
    if ref is None:
        problems.append('missing value')
        return None
    v, label, case = ref
    row = ledger.get((label, case))
    if row is None:
        problems.append(f'{label} {case}: not in ledger')
        return None
    got = row.get(what)
    if got is None or abs(got - v) > 0.005:
        problems.append(f'{label} {case}: promo-data says {v}, ledger says {got}')
    checked.append(f'{label}/{case}')
    return v


def kld(ref):
    v, run = ref
    got = kld_runs.get(run)
    # summary.txt has six decimals; RESULTS.md rounds to four
    if got is None or abs(round(got, 4) - v) > 0.00005:
        problems.append(f'KLD {run}: promo-data says {v}, summary.txt says {got}')
    checked.append(f'kld/{run}')
    return v


def needle(ref):
    ctx, label, case = ref
    row = ledger.get((label, case))
    found = row.get('found') if row else None
    if found is None:
        problems.append(f'needle {label} {case}: not in ledger')
    checked.append(f'{label}/{case}')
    return [ctx, found]


def ref_counts(label):
    c = refusal.get(label, {}).get('counts')
    if c is None:
        problems.append(f'refusal {label}: not in refusal-reread.json')
        return None
    checked.append(f'refusal/{label}')
    return {'answered': c['answered'], 'hedged': c['hedged'], 'refused': c['refused'], 'n': sum(c.values())}


def codeeval(label):
    p = os.path.join(RUNS, f'codeeval-{label}.json')
    if not os.path.exists(p):
        problems.append(f'codeeval {label}: no file')
        return None
    c = json.load(open(p))
    checked.append(f'codeeval/{label}')
    return [c['passed'], c['n']]


def image(fname):
    if not fname:
        return None
    s = json.load(open(os.path.join(RUNS, fname)))
    a = (s.get('image') or {}).get('content', '')
    ok = 'red' in a and 'blue' in a and 'white square' in a
    if not ok:
        problems.append(f'image {fname}: answer does not describe the test image')
    checked.append(f'image/{fname}')
    return {'pass': ok, 'answer': a}


mean = lambda xs: sum(xs) / len(xs) if xs and all(x is not None for x in xs) else None

variants = []
for v in raw['variants']:
    o = {k: v[k] for k in ('id', 'name', 'by', 'file') if k in v}
    o['how'] = v.get('how', 'control')
    o['decode'] = m(v['decode'])
    o['prefill_8k'] = m(v['prefill_8k'], 'prefill_tps')
    if v['id'] == 'base':
        o['decode'] = mean([o['decode'], m(v['decode_b'])])
        o['prefill_8k'] = mean([o['prefill_8k'], m(v['prefill_8k_b'], 'prefill_tps')])
        o['kld'] = raw['base_recipe']['kld']
    else:
        o['kld'] = [kld(r) for r in v['kld']]
    ctl = [m(c) for c in v.get('controls', [])]
    o['control'] = mean(ctl)
    o['vs_control_pct'] = (o['decode'] / o['control'] - 1) * 100 if (o['decode'] and o['control']) else None
    o['decode_32k'] = m(v['decode_32k']) if v.get('decode_32k') else None
    o['needles'] = [needle(n) for n in v.get('needles', [])]
    o['refusal'] = ref_counts(v['refusal'])
    o['codeeval'] = codeeval(v['codeeval'])
    o['image'] = image(v.get('image'))
    variants.append(o)
V = {v['id']: v for v in variants}

# base recipe KLD, reported in its RESULTS.md
base_md = open(os.path.join(REC, '..', 'inkling-2-mini', 'RESULTS.md')).read()
if raw['base_recipe']['kld_text'] not in base_md:
    problems.append('base KLD text not found in ../inkling-2-mini/RESULTS.md')
checked.append('base-recipe/kld')

stock = {'decode': m(raw['stock']['decode']), 'prefill_8k': m(raw['stock']['prefill_8k'], 'prefill_tps'),
         'card_line_mib': raw['stock']['card_line_mib']}
ad = V['atomicchat']
derived = {
    'speedup_decode': ad['decode'] / stock['decode'],
    'speedup_prefill': ad['prefill_8k'] / stock['prefill_8k'],
    'nokeepai_cost_pct': -V['nokeepai']['vs_control_pct'],
    'atomicchat_lora_cost_pct': -V['atomicchat-lora']['vs_control_pct'],
    'kld_ratio': V['nokeepai-merged']['kld'][0] / ad['kld'][0],
    'nkm_ppl_pct': (ppl_ratio['nokeepai-merged wiki'] - 1) * 100,
    'ad_ppl_pct': (ppl_ratio['atomicchat-ad-q4k wiki'] - 1) * 100,
}
rm = raw['results_md']
for k, want, got, dp in [('speedup_decode_vs_stock', rm['speedup_decode_vs_stock'], derived['speedup_decode'], 2),
                         ('speedup_prefill_vs_stock', rm['speedup_prefill_vs_stock'], derived['speedup_prefill'], 2),
                         ('nokeepai_runtime_cost_pct', rm['nokeepai_runtime_cost_pct'], derived['nokeepai_cost_pct'], 0),
                         ('atomicchat_lora_cost_pct', rm['atomicchat_lora_cost_pct'], derived['atomicchat_lora_cost_pct'], 0),
                         ('nokeepai_vs_atomicchat_kld', rm['nokeepai_vs_atomicchat_kld'], derived['kld_ratio'], 0),
                         ('nokeepai_wiki_ppl_pct', rm['nokeepai_wiki_ppl_pct'], derived['nkm_ppl_pct'], 0)]:
    if round(got, dp) != want:
        problems.append(f'derived {k}: {got:.3f} vs RESULTS.md {want}')

out = {
    'status': 'draft' if problems else 'measured',
    'problems': problems,
    'engine': raw['engine'],
    'stock': stock,
    'variants': variants,
    'derived': derived,
    'facts': raw['facts'],
}
os.makedirs(os.path.dirname(DST), exist_ok=True)
json.dump(out, open(DST, 'w'), indent=1, ensure_ascii=False)
print(f"prep: {out['status']}; {len(checked)} source values checked", file=sys.stderr)
for p in problems:
    print(f'prep: PROBLEM {p}', file=sys.stderr)

# ---------- copy.md -> out/copy-filled.md ----------
def r(v, q='0.1'):
    """round half up from the decimal string, as the plates do (JS toLocaleString)."""
    return '—' if v is None else str(Decimal(repr(v)).quantize(Decimal(q), ROUND_HALF_UP))
ans = lambda i: f"{V[i]['refusal']['answered']}/{V[i]['refusal']['n']}"
fill = {
    'base_dec': r(V['base']['decode']), 'base_pp': r(V['base']['prefill_8k'], '1'),
    'ad_dec': r(ad['decode']), 'ad_pp': r(ad['prefill_8k'], '1'), 'ad_32k': r(ad['decode_32k']),
    'ad_needles': ', '.join(f'{c} {f}' for c, f in ad['needles']),
    'ad_kld': r(ad['kld'][0], '0.001'), 'ad_kld_code': r(ad['kld'][1], '0.001'),
    'base_kld': str(V['base']['kld'][0]), 'base_kld_code': str(V['base']['kld'][1]),
    'ad_ans': ans('atomicchat'), 'base_ans': str(V['base']['refusal']['answered']), 'base_hedged': str(V['base']['refusal']['hedged']),
    'ad_code': '/'.join(map(str, ad['codeeval'])),
    'nkm_dec': r(V['nokeepai-merged']['decode']), 'nkm_pp': r(V['nokeepai-merged']['prefill_8k'], '1'),
    'nkm_kld': r(V['nokeepai-merged']['kld'][0], '0.001'), 'nkm_ans': ans('nokeepai-merged'),
    'nk_dec': r(V['nokeepai']['decode']), 'nk_cost': r(derived['nokeepai_cost_pct'], '1'), 'nk_ans': ans('nokeepai'),
    'acl_dec': r(V['atomicchat-lora']['decode']), 'acl_cost': r(derived['atomicchat_lora_cost_pct'], '1'),
    'acl_kld': r(V['atomicchat-lora']['kld'][0], '0.001'),
    'kld_ratio': r(derived['kld_ratio'], '1'),
    'nkm_ppl': r(derived['nkm_ppl_pct'], '1'), 'ad_ppl': r(derived['ad_ppl_pct'], '0.1'),
    'stock_dec': r(stock['decode']), 'stock_pp': r(stock['prefill_8k'], '1'),
    'speedup': r(derived['speedup_decode'], '0.01') + '×', 'speedup_pp': r(derived['speedup_prefill'], '0.01') + '×',
    'card_mib_ad': f"{stock['card_line_mib'][0]:,}", 'card_mib_nk': f"{stock['card_line_mib'][1]:,}",
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
