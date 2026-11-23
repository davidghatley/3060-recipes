"""Smoke test for a running SenseNova-Loop-9B llama-server (adapted from ../../inkling-2-mini/tools/smoke.py): chat, a capped coding answer, and (with --image) one image prompt.
    python3 -I tools/smoke.py [--url http://127.0.0.1:8103] [--image] > runs/smoke-<label>.json
The image is generated here (stdlib PNG): left half red, right half blue, a white square in the middle."""
import argparse, base64, json, struct, time, urllib.request, zlib

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://127.0.0.1:8103")
ap.add_argument("--image", action="store_true")
a = ap.parse_args()


def post(path, body):
    req = urllib.request.Request(a.url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        return json.loads(r.read())


def chat(content, max_tokens, effort="low", **kw):
    t0 = time.time()
    d = post("/v1/chat/completions", {"messages": [{"role": "user", "content": content}], "max_tokens": max_tokens,
                                      "chat_template_kwargs": {"enable_thinking": effort != "off"}, **kw})
    m = d["choices"][0]["message"]
    return {"content": m.get("content"), "reasoning_chars": len(m.get("reasoning_content") or ""),
            "reasoning_head": (m.get("reasoning_content") or "")[:300], "finish": d["choices"][0].get("finish_reason"),
            "timings": {k: round(v, 2) for k, v in d.get("timings", {}).items() if isinstance(v, (int, float))},
            "wall_s": round(time.time() - t0, 2)}


def png(w=256, h=256):
    rows = b""
    for y in range(h):
        row = b"\x00"
        for x in range(w):
            if 96 <= x < 160 and 96 <= y < 160:
                row += b"\xff\xff\xff"
            else:
                row += b"\xe0\x10\x10" if x < w // 2 else b"\x10\x30\xe0"
        rows += row
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


res = {"chat": chat("Reply with exactly: ok", 256, effort="off"),
       "math": chat("What is 17 * 23? Answer with just the number.", 1024, effort="off"),
       "code": chat("Write a Python function is_palindrome(s) that ignores case and non-alphanumerics. "
                    "Output only one code block.", 1024, effort="off")}
if a.image:
    uri = "data:image/png;base64," + base64.b64encode(png()).decode()
    t0 = time.time()
    d = post("/v1/chat/completions", {"messages": [{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": uri}},
        {"type": "text", "text": "Describe the colors and shapes in this image in one sentence."}]}],
        "max_tokens": int(__import__("os").environ.get("IMG_MAX", "1024")), "chat_template_kwargs": {"enable_thinking": False}})
    m = d["choices"][0]["message"]
    res["image"] = {"content": m.get("content"), "finish": d["choices"][0].get("finish_reason"),
                    "timings": {k: round(v, 2) for k, v in d.get("timings", {}).items() if isinstance(v, (int, float))},
                    "wall_s": round(time.time() - t0, 2)}
print(json.dumps(res, indent=1))
