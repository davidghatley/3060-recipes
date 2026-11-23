# qwen38-27b-family

Four finetunes of the dense [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B) on the RTX 3060 12 GB, with stock
llama.cpp master. One serve script, one tuned config, a `VARIANT=` switch.

The 3-bit files are 10.4–12.2 GB, so with any context window some weights have to sit in RAM. Every GB there costs
~29 ms per token. The recipe shrinks everything else on the card (q4_0 K/V, ubatch 256) so that as little as possible
leaves it: only the FFN of layers 0–2 for pi at 32k, nothing at 16k.

Numbers and quality: [RESULTS.md](RESULTS.md). Experiment log: [PLAN.md](PLAN.md). Ceilings: [THEORY.md](THEORY.md).
Raw data: `runs/`, one config per run in `configs/`.

## Result (pi, single user)

| | Stock llama.cpp (`--fit on`, 32k) | **This recipe, 32k** | 16k (`fast`) | 128k (`long`) |
|---|---:|---:|---:|---:|
| Decode, coding answer | 7.9 tok/s | **16.6 tok/s (2.1×)** | **19.7 (2.5×)** | 7.5 |
| Decode deep in the window | | 13.8 at 30k | 17.6 at 15k | 5.6 at 120k |
| Prefill, 8k prompt | 475 tok/s | 543 | 570 | 403 |
| Needles, ~50% / ~95% of the window | | 3/3, 3/3 | 3/3, 3/3 | 3/3, 3/3 |

The all-on-GPU ceiling is 31.7 tok/s; the `fast` profile reaches 62% of it.

## The variants

| `VARIANT=` | Model | File (pinned) | Decode, 32k default | `fast` 16k / `long` 128k | Gates | Card sampling, thinking |
|---|---|---|---:|---:|---|---|
| `pi` (default) | harness-hub pi-adapted (coding-agent LoRA, merged) | netprojects IQ3_XXS, 11.4 GB | 16.6 | 19.7 / 7.5 | needles 3/3, codeeval 7/8 | T 0.8, top-p 1.0, thinking off |
| `huihui` | Huihui abliterated (uncensored) | huihui-ai GSQ-RCO IQ3_XXS + MTP, 10.4 GB | **20.8** | 20.8 / 9.4 | needles 3/3, codeeval 8/8, refusals 0/20 | T 1.0, top-p 0.95, top-k 20, thinking on |
| `daisyrose` | RadixArk DaisyRose-27B | bartowski IQ3_XXS, 12.2 GB | 14.4 | 16.5 / 7.4 | needles 3/3, codeeval 8/8 | T 1.0, top-p 0.95, top-k 20, thinking on |
| `heretic` | DavidAU TURBO Fable Cold-Fusion Heretic (uncensored) | DavidAU IQ2_M (BF16 LM head), 12.1 GB | 11.6 | 14.2 / 6.2 | needles 3/3, codeeval 6/8, refusals 0/20 | T 0.7, top-p 0.95, top-k 20, rep pen 1.0, thinking on |

All are the same Qwen3.8-27B architecture, so one config fits all; only the number of FFN layers that stay in RAM
differs, because the files differ in size (serve.sh sets it per variant and profile). Every member was checked
against stock llama.cpp flags with control / tuned / control: 1.7–2.1× decode. KL divergence was not measured (no
higher-precision reference on disk); the publishers' figures are in RESULTS.md.

## Use it

```bash
# 1. weights (pinned, see ../notes/trending-batch-1-weights.tsv) -> /mnt/models/llm/qwen38-27b-family/<variant>/
# 2. engine: llama.cpp master 225a5345b, CUDA build (this box: /mnt/scratch/llama.cpp/master-225a5345b/bin)
# 3. serve (through gpu_run, OpenAI-compatible on 127.0.0.1:8101)
./serve.sh                                   # pi, 32k
VARIANT=huihui ./serve.sh                    # another member
Q38_PROFILE=fast ./serve.sh                  # 16k, fastest
Q38_PROFILE=long ./serve.sh                  # 128k
Q38_THINK=off VARIANT=daisyrose ./serve.sh   # thinking off for a thinking-default member
Q38_DRY=1 ./serve.sh                         # print the llama-server command and exit
```

Knobs (all `Q38_*` env vars): `Q38_PROFILE` default|fast|long, `Q38_CTX`, `Q38_KV` / `Q38_KV_V` (K/V cache types),
`Q38_FFN_CPU` (how many leading layers keep their FFN in RAM), `Q38_OT` (raw `-ot` override), `Q38_NGL`, `Q38_FIT`,
`Q38_UBATCH`, `Q38_BATCH`, `Q38_THREADS`, `Q38_THINK` on|off, `Q38_SAMPLING`, `Q38_SPEC` none|mtp|dflash2 with
`Q38_DRAFT_N` / `Q38_DRAFT_MODEL` / `Q38_DRAFT_NGL`, `Q38_MMPROJ` (path or `auto`), `Q38_LORA`, `Q38_PORT`,
`Q38_MODEL`, `Q38_BIN`, `Q38_EXTRA` (extra llama-server args), `Q38_NO_GPU_RUN`, `Q38_NEED`, `Q38_WAIT`, `GPU_RUN_MEM`
(default 44G: the FFN layers in RAM are mmap'd from the page cache, which `gpu_run`'s cap counts).

If you change the window, re-find the FFN count: the card has ~10.8 GB for weights + K/V + DeltaNet state + compute
buffer, and each FFN layer moved to RAM frees ~98 MiB (pi) and costs ~2.8 ms per token.

### Things that do not help here

- **MTP** (`Q38_SPEC=mtp`): loads and drafts well (91–98% accepted), but its ~650 MiB of VRAM pushes 6–10 FFN layers
  to RAM, and no setting beat the plain control by more than noise. **DFlash2** with the Kintsugi drafter does not fit.
- **q8_0 K/V** or mixed K/V at 32k, **ubatch 128**, more CPU threads.

## Tools

| | |
|---|---|
| `serve.sh` | the server, every knob an env var |
| `tools/srvtest.py` | prefill / decode / deep-decode / needle tests against a running server, writes `runs/ledger.jsonl` |
| `tools/measure.sh` | the full measurement set: srvtest + codeeval + greedy prompts + refusal probe + memory |
| `tools/member.sh` | fit search, control / tuned / control and the measurement set for one variant |
| `tools/srv.sh`, `tools/gpu_batch.sh` | one config + one test via `../scripts/with_server.sh`; a batch inside one `gpu_run` session |
| `tools/fitprobe.py` | load + one 3k-token request: does this placement really fit |
| `tools/greedy.py` | 8 fixed prompts at temperature 0; `--compare` two runs |
| `tools/gguf_info.py` | GGUF header reader: metadata, bytes per tensor kind and per layer (works on `.part` files) |
| `tools/kintsugi_lora_serve.sh` | the Kintsugi bundle's server with `--lora` (the stretch test; it does not load) |
| `tools/mkconfigs.py` | `configs/<run>.json` from each run's exact command and ledger medians |

## Credits

- [Qwen](https://huggingface.co/Qwen/Qwen3.8-27B), for Qwen3.8-27B.
- [harness-hub](https://huggingface.co/harness-hub/Qwen3.8-27B-pi-adapted), for the pi-adapted LoRA, and
  [netprojects](https://huggingface.co/netprojects/Qwen3.8-27B-pi-adapted-GGUF), for the merged GGUFs with the MTP
  head kept.
- [DavidAU](https://huggingface.co/DavidAU/Qwen3.8-27B-TURBO-Fable-Cold-Fusion-735-882-Heretic-Uncensored-NEO-CODER-MAX-MTP-GGUF),
  for the Heretic uncensored merge.
- [RadixArk](https://huggingface.co/RadixArk/DaisyRose-27B), for DaisyRose-27B, and
  [bartowski](https://huggingface.co/bartowski/RadixArk_DaisyRose-27B-GGUF), for its GGUFs.
- [huihui-ai](https://huggingface.co/huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF), for the abliterated model and
  its GSQ-RCO GGUF (the quantizer is ISTA-DASLab's GSQ-RCO).
- [llama.cpp](https://github.com/ggml-org/llama.cpp), for the engine, the `qwen35` / MTP support,
  `convert_lora_to_gguf.py` and `llama-bench`.
- [CaryPalmer/Kintsugi-27B](https://huggingface.co/CaryPalmer/Kintsugi-27B) and the `kintsugi-27b` recipe in this repo,
  for the DFlash2 drafter and the bundle used in the LoRA test.
- The tuning method comes from 0xSero's
  [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill): ceilings first,
  one change at a time with controls, and output gated as well as speed.
- The inkling-2-mini and flint recipes in this repo, for the test tooling this recipe adapts.
