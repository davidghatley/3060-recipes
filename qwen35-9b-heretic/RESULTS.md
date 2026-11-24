# Qwen3.5-9B "The Defiant Fable" Heretic MTP results

- GPU: RTX 3060 12 GB (sm_86), ~1 GB of it held by the desktop. CPU: i5-12500, 6 threads. RAM: 62 GiB. Measured
  bandwidth: 342 GB/s VRAM (`THEORY.md`).
- Model: DavidAU's Qwen3.5-9B "The Defiant Fable" Uncensored Heretic, a multi-stage merge by DavidAU and Nightmedia
  of Heretic'd Qwen3.5-9B finetunes (six parents listed in the GGUF header). Qwen3.5-9B hybrid layout: 32 layers,
  3 Gated DeltaNet : 1 full attention (8 layers with K/V), 262k native window, 248k vocabulary, plus one MTP layer
  (`runs/gguf-info.txt`).
- Weights: @ 4d47954f2, `Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf` (8.76 GB, sha256
  b54d045c…): Q6_K blocks, imatrix ("NEO" dataset), and a **BF16 output head** (2.03 GB, the "MAX" part).
- Runtime: stock llama.cpp **master 225a5345b** (`/mnt/scratch/llama.cpp/master-225a5345b`), CUDA build. No patches.
  The `fast` profile's local file was made with `llama-quantize` from master 29b52d398 (`tools/requant_head.sh`).
- Measured 2026-11-23. Speed rows: `tools/srvtest.py` (llama-server's own timings; decode = median of 6 capped coding
  answers, thinking off × 256 tokens or thinking on × 512; prefill = median of 2 cold prompts), every tuning candidate
  between controls in one GPU-lock hold. Raw: `runs/ledger.jsonl`, `runs/batches/*.log`, `runs/server-*.log`,
  `runs/greedy/`, `runs/longans/`, `runs/codeeval-*.json`, `runs/refusal-*.json`, `runs/kld/`. One config JSON per
  run in `configs/`.

## Verdict

- **Ships: `serve.sh` default. The published file as downloaded, all in VRAM, its own MTP head (n=2), f16 K/V,
  64k window, one slot.** 64.3 tok/s decode (61.5 with thinking on) and 49.9 at 60k of context, against 39.4 / 31.5
  for llama-server's defaults: **1.6× at empty context and deep in the window**. 11.4 GB on the card including the
  desktop.
- **MTP does not break long answers on this build.** The same Qwen3.5 family's MTP head looped on long answers with
  llama.cpp b12242 (`../qwen35-3d-coder/`). On master 225a5345b, six long answers (to 10k tokens, thinking on) behaved
  the same with and without MTP, and a 24k-token answer stayed coherent. Greedy output matches plain decoding on
  6 of 7 prompts; the seventh diverges into equally coherent wording (batched verify changes the arithmetic).
- **`fast` is the quickest layout (78.3 tok/s, 2.0×), at a measured cost of KLD 0.0001.** The BF16 head is 26% of
  the bytes read per token and MTP's draft step reads it again. A local copy with only the head converted to Q8_0
  (48 s on the CPU, every other tensor byte-identical) lifts plain decode 12% and MTP 18–26%, and frees 0.9 GB, which
  buys a 128k window with MTP. It is a profile, not the default, because it changes the published file.
- **The price is prefill.** MTP costs ~6% of prompt speed (1,681 vs 1,787 tok/s at 8k). `nospec` keeps it
  (1,767) with a 128k window; `long` reaches 192k (q4_0 K/V). The full 262k window does not fit with the BF16 head.
- **Uncensored as claimed.** The refusal probe answered 20 of 20 with thinking off (every answer read). There is no
  base Qwen3.5-9B file on disk, so there is no base comparison here.

## Baseline vs tuned vs ceiling (single user)

| Metric | Stock (`llama-server -m … --jinja`) | **default** (MTP n=2, 64k f16) | fast (Q8_0 head, MTP, 128k q8_0) | Ceiling (default / fast) | How measured |
|---|---:|---:|---:|---:|---|
| Decode, empty context, thinking off | 39.40 | **64.32** (accept 0.85) | 78.34 | 71.7 / 90.4 at the measured acceptance | median of 6 × 256 |
| Decode, empty context, thinking on | 39.41 | **61.51** (accept 0.79) | 78.08 | – | median of 6 × 512 |
| Decode deep in the window | 31.47 (63k) | **49.93** (60k) | 38.20 (120k) | 55.6 at 60k (MTP, f16) | median of 6 × 256 |
| Prefill 8k / 32k | 1,787 / 1,624 | 1,681 / 1,513 | 1,672 / 1,494 | 3,550 / 3,200 (51 TFLOPS line) | median of 2 cold |
| Prefill near the window | 1,438 (63k) | 1,350 (60k) | 1,074 (120k) | – | median of 2 cold |
| TTFT, prompt at ~95% of the window | 45.9 s (65.7k) | 46.1 s (61.8k) | 117.3 s (124.5k) | – | needle request |
| Needles ~50% / ~95% | 3/3 / 3/3 | 3/3 / 3/3 | 3/3 / 3/3 | – | 3 codes at 10/50/90% depth, temperature 0 |
| codeeval (8 tasks, temp 0, thinking on) | 5/8 | 5/8 | 6/8 | – | `../scripts/codeeval.py` |
| Card (incl. ~1 GB desktop) | 10.98 GB | 11.40 GB | 11.47 GB | 12.29 GB | nvidia-smi after the set |
| Startup (to listen line, warm page cache) | 1.45 s (8.3 s cold) | 1.11 s | 1.07 s | – | server log |

Stock is b08 (llama-server's own `--fit` picked 4 slots sharing 69,376 tokens of f16 K/V); default is b13; fast is
b07. Percent of ceiling: plain decode 39.4 = 90% of 43.8 (7.81 GB per token); default 64.3 = 90% of its MTP ceiling
at acceptance 0.85; fast 78.3 = 87% of 90.4; prefill 1,681 = 47% of the 51 TFLOPS line (97% of the 25 TFLOPS
practical guide).

### Other profiles

| `QH_PROFILE=` | Window, K/V | Decode d0 / deep | Prefill 8k / near | Needles | Card |
|---|---|---:|---:|---|---:|
| `nospec` | 128k q8_0 | 39.32 / 24.64 (120k) | 1,767 / 1,173 (120k) | 3/3 (65.9k), 3/3 (124.5k) | 11.37 GB |
| `long` | 192k q4_0 | 39.33 / 20.17 (180k) | 1,752 / 996 (180k) | 3/3 (98.5k), 3/3 (186.0k, TTFT 188.6 s) | 11.24 GB |
| default at 96k q8_0 (`QH_CTX=98304 QH_KV=q8_0`) | 96k q8_0 | 62.59 / 37.16 (90k) | 1,688 / 1,191 (90k) | 3/3 (48.7k), 3/3 (92.3k) | 11.53 GB |

Four slots: 4 × 24k (96k q8_0 unified) with MTP gave **149.2 tok/s aggregate** at 4 simultaneous requests vs 62.0
for one (b12), but at 11.84 GB on the card it leaves ~0.4 GB, so it is not a shipped profile. 4 × 32k without MTP
(128k q8_0) does not load.

## What was tried

| Lever | Result | Verdict |
|---|---|---|
| MTP n=2 (the file's own head) | +64% thinking off, +56% on (b01), reproduced in b04/b05 | **accepted** |
| MTP n=1 / n=3 | 55.9 / 60.3 vs n=2 64.5 | rejected |
| Q8_0 output head (local copy) | +12.4% plain, +18% / +26% with MTP, −920 MiB; KLD 0.0001 | **accepted as `fast`** (lossy, labelled) |
| f16 vs q8_0 K/V with MTP at 58k | 52.5 vs 44.7 / 43.4 (+19%); without MTP only +5% | **f16 for the default** |
| q8_0 / q4_0 K/V for windows | KLD 0.00036–0.0013 / 0.0026–0.0073 | q8_0 for `fast`/`nospec`, q4_0 only for `long` |
| ubatch 1024 | +2.7% prefill, decode equal, +234 MiB | rejected (VRAM goes to the window) |
| `-bs` backend sampling | inside noise | rejected |
| fa on / np 1 vs llama-server defaults | equal at empty context | defaults kept only for `stock` |
| 4 slots | 2.4× aggregate with MTP, 11.84 GB | not shipped |
| Windows | 256k needs the Q8_0 head (no MTP, q4_0); MTP's own draft context needs 512 MiB of K/V at 128k, so the published file + MTP stops at 96k q8_0 / 128k q4_0 | see profiles |

Speculation with n-gram drafts was not tried (no repeated-text workload in the measurement set).

## Quality

### KL divergence

There is no higher-precision copy of this model on disk, so the quantization's own error is not measured. What
was measured is what each lever changes against the published file at its own settings (`tools/kld.sh`,
`runs/kld/summary.txt`, llama-perplexity, 16 × 512-token chunks):

| Change | KLD wikitext-2 / code | Same top token | PPL ratio |
|---|---|---|---|
| Q8_0 output head | 0.000093 / 0.000038 | 99.36% / 99.76% | 1.0017 / 1.0002 |
| q8_0 K/V | 0.00036 / 0.0013 | 99.02% / 99.04% | 1.0031 / 1.0007 |
| q4_0 K/V | 0.0026 / 0.0073 | 97.48% / 97.43% | – |

For scale, the card reports KL divergence 0.079 between the Heretic model and the original Qwen3.5-9B.

### MTP and long answers

`tools/longans.py`: six prompts (three.js page, Python CLI with tests, a hard probability problem, a 1,500-word
story, a technical explainer, a TypeScript refactor), thinking on, card sampling, 10k cap, one sample each
(`runs/longans/`):

| | MTP n=2 (b02) | No speculation (b03) |
|---|---|---|
| Finished | 5/6 | 5/6 |
| Hit the cap | 1 (probability problem) | 1 (the same one) |
| Loops (zlib ratio < 0.1, repeated lines) | 0 (z 0.29–0.61) | 0 (z 0.18–0.58) |
| Decode | 45–62 tok/s (acceptance 0.46 prose – 0.82 code) | 38.6–39.2 tok/s |

The answers were read by hand: both three.js pages are complete; both stories have a title, scenes and an ending;
the MTP run's CLI left out the unittest class it was asked for, the no-spec run included it (one sample each, so
this is sampling, not a measured MTP effect). With a 24k cap (b10) the probability problem used all 24,000 tokens
in a coherent, non-repeating case enumeration; the model over-thinks that problem with or without MTP.

Greedy equivalence (`runs/greedy/`): MTP n=2 vs no spec 3/3 identical (thinking off, 200 tokens, b01) and 3/4
(thinking on, 600 tokens, b13; the fourth diverges after 1,946 characters into different, coherent wording).

### Coding, refusals, garbage

- codeeval: 5/8 stock, 5/8 default, 6/8 fast and 96k q8_0. The same two tasks fail everywhere (`lru`: a node class
  with `__slots__`; `topo`: wrong order); `parse_duration` passes or fails with the layout (temperature-0 near-ties).
  Every answer had a fenced block, so no bare-code rescoring was needed.
- Refusal probe (`../scripts/refusal_probe.py`, 20 prompts, temperature 0, b10): thinking off, 400 tokens:
  **answered 20/20, refused 0**; each answer read and each does what was asked. Thinking on, 3,000 tokens: 17
  answered, 0 refused, 3 empty (the reasoning was still running at the cap on the pirate insult, the dark joke and the
  swearing prompt). No base comparison: no base Qwen3.5-9B file on disk.
- No garbage: zlib ratios 0.27–0.64 over 322 logged answers, no failed requests outside the load probes.

## Memory and startup

- Card: 11.40 GB (default), 11.47 GB (fast), 10.98 GB (stock), each including the desktop's ~1 GB. The mmap'd file
  sits in the page cache, so the gpu_run cgroup peak is 9.4–9.7 GB; `GPU_RUN_MEM=24G` leaves room.
- Startup to the listen line: 1.1 s with a warm page cache, 8.3 s on the first cold load (b01).

## Unverified

- Quantization error against a BF16 or Q8_0 reference (none on disk; nothing downloaded).
- Refusals of the base model (no base file on disk).
- MTP on answers longer than 24k tokens, and more than one sample per long prompt.
- `fast` with f16 K/V (likely faster deep in the window, as in b11, at a smaller window); not measured.
- Vision (no mmproj downloaded; `--no-mmproj`).
- The card's reasoning-mode switches (`{REASON:…}`) were not tested.
