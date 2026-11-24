# inkling-2-mini-uncensored

Two uncensored edits of [thinkingmachines/Inkling-2-Mini](https://huggingface.co/thinkingmachines/Inkling-2-Mini)
(26.4B MoE, 128 experts top-8, loop core 6–17 run three times per token, image input) on the RTX 3060 12 GB:

- **nokeepai Unbound v2** ([nokeepai/Inkling-2-Mini-Unbound-GGUF](https://huggingface.co/nokeepai/Inkling-2-Mini-Unbound-GGUF)):
  a rank-64 LoRA on the q, k, v, output and gate attention projections of all 24 layers.
- **AtomicChat Uncensored** ([AtomicChat/Inkling-2-Mini-Uncensored-GGUF](https://huggingface.co/AtomicChat/Inkling-2-Mini-Uncensored-GGUF)):
  a rank-1 LoRA on `attn_output`, the routed experts' down projection and the token embedding, also sold baked into
  their own AD-Q4_K GGUF.

This recipe does not re-derive the engine or the layout. It runs on the base recipe's build and expert placement
([`../inkling-2-mini/`](../inkling-2-mini/): llama.cpp master 225a5345b + two F16-mask patches, loop-core experts on
the GPU, the rest in RAM, 64k context), and `serve.sh` is a thin wrapper that execs `../inkling-2-mini/serve.sh`, so the
two cannot drift. What it measures is what each edit changes and what it costs on that layout.

Numbers and quality are in [RESULTS.md](RESULTS.md), the experiment log is [PLAN.md](PLAN.md), the ceilings are in
[THEORY.md](THEORY.md) (only what differs from the base's), and the raw data is in `runs/`.

## Result

- **Default: AtomicChat's baked `Inkling-2-Mini-Uncensored-AD-Q4_K.gguf` on the base layout at ubatch 96, 64k context.
  29.6 tok/s decode (base IQ4_NL: 29.0), 137 tok/s prefill at 8k (base: 145), 24.1 tok/s at 32k, needles 3/3 at 32k
  and 62k, codeeval 8/8, image input working. It answered all 20 refusal-probe prompts, where the unedited model
  hedged on 12, and it moves the output least: KLD 0.014 / 0.011 against Q8_0 (unedited IQ4_NL: 0.0085 / 0.0088).**
- nokeepai's rank-64 LoRA loads with `--lora` on the base build and layout, but costs 7% decode (27.0 tok/s). Merged
  into the IQ4_NL file with `tools/merge_lora.py` it runs at base speed (29.0 / 146, needles 3/3, 3/3) and answers
  20/20, but its edit is three times heavier than AtomicChat's (KLD 0.042 / 0.031, wiki perplexity +6%).
- AtomicChat's rank-1 LoRA on ggml-org's IQ4_NL works with experts in RAM (no NaN, KLD as low as the baked file),
  but its expert half runs as extra nodes in all 48 layer applications: 21.4 tok/s. Use the baked file instead.
- Neither model card's launch line (`-ngl 99 -c 32768`) loads on a 12 GB card: both try to allocate 15–16 GB on the
  GPU. The usual MoE offload line on stock master (every expert in RAM, `--no-op-offload`) runs AD-Q4_K at 17.2 tok/s
  decode and 52 tok/s prefill; this recipe's layout is 1.72× and 2.64× that.

## Which config

| `VARIANT=` | Weights | Decode / prefill 8k | KLD wiki / code | Refusal probe answered | Use |
|---|---|---:|---:|---:|---|
| **`atomicchat`** (default) | AD-Q4_K, 16.5 GB, ub 96 | **29.6 / 137** | **0.014 / 0.011** | 20/20 | the default |
| `nokeepai-merged` | IQ4_NL with nokeepai merged in (build it with `tools/merge_lora.py`) | 29.0 / 146 | 0.042 / 0.031 | 20/20 | nokeepai's edit at full speed, 6% faster prefill |
| `nokeepai` | base IQ4_NL + nokeepai LoRA at runtime | 27.0 / 144 | 0.043 / 0.031 | 19/20 (+1 hedged) | no merge step, no extra 17.6 GB file |
| `atomicchat-lora` | base IQ4_NL + AtomicChat LoRA at runtime | 21.4 / 136 | 0.013 / 0.012 | 20/20 | only if you can't spare 16.5 GB of disk |
| `base` | base IQ4_NL | 29.0 / 145 | 0.0085 / 0.0088 | 8/20 (+12 hedged) | the control |

Why AtomicChat's file is the default: it is the fastest at empty context and at 32k, it changes the model least
(the KLD and perplexity are close to the unedited IQ4_NL's), and it is a published file, where nokeepai at full speed
needs a local 17.6 GB merge. The cost is 6% prefill (ub 96 instead of 128: its core experts are 0.47 GiB bigger than
IQ4_NL's) and 16.5 GB more disk. Both edits answered every probe prompt.

## Use it

```
# 1. base recipe first: ../inkling-2-mini/README.md (engine r2inkfix-19c41d2ff, base IQ4_NL + mmproj Q8_0)
# 2. weights (pinned in ../notes/trending-batch-1-weights.tsv; ../scripts/hf_get.sh fetches, resumes and checks sha256)
#    AtomicChat/Inkling-2-Mini-Uncensored-GGUF @ 40886ab6 -> /mnt/models/llm/inkling-2-mini-uncensored/atomicchat/
#      Inkling-2-Mini-Uncensored-AD-Q4_K.gguf, mmproj-Inkling-2-Mini-Uncensored-F16.gguf, Inkling-2-Mini-Uncensored-LoRA.gguf
#    nokeepai/Inkling-2-Mini-Unbound-GGUF @ c61cf03f -> /mnt/models/llm/inkling-2-mini-uncensored/nokeepai/
#      Inkling-2-Mini-Unbound-v2-LoRA-r64.gguf
# 3. serve (through gpu_run, OpenAI-compatible on 127.0.0.1:8102, model name inkling-2-mini)
./serve.sh                                   # AtomicChat AD-Q4_K, 64k, ub 96
UNC_MMPROJ=1 ./serve.sh                      # with image input: base mmproj Q8_0, ub 64 (prefill 112 instead of 137)
UNC_MMPROJ=1 INK_CONTEXT=32768 \
  INK_MMPROJ=/mnt/models/llm/inkling-2-mini-uncensored/atomicchat/mmproj-Inkling-2-Mini-Uncensored-F16.gguf ./serve.sh   # AtomicChat's F16 projector, tested at 32k (ub 64)
VARIANT=nokeepai ./serve.sh                  # nokeepai LoRA at runtime
# nokeepai merged (one-off, ~2 min, writes a 17.6 GB GGUF next to the LoRA):
python3 -I tools/merge_lora.py /mnt/models/llm/inkling-2-mini/Inkling-2-Mini-IQ4_NL.gguf \
  /mnt/models/llm/inkling-2-mini-uncensored/nokeepai/Inkling-2-Mini-Unbound-v2-LoRA-r64.gguf \
  /mnt/models/llm/inkling-2-mini-uncensored/nokeepai/Inkling-2-Mini-Unbound-v2-r64-merged-IQ4_NL.gguf
VARIANT=nokeepai-merged ./serve.sh
```

`serve.sh` only picks the weights and then execs `../inkling-2-mini/serve.sh`, so every knob of the base recipe works
(`INK_CONTEXT`, `INK_UBATCH`, `INK_OT`, `INK_BIN`, `INK_NO_GPU_RUN`, …). `UNC_LORA` / `UNC_LORA_SCALE` override the
adapter and its strength. The model reasons before answering; `--chat-template-kwargs '{"reasoning_effort":"low"}'`
(as an extra argument) is what the quality numbers used.

These models answer requests the original refuses. What they are used for is up to whoever runs them.

## Tools

| Tool | What it does |
|---|---|
| `serve.sh` | the variant switch, then the base recipe's `serve.sh` |
| `tools/run.sh <label> <mode> [args]` | one server start/stop through `../scripts/with_server.sh` on port 8102, waits for an idle host, runs `tools/gate.sh` |
| `tools/gate.sh` | the test for one mode: `speed`, `deep` (decode at 32k + needles), `needles`, `code`, `quality`, `refusal`, `smoke`; logs host load, `/lora-adapters`, RSS and VRAM to `runs/ledger.jsonl` |
| `tools/batch.sh`, `tools/queue.sh` | one GPU-lock hold per batch file (`GPU_RUN_MEM=44G`), batches run one after another |
| `tools/kld.sh <label> <model> [lora]` | KLD against the base recipe's cached Q8_0 logits (wiki + code) |
| `tools/lora_info.py` | lists an adapter's tensors, rank, alpha and bytes and checks each against the base GGUF |
| `tools/merge_lora.py` | merges a LoRA into a quantized GGUF and re-quantizes each edited tensor to its own type |
| `tools/refusal_reread.py` | re-scores `scripts/refusal_probe.py` output (curly apostrophes; answered / hedged / refused) |
| `tools/stock.sh` | the model cards' own `llama-server` lines on stock master, for the baseline |

Speed numbers come from the base recipe's `tools/srvtest.py`, unchanged.

## Credits

- [Thinking Machines](https://huggingface.co/thinkingmachines/Inkling-2-Mini), for Inkling 2 Mini.
- [nokeepai](https://nokeep.ai), for Inkling-2-Mini Unbound
  ([LoRA GGUF](https://huggingface.co/nokeepai/Inkling-2-Mini-Unbound-GGUF), [weights](https://huggingface.co/nokeepai/Inkling-2-Mini-Unbound)).
- [AtomicChat](https://atomic.chat) ([GitHub](https://github.com/AtomicBot-ai/Atomic-Chat)), for
  [Inkling-2-Mini-Uncensored-GGUF](https://huggingface.co/AtomicChat/Inkling-2-Mini-Uncensored-GGUF) (the LoRA, the
  baked AD-Q4_K and the mmproj; built against their [Inkling-2-Mini-GGUF](https://huggingface.co/AtomicChat/Inkling-2-Mini-GGUF)).
  The harmful-prompt and over-refusal sets their card measures with (mlabonne/harmful_behaviors, walledai/XSTest) are
  theirs, not used here.
- llama.cpp and ggml-org, for the engine, the Inkling 2 support ([#32694](https://github.com/ggml-org/llama.cpp/pull/32694)),
  `--lora` and gguf-py (which `tools/merge_lora.py` uses to de- and re-quantize), and
  [ggml-org/Inkling-2-Mini-GGUF](https://huggingface.co/ggml-org/Inkling-2-Mini-GGUF).
- The authors of llama.cpp PRs #32704, #32740, #32752 and #32777 and of the analysis in issue #32710, which the base
  recipe builds on.
- The base recipe [`../inkling-2-mini/`](../inkling-2-mini/): engine, patches, layout, `serve.sh`, `srvtest.py`, smoke test, Q8_0 logits.
- The tuning method comes from 0xSero's [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill):
  ceilings first, one change at a time between controls, output gated as well as speed.
