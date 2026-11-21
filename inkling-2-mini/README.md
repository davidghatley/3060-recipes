# inkling-2-mini

Serving [thinkingmachines/Inkling-2-Mini](https://huggingface.co/thinkingmachines/Inkling-2-Mini) on the RTX 3060 12 GB with llama.cpp.
It is a 26.4B MoE (128 experts, 8 active) with image input. Its layers 6–17 form a loop core that runs three times per token.

The 17.6 GB GGUF does not fit in 12 GB, so experts have to live in RAM. This recipe is about which ones:
- every core-layer expert is read three times per token;
- so the 6.4 GiB of core experts go on the GPU, and the rest stay in RAM.

Numbers and quality are in [RESULTS.md](RESULTS.md). The experiment log is [PLAN.md](PLAN.md), the ceilings are in [THEORY.md](THEORY.md), and the raw data is in `runs/`.

## Result

| Single user, 64k context | Stock master, experts in RAM | **This recipe** |
|---|---:|---:|
| Decode, coding answer | 17.5 tok/s | **29.0 tok/s (1.66×)** |
| Decode at 32k context | | 23.7 tok/s |
| Prefill, 8k prompt | 39 tok/s | **145 tok/s (3.7×)** |
| Prefill, 32k prompt | | 123 tok/s |
| Needles at 32k / 62k | | 3/3, 3/3 |
| 128k profile: decode empty / at 124k, needles at 124k | | 26.1 / 14.6 tok/s, 3/3 |
| KL divergence vs Q8_0 (wikitext) | 0.0085 | 0.0085 (IQ4_NL), 0.0029 with `INK_QUANT=nvfp4` |

Two things in stock master matter for this model:

- **Prompts come out NaN** when a loop-core layer's experts are in RAM and op offload is on. That includes the obvious `-ot exps=CPU`, and image prompts, which answer "????". This recipe keeps the core on the GPU, so it is not affected. See RESULTS.md, "The op-offload NaN".
- **NVFP4 GGUFs lose their per-expert scales in loop passes 2–3.** The `inkfix` build below fixes this, and also shrinks the attention-mask buffer so 64k fits.

## Use it

```bash
# 1. weights (pinned): ggml-org/Inkling-2-Mini-GGUF @ db61c5b4 -> /mnt/models/llm/inkling-2-mini/
#    Inkling-2-Mini-IQ4_NL.gguf, mmproj-Inkling-2-Mini-Q8_0.gguf (optional), Inkling-2-Mini-Q8_0.gguf (KLD reference)
# 2. engine: llama.cpp master 29b52d398 + branch inkling-loop-scale-fix (3 commits), CUDA build for sm_86
/mnt/scratch/llama.cpp/build-master.sh /mnt/scratch/llama.cpp/src-inkfix /mnt/scratch/llama.cpp/inkfix-4c836a8eb
# 3. serve (through gpu_run, OpenAI-compatible on 127.0.0.1:8085)
./serve.sh
```

The defaults in `serve.sh` are:

- IQ4_NL, with the experts of layers 0–5 and 18–23 in RAM (`-ot 'blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'`) and everything else on the GPU;
- q8_0 KV, `-ub 128 -b 2048`, 64k context, one slot, `-fa on`, 6 threads;
- `GPU_RUN_MEM=44G`, because the RAM experts are mmap'd and gpu_run's memory cap counts page cache.

Overrides:

- `INK_QUANT=nvfp4`: our repack with the checkpoint's own NVFP4 experts. KLD is ~3× lower, and it runs ~7% slower.
- `INK_MMPROJ=/mnt/models/llm/inkling-2-mini/mmproj-Inkling-2-Mini-Q8_0.gguf`: image input (tested at `INK_CONTEXT=32768`).
- `INK_CONTEXT`, `INK_KV`, `INK_UBATCH`, `INK_PLACEMENT=cpu` (the baseline; add `--no-op-offload`), `INK_OT`, `INK_PORT`.
- `INK_PROFILE=128k`: 128k context. Core layers 16–17 move to RAM, with ub 64 and no op offload. Needles are 3/3 at 64k and at 124k; decode is 26.1 tok/s empty and 14.6 at 124k (RESULTS.md, "128k").

Reasoning depth is a chat-template argument: `"chat_template_kwargs": {"reasoning_effort": "low"}`. The values are none, minimal, low, medium, high (the default), xhigh and max. Cap `max_tokens`: at high effort the model can reason for a long time.

## Building the NVFP4 GGUF

`tools/repack_nvfp4.py TEMPLATE.gguf HF_DIR OUT.gguf [--verify Q8_0.gguf] [--layers 6-17]`. It needs the original safetensors (19.5 GB, without the MTP files) and runs on the CPU in a few minutes.

It copies every tensor from the IQ4_NL GGUF. The NVFP4 experts of layers 0–19 are replaced with the checkpoint's bytes:
- the E2M1 nibbles and E4M3 sub-block scales, bit-for-bit;
- a per-expert F32 `.scale`, equal to amax / outer denominator;
- with the w13 rows de-interleaved into llama.cpp's gate/up order.

`--verify` dequantises the result and compares it with the Q8_0 GGUF; the worst tensor differs by 0.6% relative L2.

## Tools

| Script | What it does |
|---|---|
| `tools/srvtest.py` | server speed and sanity: cold prefill, capped coding decode at a context depth, needles; appends to `runs/ledger.jsonl` |
| `tools/serverrun.sh` | start `serve.sh` with overrides, wait for health, run a test (`INK_TEST`), stop cleanly |
| `tools/bench.sh`, `summarize.py` | one llama-bench run through gpu_run with `nvidia-smi dmon` telemetry |
| `tools/bufprobe.sh` | load the server at several context/ubatch settings and record the KV and compute buffers |
| `tools/kld.sh` | KL divergence vs Q8_0 on wikitext-2 and CPython source |
| `tools/codeeval.py` | 8 Python tasks run against asserts |
| `tools/smoke.py` | chat, arithmetic, code, and one generated image |
| `tools/repack_nvfp4.py` | the NVFP4 repack above |
| `tools/gguf_sizes.py` | per-tensor sizes of a GGUF |

## Credits

- llama.cpp, for the engine and the Inkling 2 Mini support (#32694); ggml-org, for the GGUFs and the imatrix.
- Thinking Machines, for Inkling 2 Mini.
- The tuning method comes from 0xSero's [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill): ceilings first, one change at a time with controls, and output gated as well as speed.
- The flint recipe in this repo, for the experts-in-RAM tooling.
