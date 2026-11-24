"""../promo-data.json -> src/data.json, and copy.md -> out/copy-filled.md.   Run:  python3 -I tools/prep.py

promo-data.json holds the headline numbers from RESULTS.md. Every measured value is written as
[value, ledger label, ledger case]; this script looks each one up in ../runs/ledger.jsonl and refuses to call
the set "measured" if any value is missing or differs. Derived numbers (speed-ups, mean of two controls) are
computed here, never typed. A missing value stays null: the plates print a dash and their headers say DRAFT.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.dirname(HERE)
SRC = os.path.join(REC, 'promo-data.json')
LEDGER = os.path.join(REC, 'runs', 'ledger.jsonl')
DST = os.path.join(HERE, 'src', 'data.json')

raw = json.load(open(SRC))
ledger = {}
for line in open(LEDGER):
    d = json.loads(line)
    ledger[(d['label'], d['case'])] = d

problems, used = [], set()


def m(ref, what='decode_tps'):
    """[value, label, case] -> value, checked against the ledger."""
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
    used.add((label, case))
    return v


pi = raw['pi']
stock = {'decode': m(pi['stock']['decode']), 'prefill_8k': m(pi['stock']['prefill_8k'], 'prefill_tps'),
         'placement': pi['stock']['placement'], 'layers_in_ram': pi['stock']['layers_in_ram']}
profiles = {}
for k in ('fast', 'default', 'long'):
    p = pi[k]
    profiles[k] = {'ctx': p['ctx'], 'decode': m(p['decode']), 'decode_deep': m(p['decode_deep']), 'deep_at': p['deep_at'],
                   'needles': p['needles'], 'ffn_in_ram': p['ffn_in_ram']}
profiles['default'].update(ram_gb=pi['default']['ram_gb'], vram_gb=pi['default']['vram_gb'])

members = []
for mm in raw['members']:
    ctl = [m(c) for c in mm['controls']]
    tuned = m(mm['tuned'])
    base = sum(ctl) / len(ctl) if all(c is not None for c in ctl) else None
    sp = tuned / base if (tuned and base) else None
    if sp is not None and abs(round(sp, 2) - mm['speedup_results_md']) > 0.011:
        problems.append(f"{mm['id']}: speed-up {sp:.3f} vs RESULTS.md {mm['speedup_results_md']}")
    members.append({'id': mm['id'], 'name': mm['name'], 'by': mm['by'], 'file': mm['file'], 'controls': ctl,
                    'stock': base, 'tuned': tuned, 'speedup': sp})

mtp = dict(raw['mtp'])
mtp['decode'] = m(mtp['decode'])
pim = members[0]
out = {
    'status': 'draft' if problems else 'measured',
    'problems': problems,
    'engine': raw['engine'],
    'pi': {'quant': pi['quant'], 'file_gb': pi['file_gb'], 'publisher': pi['publisher'], 'stock': stock,
           'profiles': profiles, 'ceiling': pi['ceiling'],
           'speedup': (profiles['default']['decode'] / stock['decode']) if stock['decode'] else None,
           'speedup_fast': (profiles['fast']['decode'] / stock['decode']) if stock['decode'] else None},
    'members': members,
    'flags': raw['flags'],
    'mtp': mtp,
    'ram_cost_ms_per_gb': raw['ram_cost_ms_per_gb'],
    'kld': raw['kld'], 'kld_note': raw['kld_note'],
}
os.makedirs(os.path.dirname(DST), exist_ok=True)
json.dump(out, open(DST, 'w'), indent=1, ensure_ascii=False)
print(f"prep: {out['status']}; {len(used)} ledger rows checked", file=sys.stderr)
for p in problems:
    print(f'prep: PROBLEM {p}', file=sys.stderr)

# copy.md -> out/copy-filled.md
from decimal import Decimal, ROUND_HALF_UP
# round half up from the decimal string, as the plates do (JS toLocaleString): 14.35 -> 14.4, not float's 14.3
f1 = lambda v: '—' if v is None else str(Decimal(repr(v)).quantize(Decimal('0.1'), ROUND_HALF_UP))
fill = {
    'pi_stock': f1(stock['decode']), 'pi_tuned': f1(profiles['default']['decode']),
    'pi_speedup': '—' if out['pi']['speedup'] is None else f"{f1(out['pi']['speedup'])}x",
    'pi_fast': f1(profiles['fast']['decode']), 'pi_fast_speedup': '—' if out['pi']['speedup_fast'] is None else f"{out['pi']['speedup_fast']:.1f}x",
    'pi_long': f1(profiles['long']['decode']), 'pi_long_deep': f1(profiles['long']['decode_deep']),
    'pi_deep': f1(profiles['default']['decode_deep']),
    'stock_layers': str(stock['layers_in_ram']), 'ram_gb': f"{profiles['default']['ram_gb']:.2f}",
    'ms_per_gb': str(raw['ram_cost_ms_per_gb']), 'ceiling': f"{pi['ceiling']:.1f}",
    'mtp_accept': mtp['accept'], 'mtp_best': mtp['best_case'], 'mtp_prefill': mtp['best_case_prefill'], 'mtp_vram': str(mtp['vram_mib']), 'mtp_ffn': mtp['ffn_pushed'],
}
for mm in members:
    fill[f"{mm['id']}_tuned"] = f1(mm['tuned'])
    fill[f"{mm['id']}_stock"] = f1(mm['stock'])
    fill[f"{mm['id']}_speedup"] = '—' if mm['speedup'] is None else f"{mm['speedup']:.1f}x"
COPY = os.path.join(HERE, 'copy.md')
if os.path.exists(COPY):
    text = open(COPY).read()
    for k, v in fill.items():
        text = text.replace('{{' + k + '}}', v)
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    open(os.path.join(HERE, 'out', 'copy-filled.md'), 'w').write(text)
    left = sorted(set(re.findall(r'\{\{(\w+)\}\}', text)))
    print(f"prep: out/copy-filled.md written; tokens still open: {', '.join(left) or 'none'}", file=sys.stderr)
    unused = sorted(k for k in fill if '{{' + k + '}}' not in open(COPY).read())
    if unused:
        print(f"prep: fill values not used in copy.md: {', '.join(unused)}", file=sys.stderr)
