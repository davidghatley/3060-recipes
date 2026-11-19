#!/usr/bin/env python3
"""Write src/v3/palette.json from secret-sauce tokens.json (light = Plaster, dark = Night).
Run: python3 -I tools/sauce_palette.py [path/to/tokens.json]"""
import json, pathlib, sys
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path.home() / 'Projects/secret-sauce/tokens.json')
t = json.loads(src.read_text())
tok = {x['name']: x['value'] for x in t['color']['tokens']}
# promo key -> sauce token
MAP = {'paper': 'paper', 'sheet': 'sheet', 'ink': 'ink', 'muted': 'ink-muted', 'rule': 'rule', 'faint': 'rule-faint',
       'cobalt': 'cobalt', 'cobaltText': 'cobalt-text', 'onCobalt': 'on-cobalt', 'tint': 'cobalt-tint', 'vermilion': 'vermilion'}
out = {'source': f"secret-sauce tokens.json v{t.get('version')}",
       **{th: {k: tok[v][th] for k, v in MAP.items()} for th in ('light', 'dark')}}
dst = pathlib.Path(__file__).resolve().parent.parent / 'src/v3/palette.json'
dst.write_text(json.dumps(out, indent=2) + '\n')
print(dst)
