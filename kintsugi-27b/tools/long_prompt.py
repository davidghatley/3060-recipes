import json,os,sys,time,urllib.request,uuid
n=int(sys.argv[1]); lib=os.path.dirname(os.__file__); t=""
for f in ["argparse.py","typing.py","inspect.py","difflib.py","textwrap.py","subprocess.py","dataclasses.py","enum.py","functools.py","tarfile.py","pydoc.py","ast.py"]:
    t+=open(os.path.join(lib,f),encoding="utf-8").read()
t=t[:n]
p=f"[{uuid.uuid4()}]\n{t}\n\nList five functions defined above and what each does."
b=json.dumps({"model":"kintsugi","messages":[{"role":"user","content":p}],"max_tokens":400,"chat_template_kwargs":{"enable_thinking":False}}).encode()
t0=time.time(); r=json.load(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8080/v1/chat/completions",b,{"Content-Type":"application/json"}),timeout=1800))
tm=r["timings"]; print(f"chars={n} prompt={tm['prompt_n']} prefill={tm['prompt_per_second']:.0f} tok/s decode={tm['predicted_per_second']:.1f} tok/s (n={tm['predicted_n']}, draft {tm.get('draft_n_accepted')}/{tm.get('draft_n')}) wall={time.time()-t0:.0f}s")
