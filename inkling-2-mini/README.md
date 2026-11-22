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
| KL divergence vs Q8_0 (wikitext) | 0.0085 | 0.0085 |

Re-measured on llama.cpp master 225a5345b on 2026-11-22: 29.0 tok/s, 144 / 123 tok/s prefill, needles 3/3 and 3/3. Other quants, 128k and the faster options are in the next table.

Two things in stock master matter for this model (checked again on 225a5345b, 2026-11-22):

- **Prompts come out NaN** when a loop-core layer's experts are in RAM and op offload is on, for any batch of 32 tokens or more. That includes the obvious `-ot exps=CPU`, and image prompts, which answer "????". This recipe keeps the core on the GPU, so it is not affected. See RESULTS.md, "The op-offload NaN".
- **64k does not run on a 12 GB card with IQ4_NL**: the server loads and then runs out of memory on the first request. The two patches in `patches/` shrink the attention-mask buffer so it fits.

## Which config

Pick by what you need. All rows are one user, measured on this card with the desktop holding 0.95 GB of it. Decode is a capped coding answer, prefill a cold prompt, KLD is against Q8_0 on wikitext (lower is closer to the full model).

| You want | Run | Decode, empty / after 62k | Prefill, 8k / 62k prompt | Needles | KLD |
|---|---|---:|---:|---|---:|
| **The default: 64k, best balance** | `./serve.sh` | **29.0** / 20.2 tok/s | **144** / 103 tok/s | 3/3 at 32k and 62k | 0.0085 |
| **Max speed** | `INK_QUANT=iq2xxs ./serve.sh` | **41.4** / 26.1 | **295** / 160 | 3/3 at 32k and 62k | 0.091 |
| Speed, less quality lost | `INK_QUANT=iq3xxs ./serve.sh` | 31.0 / 21.6 | 205 / 129 | 3/3 at 32k and 62k | 0.028 |
| 2-bit, a little closer than iq2xxs | `INK_QUANT=q2kxl ./serve.sh` | 39.9 / 25.6 | 255 / 147 | 3/3 at 32k and 62k | 0.072 |
| **Best quality** | `INK_QUANT=nvfp4 ./serve.sh` | 27.4 / 19.3 | 126 / 98 | 3/3 at 32k and 62k | 0.0029 |
| **128k context** | `INK_PROFILE=128k ./serve.sh` | 26.4 / 14.6 after 124k | 85 / 56 (124k prompt) | 3/3 at 124k | 0.0085 |
| A little more decode at 32k | `INK_CONTEXT=32768 INK_MOE_CACHE_MIB=768 ./serve.sh` | 31.9 / 25.8 after 30k | 153 / 132 (30k prompt) | 3/3 at 30k | 0.0085 |
| Fast prefill, on an unmerged upstream PR | `INK_BIN=<master + #32740>/bin INK_UBATCH=512 ./serve.sh` | 29.6 / 24.2 | **361** / **297** | 3/3 at 32k and 62k | 0.0085 |

All eight coding tasks pass on the six rows that were run through them: the first five and the #32740 row.

- **Core layers 6–17 on the GPU (the default) is the layout for speed, up to 64k.** Use the 6–15 layout (`INK_PROFILE=128k`) only when you need more than 64k: it gives up two core layers and op offload.
- The two 2-bit files are the only ones that fit on the card whole. They are the fastest and clearly the furthest from the full model (KLD 0.091 and 0.072 against 0.0085). The needle and coding gates do not show that difference; KLD does.
- The #32740 row needs a build of llama.cpp master with that PR merged in (here: `/mnt/scratch/llama.cpp/pr32740-3afe9c3c8/bin`). It is not the default because the PR is not merged upstream.

### The 128k boundary on a 12 GB card

IQ4_NL, q8_0 KV, `--no-op-offload`, with 0.95 GB of the card held by the desktop. "Runs" means a real request with a prompt of more than 100k tokens completed and all 3 needles were found. Details and the load-time buffers are in RESULTS.md.

| Core layers with experts on the GPU | ubatch | Shipped build | master + #32752 | master + #32740 |
|---|---:|---|---|---|
| 6–15 (`INK_PROFILE=128k`) | 64 | **runs** (124k prompt, 3/3) | loads; not run | loads; not run |
| 6–15 | 128 | does not load | loads, fails on the first request | loads; not run |
| 6–15 | 192 | does not load | does not load | loads; not run |
| 6–15 | 256 | does not load | does not load | **runs** (104k and 124k prompts, 3/3 each) |
| 6–16 | 64 | loads, fails on the first request | loads; not run | loads; not run |
| 6–16 | 128 | does not load | does not load | **runs** (104k prompt, 3/3) |
| 6–17 (the 64k default layout) | 128 | not tried (6–15 already does not load) | not tried | loads, fails on the first request |

- With op offload on, nothing loads at 128k on any build, and that placement gives NaN output anyway.
- A layout that only just loads is not safe: the first request needs more memory than the load.
- **Community-reported, same card** (build and settings unknown): 6–15 at ub 128 runs 128k at 20 tok/s, 6–16 fails at ub 128, ub 192 works and ub 256 fails. We reproduced the speed (20.0 tok/s after 104k tokens, on #32740) and the 6–16 failure on three of four builds. We did not reproduce ub 128 or ub 192 working on the shipped build. The pattern fits master with #32752 on a card with no desktop on it; that is an inference from buffer sizes, not something we could test.

## Use it

```bash
# 1. weights (pinned): ggml-org/Inkling-2-Mini-GGUF @ db61c5b4 -> /mnt/models/llm/inkling-2-mini/
#    Inkling-2-Mini-IQ4_NL.gguf, mmproj-Inkling-2-Mini-Q8_0.gguf (optional), Inkling-2-Mini-Q8_0.gguf (KLD reference)
# 2. engine: llama.cpp master 225a5345b + patches/0001 and 0002, CUDA build for sm_86
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp && git checkout 225a5345b
git am /path/to/3060-recipes/inkling-2-mini/patches/000[12]-*.patch
cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=86 && cmake --build build -j --target llama-server
#    (this box: /mnt/scratch/llama.cpp/build-r2.sh, result in /mnt/scratch/llama.cpp/r2inkfix-19c41d2ff)
# 3. serve (through gpu_run, OpenAI-compatible on 127.0.0.1:8085)
./serve.sh
```

**Which commit and which patches (2026-11-22).** The recipe is measured on llama.cpp master **225a5345b** (build 12627).
- `patches/0001` and `0002` (F16 relative-bias mask) are needed for 64k with IQ4_NL, and for nothing else. At 32k, and for every speed number, stock master is enough.
- The loop-scale patch from round 1 is not needed since **690b87d88** (upstream #32704). NVFP4 GGUFs work on stock master from that commit.
- `patches/0003` is only for the loop-pass experiment in `eval/`.
- Open upstream PRs #32740 and #32752 each make 64k fit without our patches. When one merges, the answer becomes "none". RESULTS.md has both measured.
- The patches for the round-1 pin 29b52d398 are in `patches/old-29b52d398/`.

Without `gpu_run` (any box with one 12 GB card), either `INK_NO_GPU_RUN=1 ./serve.sh` or plain llama-server:

```bash
llama-server -m Inkling-2-Mini-IQ4_NL.gguf --alias inkling-2-mini -ngl 99 --fit off \
  -ot 'blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU' \
  -c 65536 -np 1 -t 6 -b 2048 -ub 128 -fa on -ctk q8_0 -ctv q8_0 \
  --jinja --reasoning-format deepseek --temp 1.0 --host 127.0.0.1 --port 8085
```

`-t 6` is the number of performance cores here. On stock master use `-c 32768`, or apply the two patches for 64k.

The defaults in `serve.sh` are:

- IQ4_NL, with the experts of layers 0–5 and 18–23 in RAM (`-ot 'blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'`) and everything else on the GPU;
- q8_0 KV, `-ub 128 -b 2048`, 64k context, one slot, `-fa on`, 6 threads;
- `GPU_RUN_MEM=44G`, because the RAM experts are mmap'd and gpu_run's memory cap counts page cache.

Overrides:

- `INK_QUANT=nvfp4`: our repack with the checkpoint's own NVFP4 experts. KLD is ~3× lower, and it runs 5.5% slower (27.4 tok/s).
- `INK_QUANT=iq3xxs`, `q2kxl`, `iq2xxs`: Unsloth's dynamic 3-bit and 2-bit files. They are the mainline-layout files from the `Mainline_Support/` folder of unsloth/Inkling-2-Mini-GGUF @ 45fd0876, renamed from `.gguf_file` to `.gguf` under `/mnt/models/llm/inkling-2-mini/unsloth/Mainline_Support/`. The files in that repo's root do not load. Each quant sets its own layout: `iq3xxs` keeps layers 3–19 on the GPU, the 2-bit files put everything on the GPU, and `q2kxl` uses ub 64. Numbers are in the table above.
- `INK_MOE_CACHE_MIB=768` with `INK_CONTEXT=32768`: keeps the hottest RAM experts in VRAM, +10% decode. There is no room for it at 64k.
- `INK_MMPROJ=/mnt/models/llm/inkling-2-mini/mmproj-Inkling-2-Mini-Q8_0.gguf`: image input (tested at `INK_CONTEXT=32768`).
- `INK_CONTEXT`, `INK_KV`, `INK_UBATCH`, `INK_PLACEMENT=cpu` (the baseline; add `--no-op-offload`), `wide` (layers 3–19 on the GPU) or `gpu` (no experts in RAM), `INK_OT`, `INK_PORT`.
- `INK_NO_GPU_RUN=1`: start llama-server directly, without the shared GPU queue.
- `INK_PROFILE=128k`: 128k context. Core layers 16–17 move to RAM, with ub 64 and no op offload. Needles are 3/3 at 124k; decode is 26.4 tok/s empty and 14.6 at 124k (RESULTS.md, "The 128k boundary").

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
| `tools/gguf_layers.py` | expert bytes and quant types per layer of a GGUF |
| `tools/nanprobe.sh` | the op-offload NaN matrix: llama-perplexity over placements, op offload on and off, ubatch 31 / 32 |
| `tools/gpu_batch.sh` | run a script of several tests inside one `gpu_run` session |

## Credits

- llama.cpp, for the engine and the Inkling 2 Mini support (#32694); ggml-org, for the GGUFs and the imatrix.
- Unsloth, for the dynamic 2-bit and 3-bit GGUFs and the DSpark drafter GGUF.
- The authors of llama.cpp PRs #32704, #32740, #32752 and #32777 and of the analysis in issue #32710, which round 2 builds on and measures.
- Thinking Machines, for Inkling 2 Mini.
- The tuning method comes from 0xSero's [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill): ceilings first, one change at a time with controls, and output gated as well as speed.
- The flint recipe in this repo, for the experts-in-RAM tooling.
