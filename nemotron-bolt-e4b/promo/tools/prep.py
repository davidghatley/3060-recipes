"""../promo-data.json -> src/data.json, and copy.md -> out/copy-filled.md.   Run:  python3 -I tools/prep.py

promo-data.json holds the headline numbers from RESULTS.md. Each one names where it was measured, and this script
reads that source and refuses to call the set "measured" if any value is missing or differs:
  speed      [value, label, case]           -> runs/ledger.jsonl (decode_tps; prefill_tps for pp-*; agg_tps for c4-agg*)
  other      [value, label, case, field]    -> runs/ledger.jsonl ('accept' or 'ttft' -> ttft_s)
  VRAM       [MiB, label, case]             -> runs/ledger.jsonl (vram_mib)
  needles    [ctx, label, case]             -> runs/ledger.jsonl ('found')
  codeeval   label                          -> runs/codeeval-lenient-<label>.json (strict / n)
  OOM        log                            -> the 4 x 64k + DFlash server log ('out of memory', 'cudaGraphInstantiate')
  text       statement                      -> RESULTS.md (word for word; keys starting readme_ -> README.md)
Derived numbers (speed-ups, the prefill ratio, lever gains, means of controls) are computed here, never typed, and
compared with the rounded figures RESULTS.md / README.md / PLAN.md state. A missing value stays null: the plates
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
FIELD = {'accept': 'accept', 'ttft': 'ttft_s'}


def m(ref, tol=0.005):
    """[value, label, case(, field)] checked against the ledger."""
    if ref is None:
        problems.append('missing value')
        return None
    v, label, case = ref[:3]
    if len(ref) > 3:
        what = FIELD[ref[3]]
    elif case.startswith('c4-agg'):
        what = 'agg_tps'
    elif case.startswith('pp-'):
        what = 'prefill_tps'
    else:
        what = 'decode_tps'
    row = ledger.get((label, case))
    if row is None:
        problems.append(f'{label} {case}: not in ledger')
        return None
    got = row.get(what)
    if got is None or abs(got - v) > tol:
        problems.append(f'{label} {case} {what}: promo-data says {v}, ledger says {got}')
    checked.append(f'{label}/{case}/{what}')
    return v


def vram(ref):
    v, label, case = ref
    row = ledger.get((label, case))
    got = row.get('vram_mib') if row else None
    if got != v:
        problems.append(f'vram {label} {case}: promo-data says {v}, ledger says {got}')
    checked.append(f'{label}/{case}/vram')
    return v


def needle(ref):
    ctx, label, case = ref
    row = ledger.get((label, case))
    found = row.get('found') if row else None
    if found is None:
        problems.append(f'needle {label} {case}: not in ledger')
    checked.append(f'{label}/{case}/found')
    return [ctx, found]


def codeeval(label):
    p = os.path.join(RUNS, f'codeeval-lenient-{label}.json')
    if not os.path.exists(p):
        problems.append(f'codeeval {label}: no file')
        return None
    c = json.load(open(p))
    checked.append(f'codeeval/{label}')
    return [c['strict'], c['n']]


mean = lambda xs: sum(xs) / len(xs) if xs and all(x is not None for x in xs) else None
ms = lambda refs: mean([m(r) for r in refs])
P = raw

S_ = P['stock']
stock = {k: m(S_[k]) for k in ('decode_think', 'decode_off', 'decode_60k', 'prefill_8k', 'prefill_32k', 'prefill_60k', 'ttft_61k')}
stock.update({'needles_61k': needle(S_['needles_61k']), 'vram_mib': vram(S_['vram'])})
T = P['tuned']
tuned = {k: m(T[k]) for k in ('decode_think', 'accept_think', 'decode_off', 'accept_off', 'decode_60k',
                              'prefill_8k', 'prefill_32k', 'prefill_60k', 'ttft_61k')}
tuned.update({'needles_32k': needle(T['needles_32k']), 'needles_61k': needle(T['needles_61k']),
              'codeeval_off': codeeval(T['codeeval_off']), 'codeeval_off_stock': codeeval(T['codeeval_off_stock']),
              'vram_mib': vram(T['vram'])})
N_ = P['nospec']
nospec = {k: m(N_[k]) for k in ('decode_off', 'decode_think', 'decode_60k', 'prefill_8k', 'prefill_32k', 'prefill_60k', 'ttft_61k')}
nospec.update({'needles_61k': needle(N_['needles_61k']), 'vram_mib': vram(N_['vram'])})
M_ = P['multi']
soak = [needle(s) for s in M_['soak']]
log = open(os.path.join(REC, M_['oom_log'])).read()
oom = 'out of memory' in log and 'cudaGraphInstantiate' in log
if not oom:
    problems.append('multi: OOM not found in ' + M_['oom_log'])
checked.append('multi/oom-log')
multi = {'c4': m(M_['c4']), 'c4_64k_nospec': m(M_['c4_64k_nospec']), 'soak': [s[1] for s in soak],
         'soak_ctx': soak[0][0], 'soak_all_clean': all(s[1] == '3/3' for s in soak), 'oom_64k_dflash': oom,
         'vram_mib': M_['vram_mib']}

L = P['levers']
lev = {
    'df_ctl_think': ms(L['df_controls_think']), 'df_think': m(L['df_think']),
    'kv_ctl_32k': ms(L['kv_controls_32k']), 'q8_32k': m(L['q8_32k']),
    'ub_ctl_pp8k': ms(L['ub_controls_pp8k']), 'ub_ctl_pp32k': ms(L['ub_controls_pp32k']),
    'ub_pp8k': m(L['ub1024_pp8k']), 'ub_pp32k': m(L['ub1024_pp32k']), 'draft_n': L['draft_n'],
}

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
    'speedup_think': tuned['decode_think'] / stock['decode_think'],
    'speedup_off': tuned['decode_off'] / stock['decode_off'],
    'speedup_60k': tuned['decode_60k'] / stock['decode_60k'],
    'prefill_ratio_8k': tuned['prefill_8k'] / stock['prefill_8k'],
    'prefill_ratio_32k': tuned['prefill_32k'] / stock['prefill_32k'],
    'prefill_ratio_60k': tuned['prefill_60k'] / stock['prefill_60k'],
    'nospec_vs_default_pp8k': nospec['prefill_8k'] / tuned['prefill_8k'],
    'df_lever_think': lev['df_think'] / lev['df_ctl_think'],
    'q8_slower_at_32k_pct': (1 - lev['q8_32k'] / lev['kv_ctl_32k']) * 100,
    'ub1024_pp8k_pct': g(lev['ub_pp8k'], lev['ub_ctl_pp8k']),
    'ub1024_pp32k_pct': g(lev['ub_pp32k'], lev['ub_ctl_pp32k']),
    'plain_pct_of_ceiling': nospec['decode_off'] / P['ceiling']['decode_plain'] * 100,
    'tokens_per_step_think': 1 + lev['draft_n'] * tuned['accept_think'],
}
rm = P['results_md']
for k, dp in [('speedup_think', 1), ('speedup_off', 1), ('speedup_60k', 1), ('prefill_ratio_8k', 2), ('df_lever_think', 1),
              ('q8_slower_at_32k_pct', 0), ('ub1024_pp8k_pct', 1), ('ub1024_pp32k_pct', 1), ('plain_pct_of_ceiling', 0)]:
    if round(derived[k], dp) != rm[k]:
        problems.append(f'derived {k}: {derived[k]:.3f} vs stated {rm[k]}')
checked.append('derived/tokens_per_step')
if round(derived['tokens_per_step_think'], 1) != 3.9:
    problems.append(f"derived tokens per step {derived['tokens_per_step_think']:.2f} vs README 3.9")

out = {
    'status': 'draft' if problems else 'measured',
    'problems': problems,
    'model': P['model'], 'engine': P['engine'], 'weights': P['weights'], 'ctx': P['ctx'], 'ceiling': P['ceiling'],
    'stock': stock, 'tuned': tuned, 'nospec': nospec, 'multi': multi, 'levers': lev, 'derived': derived,
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


def c(v):
    """whole number with a thousands comma, half up."""
    return '—' if v is None else f"{int(Decimal(repr(v)).quantize(Decimal('1'), ROUND_HALF_UP)):,}"


D_ = derived
fill = {
    'stock_think': r(stock['decode_think']), 'stock_off': r(stock['decode_off']), 'stock_60k': r(stock['decode_60k']),
    'think': r(tuned['decode_think']), 'off': r(tuned['decode_off']), 'd60k': r(tuned['decode_60k']),
    'x_think': r(D_['speedup_think']) + '×', 'x_off': r(D_['speedup_off']) + '×', 'x_60k': r(D_['speedup_60k']) + '×',
    'accept': f"{round(tuned['accept_think'] * 100)}%", 'tps': r(D_['tokens_per_step_think']),
    'pp_stock': c(stock['prefill_8k']), 'pp': c(tuned['prefill_8k']), 'pp_ns': c(nospec['prefill_8k']),
    'pp_ratio': r(D_['prefill_ratio_8k'], '0.01') + '×',
    'ttft_stock': r(stock['ttft_61k']), 'ttft': r(tuned['ttft_61k']), 'ttft_ns': r(nospec['ttft_61k']),
    'ns_dec': r(nospec['decode_off']), 'wall_pct': r(D_['plain_pct_of_ceiling'], '1'),
    'c4': r(multi['c4']), 'c4_64k': r(multi['c4_64k_nospec']),
    'needles': tuned['needles_61k'][1] or '—', 'vram': r(tuned['vram_mib'] / 1000, '0.1'),
    'q8_slower': r(D_['q8_slower_at_32k_pct'], '1'), 'ub_gain': r(D_['ub1024_pp8k_pct'], '0.1'),
    'code_off': '/'.join(map(str, tuned['codeeval_off'] or [])),
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
