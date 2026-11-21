"""Inkling 2 Mini as a typed decision engine: one-token logit readout through llama-server.

A decision-index Engine (decision_index.engines.Engine). For each question:

1. Render the kit's reference layout (transformers_engine.render_prompt), with two changes:
   - every option gets a single-token code: A-Z then a-z for up to 52 options, 1..255 above that
     (one fixed rule by option count, never by benchmark);
   - the state is its own user message and the question is a second user message, so all the questions
     of a request share the state prefix in llama-server's cache.
   Chat template with reasoning_effort "none" ("Thinking effort level: 0"), then the answer prefix
   "<|message_model|><|content_text|>", so the next token is the answer code. No chain of thought.
2. Ask for 1 token with a +100 logit bias on the option codes and post-sampling probabilities over exactly
   those codes (samplers: temperature only, T=1, top_k off). A constant bias cancels when renormalising over
   the codes, so this is the softmax of the raw logits restricted to the codes. Plain top-N logprobs do not
   work: most codes sit below unrelated tokens (eval/tools/check_readout.py).
3. Renormalise over the codes; the probabilities go back keyed by the original option keys.

Prefix reuse: Inkling has SWA layers and a short-conv state, so llama-server can only reuse a prefix from a
context checkpoint. Before the questions of a request we send one "prime" prompt (state + the common
question header); its checkpoint at (end - 4) tokens lands on the state boundary and every question then
processes only its own tokens. --option cache=false sends cache_prompt=false (the cold-cost control).

raw_output keeps the code logprobs per question, so a temperature can be fitted afterwards without re-running.
"""
import json
import math
import string
import time
import urllib.error
import urllib.request

from decision_index.engines.base import Engine, Unsupported, text

SYSTEM_PROMPT = "You are a decision engine. Read the state, then answer the question by replying with exactly one option key from the list. Do not explain."
LETTERS = list(string.ascii_uppercase + string.ascii_lowercase)
ANSWER_PREFIX = "<|message_model|><|content_text|>"
QUESTION_HEAD = "Question:"


def codes_for(n):
    if n <= len(LETTERS):
        return LETTERS[:n], "letter"
    if n <= 255:
        return [str(i) for i in range(1, n + 1)], "number"
    raise Unsupported(f"{n} options exceed the 255 single-token codes")


def option_line(code, key, description):
    d = None if description is None else text(description)
    return f"{code}: {key}" if d in (None, "", key) else f"{code}: {key}: {d}"


def question_body(question):
    if question["type"] == "choice":
        keys = list(question["criteria"])
        descs = [question["criteria"][k] for k in keys]
    else:  # noul: the kit's reference renders false/true
        keys, descs = ["false", "true"], ["False", "True"]
    codes, kind = codes_for(len(keys))
    lines = [QUESTION_HEAD, text(question.get("instructions", "")), "", "Options:"]
    lines += [option_line(c, k, d) for c, k, d in zip(codes, keys, descs)]
    lines += ["", f"Reply with exactly one option {kind}."]
    return "\n".join(lines), keys, codes


def state_body(state):
    return "State:\n" + (text(state) if state not in ("", None, {}, []) else "(empty)")


class InklingEngine(Engine):
    name = "inkling-2-mini-logit"
    latency = "HTTP wall time to llama-server per request: prime (if cached) + one 1-token completion per question; includes template rendering."

    def __init__(self, base_url="http://127.0.0.1:8085", cache=True, n_ctx=65536, effort="none", label="", timeout=1800, **options):
        super().__init__(**options)
        self.base = base_url.rstrip("/")
        self.cache = cache in (True, "true", "1", 1)
        self.n_ctx = int(n_ctx)
        self.effort = effort
        self.timeout = float(timeout)
        self.code_ids = {}
        props = self._get("/props")
        self.provenance = {"server": self.base, "model_path": props.get("model_path"), "build": props.get("build_info"),
                           "ftype": props.get("model_ftype"), "n_ctx": props.get("default_generation_settings", {}).get("n_ctx"),
                           "label": label, "cache": self.cache, "effort": effort, "readout": "logit_bias+100, post_sampling_probs over option codes"}
        for c in LETTERS + [str(i) for i in range(1, 256)]:
            ids = self._post("/tokenize", {"content": c})["tokens"]
            if len(ids) != 1:
                raise RuntimeError(f"option code {c!r} is {len(ids)} tokens")
            self.code_ids[c] = ids[0]
        if len(set(self.code_ids.values())) != len(self.code_ids):
            raise RuntimeError("option codes share token ids")

    # ---- http
    def _post(self, path, body):
        req = urllib.request.Request(self.base + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code in (400, 413) and ("context" in msg or "exceed" in msg):
                raise Unsupported(msg[:300])
            raise RuntimeError(f"HTTP {e.code}: {msg[:300]}")

    def _get(self, path):
        with urllib.request.urlopen(self.base + path, timeout=60) as r:
            return json.load(r)

    def _template(self, messages):
        return self._post("/apply-template", {"messages": messages, "chat_template_kwargs": {"reasoning_effort": self.effort}})["prompt"]

    def _messages(self, state, qbody):
        return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": state_body(state)}, {"role": "user", "content": qbody}]

    # ---- engine
    def __call__(self, state, questions):
        answers, raw = {}, {}
        t0 = time.perf_counter()
        rendered = {}
        for k, q in questions.items():
            if q["type"] not in ("choice", "noul"):
                raise Unsupported("unsupported question type " + str(q["type"]))
            body, keys, codes = question_body(q)
            rendered[k] = (self._template(self._messages(state, body)) + ANSWER_PREFIX, keys, codes)
        prime = None
        if self.cache:
            p = self._template(self._messages(state, QUESTION_HEAD))
            p = p[: p.rfind(QUESTION_HEAD) + len(QUESTION_HEAD)]
            n = len(self._post("/tokenize", {"content": p})["tokens"])
            if n + 8 > self.n_ctx:
                raise Unsupported(f"state prompt of {n} tokens exceeds the {self.n_ctx}-token context")
            r = self._post("/completion", {"prompt": p, "n_predict": 1, "cache_prompt": True, "samplers": ["temperature"], "temperature": 1.0})
            prime = {"prompt_n": r["timings"]["prompt_n"], "cache_n": r["timings"].get("cache_n"), "prompt_ms": r["timings"]["prompt_ms"], "tokens": n}
        n_in = 0
        for k, (prompt, keys, codes) in rendered.items():
            body = {"prompt": prompt, "n_predict": 1, "cache_prompt": self.cache, "samplers": ["temperature"], "temperature": 1.0,
                    "top_k": 0, "top_p": 1.0, "min_p": 0.0, "n_probs": len(codes), "post_sampling_probs": True,
                    "logit_bias": [[self.code_ids[c], 100.0] for c in codes]}
            r = self._post("/completion", body)
            if r.get("truncated"):
                raise Unsupported("prompt truncated by the server")
            top = r["completion_probabilities"][0]["top_probs"]
            by_id = {t["id"]: t["prob"] for t in top}
            ps = [by_id.get(self.code_ids[c]) for c in codes]
            if any(p is None for p in ps):
                raise RuntimeError(f"readout missing {sum(p is None for p in ps)} of {len(codes)} codes")
            z = sum(ps)
            if not (z > 0 and math.isfinite(z)):
                raise RuntimeError("non-finite readout")
            probs = {key: p / z for key, p in zip(keys, ps)}
            # floor zero probabilities for the logprob record (temperature refit); the answer keeps the exact values
            logp = {key: math.log(max(p, 1e-30)) for key, p in probs.items()}
            t = r["timings"]
            n_in += t["prompt_n"] + (t.get("cache_n") or 0)
            raw[k] = {"code_logprobs": logp, "n_options": len(codes), "prompt_n": t["prompt_n"], "cache_n": t.get("cache_n"), "prompt_ms": t["prompt_ms"]}
            choice = max(keys, key=lambda x: probs[x])
            if q_type(questions[k]) == "choice":
                answers[k] = {"type": "choice", "choice": choice, "probabilities": probs}
            else:
                answers[k] = {"type": "noul", "noul": probs["true"]}
        raw["_request"] = {"prime": prime, "wall_ms": (time.perf_counter() - t0) * 1000, "n_questions": len(questions)}
        return {"model": "inkling-2-mini", "answers": answers, "usage": {"input_tokens": n_in}}, raw


def q_type(q):
    return q["type"]
