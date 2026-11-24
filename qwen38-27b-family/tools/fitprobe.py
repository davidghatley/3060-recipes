"""One request that exercises the full compute buffer (a ~3k-token prompt, then 32 tokens), for fit probes.
Prints OK/FAIL with VRAM. python3 -I tools/fitprobe.py LABEL"""
import json, os, subprocess, sys, urllib.request
url = "http://127.0.0.1:" + os.environ.get("PORT", "8101")
src = open(os.path.join(os.path.dirname(os.__file__), "argparse.py"), encoding="utf-8").read()[:10000]
body = {"messages": [{"role": "user", "content": src + "\n\nSummarise this file in one sentence."}], "max_tokens": 32,
        "temperature": 0}
vr = lambda: subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout.strip()
try:
    d = json.load(urllib.request.urlopen(urllib.request.Request(url + "/v1/chat/completions", json.dumps(body).encode(),
                                                                {"Content-Type": "application/json"}), timeout=600))
    t = d["timings"]
    print(f"FITPROBE {sys.argv[1]} OK vram={vr()} prompt={t['prompt_n']} pp={t['prompt_per_second']:.0f} tg={t['predicted_per_second']:.2f} "
          f"ans={d['choices'][0]['message'].get('content','')[:60]!r}")
except Exception as e:
    print(f"FITPROBE {sys.argv[1]} FAIL {e!r} vram={vr()}")
