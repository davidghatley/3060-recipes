"""../promo-data.json -> src/data.json, and copy.md -> out/copy-filled.md.   Run:  python3 -I tools/prep.py

promo-data.json holds the headline numbers from RESULTS.md. Each one names where it was measured, and this script
reads that source and refuses to call the set "measured" if any value is missing or differs:
  speed      [value, label, case(, field)] -> runs/ledger.jsonl (decode_tps; prefill_tps for pp-*; ttft_s for needle-*)
  range      [min, max, label, case]       -> the same ledger row's min / max
  needles    [ctx, label, case]            -> runs/ledger.jsonl ('found')
  codeeval   label                         -> runs/codeeval-<label>.json (passed / n)
  refusal    label                         -> runs/refusal-<label>.json (classifier counts; the hand-read counts are text)
  greedy     [plain, mtp]                  -> runs/greedy/<name>.json (texts compared exactly, per-prompt speed, acceptance)
  image      smoke file                    -> runs/smoke-<name>.json (the answer names red, blue and the white square)
  text       statement                     -> RESULTS.md (word for word; keys starting readme_ -> README.md)
Derived numbers (gains, means of controls, acceptance) are computed here, never typed, and compared with the rounded
figures RESULTS.md states. A missing value stays null: the plates print a dash and their headers say DRAFT.
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


def rng(ref):
    lo, hi, label, case = ref
    row = ledger.get((label, case)) or {}
    if row.get('min') != lo or row.get('max') != hi:
        problems.append(f'range {label} {case}: promo-data says {lo}-{hi}, ledger says {row.get("min")}-{row.get("max")}')
    checked.append(f'{label}/{case}/range')
    return [lo, hi]


def needle(ref):
    ctx, label, case = ref
    row = ledger.get((label, case))
    found = row.get('found') if row else None
    if found is None:
        problems.append(f'needle {label} {case}: not in ledger')
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


def refusal(label):
    c = json.load(open(os.path.join(RUNS, f'refusal-{label}.json')))
    checked.append(f'refusal/{label}')
    return {'answered': c['counts']['answered'], 'refused': c['counts']['refused'], 'n': c['n']}


def greedy(pair):
    a, b = (json.load(open(os.path.join(RUNS, 'greedy', f'{x}.json')))['rows'] for x in pair)
    checked.append(f'greedy/{pair[0]}+{pair[1]}')
    return a, b, sum(x['text'] == y['text'] for x, y in zip(a, b))


def image(name):
    c = json.load(open(os.path.join(RUNS, f'{name}.json')))['image']['content'].lower()
    ok = all(w in c for w in ('red', 'blue', 'white square'))
    if not ok:
        problems.append(f'image {name}: answer does not name red, blue and the white square')
    checked.append(f'image/{name}')
    return ok


mean = lambda xs: sum(xs) / len(xs) if xs and all(x is not None for x in xs) else None
P = raw

stock = {k: m(P['stock'][k]) for k in ('decode', 'prefill_8k')}
stock.update({'window': P['stock']['window'], 'vram_mib': P['stock']['vram_mib']})
T = P['tuned']
tuned = {k: m(T[k]) for k in ('decode_off', 'decode_on', 'accept_off', 'accept_on', 'prefill_8k', 'decode_120k')}
tuned.update({'range_off': rng(T['range_off']), 'range_on': rng(T['range_on']),
              'needles_65k': needle(T['needles_65k']), 'needles_124k': needle(T['needles_124k']), 'vram_mib': T['vram_mib']})
ctl = {'off': [m(r) for r in P['controls']['off']], 'on': [m(r) for r in P['controls']['on']]}
ctl['off_mean'], ctl['on_mean'] = mean(ctl['off']), mean(ctl['on'])

G = P['greedy']
ga, gb, same_off = greedy(G['off'])
_, _, same_on = greedy(G['on'])
if same_off != G['identical_off'] or same_on != G['identical_on'] or len(ga) != G['n']:
    problems.append(f'greedy identical: promo-data {G["identical_off"]}/{G["identical_on"]} of {G["n"]}, files {same_off}/{same_on} of {len(ga)}')
pr_m, pr_p = gb[G['prose_i']], ga[G['prose_i']]
prose_acc = pr_m['accepted'] / pr_m['draft_n'] * 100
if round(pr_m['decode_tps'], 1) != G['prose_mtp'] or round(pr_p['decode_tps'], 1) != G['prose_plain'] or round(prose_acc) != G['prose_accept_pct']:
    problems.append(f'greedy prose prompt: files {pr_m["decode_tps"]} / {pr_p["decode_tps"]} at {prose_acc:.1f}%')
greedy_rows = [{'i': x['i'], 'plain': x['decode_tps'], 'mtp': y['decode_tps'], 'accept': y['accepted'] / y['draft_n'] if y['draft_n'] else None,
                'same': x['text'] == y['text']} for x, y in zip(ga, gb)]
greedy_out = {'identical_off': same_off, 'identical_on': same_on, 'n': len(ga), 'rows': greedy_rows,
              'prose_i': G['prose_i'], 'prose_mtp': pr_m['decode_tps'], 'prose_plain': pr_p['decode_tps'], 'prose_accept_pct': prose_acc,
              'plain_mean': mean([x['decode_tps'] for x in ga])}

L = P['long']
long_ = {k: m(L[k]) for k in ('decode', 'decode_242k', 'prefill_241k', 'ttft_248k', 'prompt_248k')}
long_.update({'needles_130k': needle(L['needles_130k']), 'needles_248k': needle(L['needles_248k']), 'vram_mib': L['vram_mib']})

U = P['uncensored']
unc = {'stock': [m(r) for r in U['stock']], 'tuned': m(U['tuned']), 'needles_124k': needle(U['needles_124k']), 'codeeval': codeeval(U['codeeval']),
       'codeeval_default': codeeval(U['codeeval_default']), 'refusal_classifier': refusal(U['refusal']),
       'refusal_classifier_default': refusal(U['refusal_default']), 'answered_by_hand': U['answered_by_hand'],
       'softened': U['softened'], 'answered_default_by_hand': U['answered_default_by_hand'], 'probe_n': U['probe_n'],
       'image': [image(x) for x in U['image']]}
unc['stock_mean'] = mean(unc['stock'])
if unc['refusal_classifier']['answered'] != U['answered_by_hand']:
    problems.append('uncensored: classifier and hand-read counts differ; check RESULTS.md')

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
    'gain_off_pct': g(tuned['decode_off'], ctl['off_mean']),
    'gain_on_pct': g(tuned['decode_on'], ctl['on_mean']),
    'gain_off_vs_stock_pct': g(tuned['decode_off'], stock['decode']),
    'prefill_cost_pct': -g(tuned['prefill_8k'], stock['prefill_8k']),
    'accept_off_pct': tuned['accept_off'] * 100, 'accept_on_pct': tuned['accept_on'] * 100,
    'unc_speed_pct': g(unc['tuned'], unc['stock_mean']),
}
rm = P['results_md']
for k in ('gain_off_pct', 'gain_on_pct', 'prefill_cost_pct'):
    if round(derived[k]) != rm[k]:
        problems.append(f'derived {k}: {derived[k]:.3f} vs RESULTS.md {rm[k]}')
if round(derived['gain_off_vs_stock_pct']) != rm['gain_off_pct']:
    problems.append(f'derived gain vs stock {derived["gain_off_vs_stock_pct"]:.2f} differs from the controls gain')
# README says 70–74%; acceptance rounds half down to the integer (0.705 -> 70, 0.744 -> 74)
if int(derived['accept_off_pct']) != rm['accept_off_pct'] or int(derived['accept_on_pct']) != rm['accept_on_pct']:
    problems.append('derived acceptance differs from README 70–74%')

out = {
    'status': 'draft' if problems else 'measured',
    'problems': problems,
    'model': P['model'], 'engine': P['engine'], 'weights': P['weights'], 'ctx': P['ctx'], 'long_ctx': P['long_ctx'],
    'stock': stock, 'tuned': tuned, 'controls': ctl, 'greedy': greedy_out, 'long': long_, 'uncensored': unc, 'derived': derived,
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
    'stock_dec': r(stock['decode']), 'ctl_off': r(ctl['off_mean']), 'ctl_on': r(ctl['on_mean']),
    'dec_off': r(tuned['decode_off']), 'dec_on': r(tuned['decode_on']),
    'gain_off': r(D_['gain_off_pct'], '1'), 'gain_on': r(D_['gain_on_pct'], '1'),
    'on_min': r(tuned['range_on'][0]), 'prose_mtp': r(greedy_out['prose_mtp']), 'prose_plain': r(greedy_out['prose_plain']),
    'prose_acc': r(greedy_out['prose_accept_pct'], '1'), 'same_off': str(same_off), 'same_on': str(same_on), 'gn': str(len(ga)),
    'stock_pp': r(stock['prefill_8k'], '1'), 'pp': r(tuned['prefill_8k'], '1'), 'pp_cost': r(D_['prefill_cost_pct'], '1'),
    'needle_130': long_['needles_130k'][1] or '—', 'needle_248': long_['needles_248k'][1] or '—',
    'ttft_248': r(long_['ttft_248k'], '1'), 'long_242k': r(long_['decode_242k']),
    'unc_ans': str(unc['answered_by_hand']), 'unc_soft': str(unc['softened']), 'def_ans': str(unc['answered_default_by_hand']),
    'unc_code': '/'.join(map(str, unc['codeeval'] or [])), 'def_code': '/'.join(map(str, unc['codeeval_default'] or [])),
    'unc_dec': r(unc['tuned']), 'unc_stock': r(unc['stock_mean']), 'dec_120k': r(tuned['decode_120k']),
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
