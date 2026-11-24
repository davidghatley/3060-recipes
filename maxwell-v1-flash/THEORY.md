# Maxwell-V1-Flash on one RTX 3060: theoretical ceilings

Method from [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill)
(`references/ceilings.md`): bytes read per token over measured bandwidth for decode; bytes moved per micro-batch over
the PCIe rate, or FLOPs over practical tensor throughput, for prefill.

## Measured hardware

| What | Value | Source |
|---|---|---|
| RAM read bandwidth | **57.1 GB/s** at 6 threads | `../inkling-2-mini/runs/membw.txt` (`../flint/tools/membw.c`) |
| VRAM bandwidth | **342 GB/s** | device copy, `../qwen35-3d-coder/tools/gpubw.py` |
| PCIe | Gen4 x16, ~14 GB/s host→GPU seen during prefill | `../flint/THEORY.md` |
| Usable VRAM | 12,288 MiB card minus ~0.95 GB held by the desktop | `nvidia-smi` |
| Per-layer GPU overhead | ~0.48 ms per MoE layer application on this engine family and card | `../inkling-2-mini/THEORY.md`, round 2 |

## Model (from the GGUF header, `runs/gguf-info-model.txt`)

- `maxwell-moe`, 45 blocks: 3 dense SwiGLU blocks (FFN 6144), then 42 blocks with 256 routed experts (top-12, expert FFN
  512, sigmoid routing with a selection bias) plus 1 shared expert (FFN 1024). Hidden 2048.
- Attention: 32 query heads, 4 KV heads, head dim 128, **dense in every one of the 45 layers** (the original is
  block-sparse; the port runs dense attention at every position, see README). No SWA, no MTP head in this file.
- mHC: 4 residual streams mixed by Sinkhorn-normalized 4×4 matrices (20 iterations) before attention and FFN; fused
  CUDA ops (`ggml_dsv4_hc_*`) in this build.
- Vocabulary 200,704; LM head and token embeddings Q8_0 (416.5 MiB each).
- AD-Q4_K-IQ4_XS tensor bytes: routed experts **17.06 GiB** (416 MiB per MoE layer: gate/up IQ4_XS, down Q4_K,
  1.63 MiB per expert); everything else 2.29 GiB (Q8_0, the mHC matrices and router F32, the unused block-sparse
  indexer BF16 110 MiB).

## Decode ceiling (single user)

Bytes read per token:

| Part | Bytes/token |
|---|---:|
| Routed experts: 42 layers × 12/256 × 436.2 MB | **0.859 GB** (20.45 MB per layer) |
| Attention Q/K/V/O (Q8_0), 45 layers | 0.902 GB |
| Shared experts (42) + dense FFNs (3), Q8_0 | 0.401 GB |
| Router (F32) + mHC matrices (F32) | 0.159 GB |
| LM head (Q8_0) | 0.437 GB |
| Non-expert total (token embedding is a row lookup; the indexer is not run) | **1.90 GB** |
| KV read at depth d, q8_0: 45 × 2 × 4 × 128 × 1.0625 B = **48,960 B/token of context** | 1.60 GB at 32k |
| same with f16 KV: 92,160 B/token | 3.02 GB at 32k |

Placement scenarios (the RAM and GPU parts of each layer run one after the other, so times add):

| Placement | RAM bytes @ 57.1 GB/s | VRAM bytes @ 342 GB/s | Ceiling, empty context | at 32k (q8_0 KV) |
|---|---:|---:|---:|---:|
| Every routed expert in RAM (`--cpu-moe`) | 0.859 GB → 15.0 ms | 1.90 GB → 5.6 ms | **48.5 tok/s** | 39.4 tok/s |
| MoE layers 3–32 in RAM, 33–44 on GPU (`--n-cpu-moe 33`, 12 layers, 4.9 GiB: what fits at 64k) | 0.614 GB → 10.8 ms | 2.15 GB → 6.3 ms | **58.7 tok/s** | 46.1 tok/s |
| Everything on the GPU (needs ~19.3 GiB + KV, does not fit) | 0 | 2.76 GB → 8.1 ms | 124 tok/s | 77 tok/s |

Engine overhead: on this engine and card a MoE layer application costs ~0.48 ms on the GPU whatever its expert size
(Inkling round 2). Maxwell has 45 layers, each with two mHC mixes (Sinkhorn 20 iterations, fused), so the
overhead alone is in the order of 45 × 0.48 ≈ 22 ms per token, which would make the GPU part overhead-bound, not
bandwidth-bound. The practical ceiling is therefore re-derived from measurement (below) once the first runs exist.

## VRAM budget (64k window)

| Item | MiB |
|---|---:|
| Non-expert weights on the GPU (all but token_embd) | ~1,800 |
| KV, 64k, q8_0 (3.21 GB) | ~3,060 |
| KV, 64k, f16 | ~5,760 |
| Compute buffer + CUDA context | ~1,000–2,000 (grows with ubatch) |
| Left for routed experts (q8_0 KV) | ~4,500–5,500 → **11–13 MoE layers** at 416 MiB, or the same as MoE-cache space |

So the window is the main trade: each 64k of q8_0 context costs ~7 layers of experts on the GPU. 128k with q8_0 KV
(6.1 GiB) leaves room for about 4 layers.

## Prefill ceiling

- Compute: ~3B active params → ~6 GFLOP/token, plus dense attention at 4 × 45 × 4096 × position FLOPs (~6 GFLOP/token
  on average over a 32k prompt). At ~25 TFLOP/s practical on the 3060: ~4,000 tok/s at short context, ~2,000 over a
  32k prompt.
- Transfer: with op offload on, llama.cpp copies each RAM-resident expert tensor to the GPU once per micro-batch:
  30 layers × 416 MiB = 12.2 GiB per ubatch at ~14 GB/s = 0.94 s. That caps prefill at **~550 tok/s at ub 512**,
  ~2,200 at ub 2048, ~4,400 at ub 4096. So ubatch is the main prefill lever, bounded by its compute buffer in VRAM
  (Flint, a similar 256-expert model: 4.1× prefill from ub 512 → 4096, `../flint/RESULTS.md`).

## Startup floor

20.8 GB of weights from the page cache (a few seconds) or the Micron NVMe (~3 GB/s → ~7 s), plus CUDA init.

## Practical ceiling, from measurement

`runs/bench/lb01-ncmoe-sweep.log` (llama-bench tg128, q8_0 KV, empty context) for 42, 36, 30, 27, 24 and 21 MoE layers'
experts in RAM: 34.2, 37.2, 40.7, 42.2, 44.6 and 46.7 tok/s. Time per token fits a line almost exactly:

- **0.372 ms per MoE layer read from RAM.** Bandwidth predicts 20.45 MB / 57.1 GB/s = 0.358 ms, and the same layer on the
  GPU costs 0.06 ms, so moving one layer to RAM should cost 0.30 ms. The measured cost is close to that, so the RAM
  expert path runs at about its bandwidth.
- **13.5 ms fixed** (the intercept): everything that is not a RAM expert read. Bandwidth predicts 8.1 ms for the all-GPU
  bytes, so the GPU part runs at ~60% of VRAM bandwidth. That is the 45 layers × (attention + two mHC mixes + MoE
  dispatch) overhead the section above expected.

| Placement | Bandwidth ceiling | **Practical ceiling** (13.5 ms + 0.372 ms × RAM layers) | Measured |
|---|---:|---:|---:|
| `--n-cpu-moe 33` (30 RAM layers) | 58.7 | **40.5** | 39.5–39.8 (server), 40.7 (bench) |
| `--cpu-moe` (42 RAM layers), no cache | 48.5 | **34.3** | 34.2 (bench) |
| All on the GPU (does not fit) | 124 | **73.9** | – |

The MoE cache lets the RAM layout go past its static ceiling: a cache hit reads the expert from VRAM. The practical
ceiling with a cache is the all-GPU 73.9 tok/s (100% hits). Any measured speed can be turned into "RAM-layer
equivalents" with the same line: (1000 / tok/s − 13.5) / 0.372.

## KV type at depth (measured, not predicted)

`runs/bench/lb02-kv-q8-depth32k.log`, `lb03-kv-f16-depth32k.log` (ncmoe 36, ub 1024, tg64 after 32,768 tokens):
**q8_0 KV 18.9 tok/s, f16 KV 29.1 tok/s.** Against the ~38.5 tok/s this split gives at empty context, f16 adds 8.4 ms per
token at 32k, about its bandwidth cost (3.02 GB / 342 GB/s = 8.8 ms). q8_0 adds 26.9 ms where its bandwidth cost is
4.7 ms: the q8_0 flash-attention decode path on this card and engine is about 6× slower than its byte count. So q8_0
KV saves VRAM (for the MoE cache) but costs a lot deep in the window. The serve default has to pick between those.

Cache hit shares implied by the line above (empty context, server medians): 4800 MiB (2,945 experts of 10,752, 27%)
at 55.0 tok/s → 12.5 RAM-layer equivalents of 42, so **~70% of expert reads hit**; 1900 MiB (1,165 experts, 11%) with
f16 KV at 47.4 tok/s → 20.3 of 42, **~52% hit**. Routing on code is skewed enough that a tenth of the experts takes
half of the picks. These are estimates from the fit, not counters read from the engine.
