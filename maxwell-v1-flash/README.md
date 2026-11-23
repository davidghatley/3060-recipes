# maxwell-v1-flash

Serving [maxwell-model/Maxwell-V1-Flash](https://huggingface.co/maxwell-model/Maxwell-V1-Flash) on the RTX 3060 12 GB
with llama.cpp. It is a 35B MoE with ~3B active per token (256 routed experts, 12 active, plus one shared expert),
45 layers with four mHC residual streams, and a 200k-token vocabulary. The weights are AtomicChat's
`AD-Q4_K-IQ4_XS` GGUF (20.8 GB), which needs AtomicChat's llama.cpp port. The uncensored variant is AtomicChat's
rank-1 LoRA, applied at runtime.

The 20.8 GB file does not fit in 12 GB, so experts live in RAM. This recipe is about two things:
- **where the experts go.** Every routed expert stays in RAM, and 1.9 GB of the card holds llama.cpp's MoE cache of
  the hot ones. That beats pinning whole layers on the GPU: the cache holds 11% of the experts and, once warm, serves
  about half of the expert reads from VRAM (THEORY.md);
- **what the KV cache costs deep in the window.** Every layer runs dense attention (the original model's block-sparse
  attention is not in the port), and q8_0 KV decodes 35% slower than f16 at 32k on this engine. So the default spends
  VRAM on f16 KV and not on a bigger cache.

Numbers and quality are in [RESULTS.md](RESULTS.md). The experiment log is [PLAN.md](PLAN.md), the ceilings are in
[THEORY.md](THEORY.md), and the raw data is in `runs/`.

## Result

| Single user, 64k context | Stock llama.cpp `--fit` (port build) | **This recipe** |
|---|---:|---:|
| Decode, coding answer | 35.9 tok/s | **48.0 tok/s (1.34×)** |
| Decode at 32k context | 27.4 tok/s | **33.6 tok/s (1.23×)** |
| Prefill, 8k prompt | 364 tok/s (22 s to first token) | **787 tok/s (10 s, 2.16×)** |
| Prefill, 32k / 65k prompt | 333 / not measured | **638 / 509 tok/s** (50 s / 128 s) |
| Needles at 32k / ~62k | 3/3 / not run | 3/3 / codes found, not clean (see below) |
| Card / RAM | 10.9 GB / 21.7 GB | 11.25 GB / 20–26 GB |

- The model card's own line (`-ngl 99 -c 32768`) does not load on a 12 GB card: it tries to allocate 19,397 MiB on the GPU.
- 48.0 tok/s is 65% of the practical ceiling (73.9 tok/s, every expert in VRAM, which does not fit) and 39% of the
  pure bandwidth ceiling. The rest is a fixed 13.5 ms per token in the 45 layers' attention, mHC and MoE dispatch,
  which only kernel work would reduce (THEORY.md).
- **Long-context retrieval is shaky at the top of the window.** At 32k all three needles come back exactly every time.
  At 59–62k no run was clean: a code missing or misprinted, or the codes in the wrong order. KV type does not change
  this, so do not trust exact recall near 64k.
- **The uncensored LoRA halves decode** (23.2 tok/s) on this layout: its edit of the routed experts runs outside
  the MoE cache. It answers 20/20 probe prompts (base 18/20) and passes codeeval 8/8.

## Which config

| `MX_PROFILE=` | KV | MoE cache | ubatch | Decode empty / at 32k | Prefill 8k | Use |
|---|---|---:|---:|---:|---:|---|
| **`default`** | f16 | 1900 MiB | 1024 | 48.0 / 33.6 | 787 | most use: anything with more than ~4k tokens of context |
| `short` | q8_0 | 4800 MiB | 512 | 55.0 / 22.1 | 522 | short chats: fastest at empty context, 35% slower at 32k |
| `prompt` | f16 | 1100 MiB | 2048 | 44.1 / not measured | 1127 | long prompts (RAG, agents reading files): +43% prefill and −7% decode vs default |

`short` and `prompt` numbers come from the tuning runs (PLAN rows 7, 9, 14), not from the qualification batch.

| `VARIANT=` | Weights | Decode (default profile) | codeeval | Refusal probe answered | KLD vs the shipped file, wiki / code |
|---|---|---:|---:|---:|---:|
| **`base`** (default) | AD-Q4_K-IQ4_XS | 48.0 (33.6 at 32k) | 7/8 | 18/20 (2 refused) | 0 (reference) |
| `uncensored` | + AtomicChat's rank-1 LoRA at runtime | 23.2 (19.4 at 32k) | 8/8 | 20/20 | 0.387 / 0.167 |

## Use it

```
# 1. weights (pinned in ../notes/trending-batch-1-weights.tsv; ../scripts/hf_get.sh fetches, resumes and checks sha256)
#    AtomicChat/Maxwell-V1-Flash-GGUF @ 0e2d02c0 -> /mnt/models/llm/maxwell-v1-flash/
#      Maxwell-V1-Flash-AD-Q4_K-IQ4_XS.gguf (sha256 e463faa6…), maxwell-moe-port.patch
#    AtomicChat/Maxwell-V1-Flash-Uncensored-GGUF @ 27923879 -> /mnt/models/llm/maxwell-v1-flash/uncensored/
#      Maxwell-V1-Flash-Uncensored-LoRA.gguf (sha256 9cb9a25f…)
# 2. engine: llama.cpp d3c3e242c + maxwell-moe-port.patch, CUDA build
#    -> /mnt/scratch/llama.cpp/maxwell-4f969ad24/bin (stock llama.cpp does not load Maxwell)
# 3. serve (through gpu_run, OpenAI-compatible on 127.0.0.1:8104, model name maxwell-v1-flash)
./serve.sh                          # base, default profile, 64k
VARIANT=uncensored ./serve.sh       # + the uncensored LoRA
MX_PROFILE=short ./serve.sh         # q8_0 KV + 4800 MiB cache
MX_PROFILE=prompt ./serve.sh        # ub 2048 for long prompts
MX_THINK=0 ./serve.sh               # thinking off by default (the template reads enable_thinking)
```

The launch line `serve.sh` runs:

```
llama-server -m Maxwell-V1-Flash-AD-Q4_K-IQ4_XS.gguf -ngl 99 --cpu-moe --fit off -c 65536 -np 1 -fa on --jinja \
  --moe-cache-mib 1900 --moe-cache-cpu-share 0.95 --load-mode none -ctk f16 -ctv f16 -ub 1024 \
  --temp 0.6 --top-p 0.95 --top-k 20
```

It runs under `gpu_run` with `GPU_RUN_MEM=44G`: `--load-mode none` reads the experts into ~20 GB of process memory,
and the memory cap counts it. Every knob has an `MX_*` override (see the header of `serve.sh`). Thinking is on by
default. Maxwell's template reads `enable_thinking`, not `reasoning_effort`: send
`"chat_template_kwargs": {"enable_thinking": false}` per request, or start the server with `MX_THINK=0`.

The uncensored variant answers requests the original refuses. What it is used for is up to whoever runs it.

## Tools

| Tool | What it does |
|---|---|
| `serve.sh` | the launcher: variant, profile, placement, cache, KV, ubatch; holds the GPU lock while serving |
| `tools/run.sh <label> <mode> [args]` | one server start/stop through `../scripts/with_server.sh` on port 8104, then `tools/gate.sh` |
| `tools/gate.sh` | one test mode: `speed`, `deep` (decode after 32k + needles), `pp`, `needles`, `code`, `refusal`, `quality`, `load`; logs host load, `/lora-adapters`, RSS and VRAM to `runs/ledger.jsonl` |
| `tools/srvtest.py` | speed, prefill and needle client (llama-server's own timings; from `../inkling-2-mini/`, switched to `enable_thinking`, logs the expected needle codes) |
| `tools/batch.sh`, `tools/queue.sh` | one GPU-lock hold per batch file (`GPU_RUN_MEM=44G`), batches one after another |
| `tools/lbench.sh` | `llama-bench` on the Maxwell build, inside a batch |
| `tools/kld.sh ref|cmp` | KLD with `llama-perplexity` against the shipped file's own logits (wiki + code) |
| `tools/gguf_info.py` | GGUF header and tensor summary (`runs/gguf-info-*.txt`) |

`../inkling-2-mini-uncensored/tools/lora_info.py` produced `runs/lora-info-uncensored.txt`.

## Credits

- The [Maxwell team](https://huggingface.co/maxwell-model/Maxwell-V1-Flash) ([GitHub](https://github.com/maxwell-model/Maxwell-V1-Flash),
  [maxwell-llm.ai](https://maxwell-llm.ai/)), for Maxwell-V1.0-Flash (Apache-2.0).
- [AtomicChat](https://atomic.chat) ([GitHub](https://github.com/AtomicBot-ai/Atomic-Chat)), for the llama.cpp port
  (`maxwell-moe-port.patch`), the [AD-Q4_K-IQ4_XS GGUF](https://huggingface.co/AtomicChat/Maxwell-V1-Flash-GGUF) with its
  KLD tables and precision notes, and the [uncensored LoRA](https://huggingface.co/AtomicChat/Maxwell-V1-Flash-Uncensored-GGUF).
  The evaluation sets their uncensored card reports (mlabonne/harmful_behaviors, walledai/XSTest, MMLU) were not rerun here.
- [llama.cpp](https://github.com/ggml-org/llama.cpp) and ggml-org, for the engine, `--cpu-moe`, the MoE cache,
  `--load-mode`, `--lora`, `llama-bench` and `llama-perplexity`.
- The sibling recipes [`../flint/`](../flint/) (MoE cache and load-mode findings) and
  [`../inkling-2-mini-uncensored/`](../inkling-2-mini-uncensored/) (runtime LoRA cost with experts in RAM, `lora_info.py`).
- The tuning method comes from 0xSero's [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill):
  ceilings first, one change at a time between controls, output gated as well as speed.
