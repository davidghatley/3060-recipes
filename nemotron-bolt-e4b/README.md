# nemotron-bolt-e4b

Serving [nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB) on the
RTX 3060 12 GB with stock llama.cpp. It is NVIDIA's post-train of Gemma-4-E4B-it: 42 dense layers (35 sliding-window,
7 global), the last 18 of them reusing earlier layers' K/V, per-layer input embeddings and a 262k vocabulary, with a
64k window. The weights are NVIDIA's own Q4_K_M GGUF (6.18 GB), and the card names a companion DFlash drafter
(737 MB).

Everything fits in VRAM with room to spare, so this recipe is about two things:
- **speculative decoding with the card's DFlash drafter.** Plain decode already runs at 71% of the bandwidth
  ceiling, so the drafter is the one big lever: 2.5× at empty context and 2.9× deep in the window;
- **what the drafter costs.** It slows prefill by about 40%, so there is a no-drafter profile for prompt-heavy work.

Numbers and quality are in [RESULTS.md](RESULTS.md). The experiment log is [PLAN.md](PLAN.md), the ceilings are in
[THEORY.md](THEORY.md), and the raw data is in `runs/`.

## Result

| Single user, 64k window | Stock (card's command line) | **This recipe** |
|---|---:|---:|
| Decode, thinking on | 75.9 tok/s | **190.4 tok/s (2.5×)** |
| Decode, thinking off | 76.3 tok/s | **216.7 tok/s (2.8×)** |
| Decode at 60k context | 54.2 tok/s | **157.8 tok/s (2.9×)** |
| Prefill 8k / 32k / 60k | 4,890 / 3,901 / 3,117 tok/s | 3,031 / 2,472 / 2,006 tok/s (0.62×) |
| Time to first token, 61k prompt | 19.8 s | 30.9 s |
| Needles at 32k / 61k | 3/3 / 3/3 | 3/3 / 3/3 |
| Card (incl. ~1 GB desktop) | 5.4 GB | 8.6 GB |

- Plain decode tops out at 77.6 tok/s, 71% of the 109 tok/s ceiling (3.13 GB read per token at 342 GB/s).
- The drafter accepts 41% of its 7-token drafts with thinking on (48% off), about 3.9 tokens per step.
- q8_0 K/V should help deep in the window on paper, but it decodes 22% slower at 32k on this engine. f16 stays.
- Quality matches stock: same needles, same codeeval (7/8 thinking off). With thinking on the model usually writes
  bare code without a ``` fence, which the shared codeeval harness counts as a failure; see RESULTS.md.

## Which config

| `NB_PROFILE=` | Drafter | Slots × window | ubatch | Decode (think on) / at 60k | Prefill 8k / 60k | Card | Use |
|---|---|---|---:|---:|---:|---:|---|
| **`default`** | DFlash n=7 | 1 × 64k | 1024 | 190.4 / 157.8 | 3,031 / 2,006 | 8.6 GB | chat, coding, agents: anything that writes more than it reads |
| `nospec` | none | 1 × 64k | 1024 | 77.5 / 54.6 | 5,060 / 3,451 | 5.5 GB | long prompts with short answers (RAG, summarising files) |
| `multi` | DFlash n=7 | 4 × 32k | 512 | 270.7 aggregate at 4 users | – | 8.7 GB | several users or parallel agents |
| `stock` | none | card default | 512 | 75.9 / 54.2 | 4,890 / 3,117 | 5.4 GB | the baseline |

All tuned profiles add `-bs` (llama.cpp's experimental backend sampling: +1.5% plain, +5% with the drafter, same
greedy output). For 4 × 64k slots use `NB_PROFILE=multi NB_CTX=262144 NB_SPEC=none` (164.6 tok/s aggregate);
4 × 64k with the drafter runs out of VRAM under four long prompts at once.

`NB_DRAFT_Q8=1` uses a local Q8_0 copy of the drafter (made by `tools/quantize_drafter.sh`): +5–7% decode, same
acceptance, identical greedy output. It is not the default because the drafter is published under NVIDIA's
evaluation licence (see below).

## Use it

```
# 1. weights (pinned; ../scripts/hf_get.sh fetches, resumes and checks sha256)
#    nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB @ 1db54d5b1 -> /mnt/models/llm/nemotron-bolt-e4b/
#      Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf (sha256 c8af2b8a…)          ../notes/trending-batch-1-weights.tsv
#    nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB-DFlash @ 0949a2eb7 -> /mnt/models/llm/nemotron-bolt-e4b/dflash/
#      Nemotron-3.5-Bolt-E4B-DFlash-BF16.gguf (sha256 8103aa42…)     runs/dflash-manifest.tsv
# 2. engine: stock llama.cpp master 225a5345b, CUDA build (/mnt/scratch/llama.cpp/master-225a5345b/bin)
# 3. serve (through gpu_run, OpenAI-compatible on 127.0.0.1:8105, model name nemotron-bolt)
./serve.sh                          # default: DFlash drafter, 64k
NB_PROFILE=nospec ./serve.sh        # no drafter: fastest prefill
NB_PROFILE=multi ./serve.sh         # 4 slots x 32k with the drafter
NB_THINK=off ./serve.sh             # thinking off by default (per request: chat_template_kwargs.enable_thinking)
```

The launch line `serve.sh` runs:

```
llama-server -m Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf -ngl 999 -c 65536 -np 1 -t 6 -b 2048 -ub 1024 -fa on \
  -ctk f16 -ctv f16 -bs --spec-draft-model Nemotron-3.5-Bolt-E4B-DFlash-BF16.gguf --spec-type draft-dflash \
  --spec-draft-n-max 7 --spec-draft-ngl 999 --jinja --reasoning-format deepseek --reasoning on \
  --temp 1.0 --top-p 0.95 --top-k 64 --min-p 0
```

It runs under `gpu_run` with `GPU_RUN_MEM=24G` and holds the GPU lock while serving. Every knob has an `NB_*` override
(see the header of `serve.sh`). Sampling is the card's (temperature 1.0, top-p 0.95) plus the GGUF's top-k 64.
Thinking is on by default, as in the card; reasoning comes back in `reasoning_content`.

## Licences

- The model: [OpenMDW-1.1](https://openmdw.ai/license/1-1/). The card notes the Gemma 4 base is under Apache-2.0.
- The DFlash drafter's GGUF metadata names the **NVIDIA Software and Model Evaluation License**, a different and
  narrower licence than the model's. Check it before using the default profile for anything beyond evaluation;
  `NB_PROFILE=nospec` needs only the model file.

## Tools

| Tool | What it does |
|---|---|
| `serve.sh` | the launcher: profile, drafter, slots, K/V, ubatch; holds the GPU lock while serving |
| `tools/srv.sh <label> [ENV=…] -- <cmd>` | one server start/stop through `../scripts/with_server.sh` on port 8105, logs the exact command to `runs/cmd-<label>.txt` |
| `tools/gpu_batch.sh <batch.sh>` | one GPU-lock hold per batch (`GPU_RUN_MEM=24G`); batches live in `runs/batches/` |
| `tools/srvtest.py` | prefill, decode (with draft acceptance) and needle client on llama-server's own timings (from `../sensenova-loop-9b/`) |
| `tools/measure.sh <label> <window>` | the full measurement set: prefill 8k/32k/92%, decode empty and deep, needles 50%/95%, codeeval, greedy, memory |
| `tools/concurrent.py`, `tools/soak.sh` | N simultaneous requests (aggregate tok/s) and N simultaneous long needles |
| `tools/codeeval_lenient.py` | `../scripts/codeeval.py`'s tasks scored strict and counting bare unfenced code; saves the answers |
| `tools/codeeval_dump.py` | raw answers for the first codeeval tasks, thinking on and off |
| `tools/greedy.py` | temperature-0 answers to fixed prompts, and `--compare` for equivalence |
| `tools/params.py` | bytes and FLOPs per token, K/V bytes per layer, from the GGUF header (`runs/params.txt`) |
| `tools/gguf_info.py` | GGUF header and tensor summary (`runs/gguf-info*.txt`) |
| `tools/quantize_drafter.sh` | local Q8_0 copy of the drafter for `NB_DRAFT_Q8=1` |
| `tools/mkconfigs.py` | writes `configs/<label>.json` from each run's command and ledger medians |
| `tools/mem.sh` | CUDA buffers, VmHWM, cgroup peak, VRAM and startup time of a running server |

## Credits

- [NVIDIA](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB), for Nemotron-3.5-Bolt-E4B, its Q4_K_M GGUF
  and the [DFlash drafter](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB-DFlash), and for a card with a
  working llama.cpp command line.
- [Google](https://huggingface.co/google/gemma-4-E4B-it), for Gemma-4-E4B-it, the base model and architecture.
- [llama.cpp](https://github.com/ggml-org/llama.cpp) and ggml-org, for the engine, Gemma-4 support, DFlash speculative
  decoding, backend sampling and `llama-quantize`.
- The sibling recipe [`../sensenova-loop-9b/`](../sensenova-loop-9b/) for the batch tooling this one adapts, and
  [`../qwen35-3d-coder/`](../qwen35-3d-coder/) for the earlier DFlash and K/V findings.
- The tuning method comes from 0xSero's [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill):
  ceilings first, one change at a time between controls, output gated as well as speed.
