"""X-weighted character count of each ``` block under a '## N/' heading in out/post.md (twitter-text v3 rules:
code points in 0-4351, 8192-8205, 8208-8223, 8242-8247 count 1, everything else 2; any URL counts 23).
Run: python3 -I tools/xcount.py [out/post.md]"""
import re, sys, unicodedata
RANGES = [(0, 4351), (8192, 8205), (8208, 8223), (8242, 8247)]
URL = re.compile(r'https?://\S+')
def weight(text):
    text = unicodedata.normalize('NFC', text)
    n = 0
    for u in URL.findall(text):
        n += 23
    for ch in URL.sub('', text):
        n += 1 if any(a <= ord(ch) <= b for a, b in RANGES) else 2
    return n
if __name__ == '__main__':
    src = open(sys.argv[1] if len(sys.argv) > 1 else 'out/post.md').read()
    for head, body in re.findall(r'^## (\d+/[^\n]*)\n.*?```\n(.*?)\n```', src, re.S | re.M):
        w = weight(body)
        print(f"{head.split('·')[0].strip():<22} {w:>4} / 280 {'OVER' if w > 280 else 'ok'}")
