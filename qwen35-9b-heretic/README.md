# qwen35-9b-heretic

Serving DavidAU's [Qwen3.5-9B "The Defiant Fable" Uncensored Heretic NEO-IMATRIX-MAX-MTP](https://huggingface.co/DavidAU/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP-GGUF)
on the RTX 3060 12 GB with stock llama.cpp. It is an uncensored merge of Heretic'd Qwen3.5-9B finetunes (by DavidAU
and Nightmedia): Qwen3.5's hybrid layout (32 layers, 3 Gated DeltaNet : 1 full attention, 262k native window) plus
one multi-token-prediction (MTP) layer. The file is the Q6_K "MAX" quant (8.76 GB), which keeps the output head at
BF16.

Everything fits in VRAM, so this recipe is about three things:
- **the file's own MTP head.** Plain decode already runs at 90% of the bandwidth ceiling; MTP n=2 gives 1.6×.
  The same family's MTP head broke long answers on an older llama.cpp (`../qwen35-3d-coder/`), so long answers
  were checked with and without it: no difference on this build;
- **the BF16 head.** It is 26% of the bytes read per token and MTP reads it again for every draft. An optional local
  copy with only the head at Q8_0 runs 2.0× stock at KLD 0.0001;
- **the window.** 12 GB holds 64k (f16 K/V) with MTP, 128k with MTP and the Q8_0 head, and 192k without MTP.

Numbers and quality are in [RESULTS.md](RESULTS.md). The experiment log is [PLAN.md](PLAN.md), the ceilings are in
[THEORY.md](THEORY.md), and the raw data is in `runs/`.

## Result

| Single user | Stock (`llama-server -m … --jinja`) | **This recipe (default)** | `fast` (Q8_0 head) |
|---|---:|---:|---:|
| Decode, thinking off | 39.4 tok/s | **64.3 tok/s (1.6×)** | 78.3 tok/s (2.0×) |
| Decode, thinking on | 39.4 tok/s | **61.5 tok/s (1.6×)** | 78.1 tok/s (2.0×) |
| Decode deep in the window | 31.5 (63k) | **49.9 (60k, 1.6×)** | 38.2 (120k) |
| Prefill 8k / 32k | 1,787 / 1,624 tok/s | 1,681 / 1,513 tok/s (0.94×) | 1,672 / 1,494 tok/s |
| Window | 69k (fit's choice, shared by 4 slots) | 64k | 128k |
| Needles at ~50% / ~95% | 3/3 / 3/3 | 3/3 / 3/3 | 3/3 / 3/3 |
| Card (incl. ~1 GB desktop) | 11.0 GB | 11.4 GB | 11.5 GB |

- Plain decode tops out at 39.4 tok/s, 90% of the 43.8 tok/s ceiling (7.81 GB read per token at 342 GB/s).
- MTP n=2 accepts 85% of drafts on code (79% with thinking on), about 2.6 tokens per step; 64.3 is 90% of the
  bytes-only ceiling at that acceptance.
- Refusal probe: 20/20 answered with thinking off (every answer read). No base model on disk to compare against.

## Which config

| `QH_PROFILE=` | File | MTP | Window, K/V | Decode d0 / deep | Prefill 8k | Card | Use |
|---|---|---|---|---:|---:|---:|---|
| **`default`** | published | n=2 | 64k f16 | 64.3 / 49.9 (60k) | 1,681 | 11.4 GB | chat, coding, writing: works on the download as-is |
| `fast` | local Q8_0-head copy | n=2 | 128k q8_0 | 78.3 / 38.2 (120k) | 1,672 | 11.5 GB | fastest decode and a bigger window; run `tools/requant_head.sh` once |
| `nospec` | published | – | 128k q8_0 | 39.3 / 24.6 (120k) | 1,767 | 11.4 GB | long prompts with short answers |
| `long` | published | – | 192k q4_0 | 39.3 / 20.2 (180k) | 1,752 | 11.2 GB | the largest window that fits |
| `stock` | published | – | fit's choice | 39.4 / 31.5 (63k) | 1,787 | 11.0 GB | the baseline |

`QH_CTX=98304 QH_KV=q8_0 ./serve.sh` gives the default with a 96k window (62.6 tok/s, 37.2 at 90k). The VRAM
figures leave 0.8–1.3 GB of the card free; close other GPU programs before the big windows.

## Use it

```
# 1. weights (pinned; ../scripts/hf_get.sh fetches, resumes and checks sha256)
#    DavidAU/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP-GGUF @ 4d47954f2
#      -> /mnt/models/llm/qwen35-9b-heretic/Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf
#         (sha256 b54d045c…)                                  ../notes/trending-batch-1-weights.tsv
# 2. engine: stock llama.cpp master 225a5345b, CUDA build (/mnt/scratch/llama.cpp/master-225a5345b/bin)
# 3. serve (through gpu_run, OpenAI-compatible on 127.0.0.1:8106, model name qwen35-9b-heretic)
./serve.sh                          # default: MTP n=2, 64k
tools/requant_head.sh               # once, for the fast profile (48 s on the CPU, writes a 7.8 GB local file)
QH_PROFILE=fast ./serve.sh          # Q8_0 head + MTP n=2, 128k
QH_PROFILE=long ./serve.sh          # 192k, no MTP
QH_THINK=off ./serve.sh             # thinking off by default (per request: chat_template_kwargs.enable_thinking)
```

The launch line `serve.sh` runs:

```
llama-server -m Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf --no-mmproj -ngl 99 --fit off \
  -c 65536 -np 1 -t 6 -b 2048 -ub 512 -fa on -ctk f16 -ctv f16 --spec-type draft-mtp --spec-draft-n-max 2 \
  --jinja --reasoning-format deepseek --reasoning on \
  --temp 1.0 --top-p 0.95 --top-k 20 --min-p 0 --repeat-penalty 1.0 --presence-penalty 0
```

It runs under `gpu_run` with `GPU_RUN_MEM=24G` and holds the GPU lock while serving. Every knob has a `QH_*` override
(see the header of `serve.sh`). Sampling is the card's "thinking, general" setting; the card asks for repetition
penalty 1 with MTP quants. Thinking is on by default, as in the chat template; reasoning comes back in
`reasoning_content`.

## Licences

- The model: Apache-2.0 (card and GGUF header), as is the Qwen3.5-9B base. The `fast` profile's local file is a
  derivative of it.
- The model is uncensored: it answers requests a stock assistant refuses. That is the point of the variant; what it
  is used for is the user's responsibility.

## Tools

| Tool | What it does |
|---|---|
| `serve.sh` | the launcher: profile, MTP, window, K/V; holds the GPU lock while serving |
| `tools/srv.sh <label> [ENV=…] -- <cmd>` | one server start/stop through `../scripts/with_server.sh` on port 8106, logs the exact command to `runs/cmd-<label>.txt` |
| `tools/gpu_batch.sh <batch.sh>`, `tools/launch.sh`, `tools/chain.sh` | one GPU-lock hold per batch (`GPU_RUN_MEM=24G`), detached, logging to `runs/batches/` with a final `end rc=` line |
| `tools/srvtest.py` | prefill, decode (with draft acceptance) and needle client on llama-server's own timings |
| `tools/measure.sh <label> <window>` | the full measurement set: prefill 8k/32k/92%, decode empty and deep, needles 50%/95%, codeeval, greedy, refusal, memory |
| `tools/longans.py` | long answers (thinking on, 10k–24k cap) with loop and garbage flags, full texts saved for reading |
| `tools/greedy.py` | temperature-0 answers to fixed prompts, and `--compare` for equivalence |
| `tools/requant_head.sh` | the local copy with only `output.weight` at Q8_0 |
| `tools/kld.sh` | KL divergence of a change against the published file |
| `tools/concurrent.py` | N simultaneous requests (aggregate tok/s) |
| `tools/codeeval_lenient.py` | `../scripts/codeeval.py`'s tasks also counting bare unfenced code (not needed here: every answer was fenced) |
| `tools/gguf_info.py` | GGUF header and tensor summary (`runs/gguf-info.txt`) |
| `tools/mkconfigs.py` | writes `configs/<label>.json` from each run's command and ledger medians |
| `tools/mem.sh` | VmHWM, cgroup peak, VRAM and startup time of a running server |

## Credits

- [DavidAU](https://huggingface.co/DavidAU), for the model, its imatrix GGUFs with the BF16 head and the MTP layer,
  and the sampler settings on the card; with Nightmedia, co-author of the merge, and the parent finetunes
  [nightmedia/Qwen3.5-9B-TNG-PKD-Qwopus-Coder](https://huggingface.co/nightmedia/Qwen3.5-9B-TNG-PKD-Qwopus-Coder) and
  DavidAU's Heretic'd [Pro-Writer-1984-Orwell](https://huggingface.co/DavidAU/Qwen3.5-9B-Pro-Writer-1984-Orwell-Uncensored-Heretic),
  [Bradbury-F451](https://huggingface.co/DavidAU/Qwen3.5-9B-The-Bradbury-F451-Pro-Writer-Uncensored-Heretic) and
  [Polar-Rev1](https://huggingface.co/DavidAU/Qwen3.5-9B-Polar-Rev1-Uncensored-Heretic) (links from the GGUF header).
- The Heretic decensoring tool that the "Heretic" models are named after; the card calls the model "Heretic'd" but
  does not link the tool.
- [Qwen](https://huggingface.co/Qwen/Qwen3.5-9B), for Qwen3.5-9B, the base model, architecture and MTP design.
- [llama.cpp](https://github.com/ggml-org/llama.cpp) and ggml-org, for the engine, Qwen3.5 and MTP speculative
  decoding support, `llama-quantize` and `llama-perplexity`.
- The sibling recipes [`../nemotron-bolt-e4b/`](../nemotron-bolt-e4b/) and [`../sensenova-loop-9b/`](../sensenova-loop-9b/)
  for the batch tooling this one adapts, and [`../qwen35-3d-coder/`](../qwen35-3d-coder/) for the earlier MTP finding.
- The tuning method comes from 0xSero's [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill):
  ceilings first, one change at a time between controls, output gated as well as speed.
