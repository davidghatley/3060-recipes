# nemotron-bolt-e4b: theoretical ceilings

Decode is bandwidth bound: bytes read per emitted token over measured GPU bandwidth. Prefill is compute bound:
FLOPs per token over practical tensor throughput. Inputs from `runs/params.txt` (`tools/params.py` on the GGUF header).

| Input | Value | Source |
|---|---|---|
| GPU bandwidth | ~342 GB/s measured (device copy) | `notes/trending-batch-1-brief.md` |
| FP16 tensor throughput | ~51 TFLOPS dense (spec sheet, not measured here); 50% practical = 25 TFLOPS | as in `../sensenova-loop-9b/THEORY.md` |
| Micron NVMe read | ~1.3–1.4 GB/s | local-llm-box facts |

## The model, as llama.cpp runs it
- Gemma-4-E4B layout: 42 layers, hidden 2560, FFN 10240 (dense, no experts). 35 sliding-window layers (window 512,
  head dim 256) and 7 global layers (5, 11, …, 41; head dim 512). 8 query heads, 2 K/V heads.
- Layers 24–41 store no K/V of their own: they attend over the K/V of an earlier layer (`shared_kv_layers = 18`).
  Only global layers 5, 11, 17, 23 store full-length K/V; all 7 global layers *read* it.
- Per-layer input embeddings: a 2.99 GB Q8_0 lookup table (`per_layer_token_embd`, 11.4 KB per token) plus a small
  BF16 projection. A lookup reads one row per token, so the table costs RAM, not bandwidth. llama.cpp keeps input
  embeddings on the CPU side; this is the "4 GB" in the model's name (the matmul weights are ~3.1 GB).
- LM head is tied to `token_embd` (262,144 × 2560, Q8_0, 0.713 GB) and is read every token.

## Decode ceiling (c1, no speculation)
Bytes per token at empty context: block matmuls 2.365 GB (K/V projections skipped on shared layers) + per-layer
projection 0.055 GB + LM head 0.713 GB = **3.133 GB** → 342 / 3.133 = **109 tok/s**. The LM head is 23% of it.

K/V read per token at depth d: 7 global layers × 2 heads × 512 × (K+V) = 28,672 B/token in f16 (sliding-window
layers add ~37 MB in total, constant).

| Depth | f16 K/V | q8_0 K/V | q4_0 K/V |
|---|---|---|---|
| 0 | 109 | 109 | 109 |
| 32k | 342 / (3.133 + 0.94) = **84** | 342 / 3.63 = 94 | 342 / 3.40 = 101 |
| 60k | 342 / (3.133 + 1.72) = **70** | 342 / 4.05 = 84 | 342 / 3.59 = 95 |

So quantized K/V is a real deep-context lever on this model (it is not on models whose K/V is a few % of the bytes).
It is lossy and has to be labelled.

## K/V memory
Stored K/V: 4 global layers × 4,096 B = 16 KB per token in f16 → **1.07 GB at 65,536 tokens** (0.57 GB q8_0).
Sliding-window layers: 20 own-KV layers × 2 KB × (512 + ubatch) per sequence, tens of MB. The 64k window therefore
fits several times over in 11 GB; parallel slots are cheap (each extra 64k slot +1.07 GB f16).

## Speculative decoding ceiling (DFlash drafter)
The card's drafter is a BF16 GGUF of 737 MB. One DFlash step drafts a block in one forward pass, then the target
verifies the block in one batched pass (memory bound, close to one decode step for small blocks). Bytes per step
≈ 3.133 + 0.737 = 3.87 GB → 11.3 ms → **88 steps/s; tok/s ceiling = 88 × (accepted tokens per step + 1)**. It wins
over plain decode once the mean accepted length is above ~0.25 tokens per step, on paper; in practice verify of n
tokens costs more than one decode step, and acceptance varies a lot by content (see `../qwen35-3d-coder/RESULTS.md`:
code 2×, reasoning slower with a generic drafter).

## Prefill ceiling
2 × 4.644 B = 9.29 GFLOP per token for matmuls. Global attention adds 4 × 8 heads × 512 × position per global layer
= 114,688 × position FLOP per token (sliding-window layers: ~0.15 GFLOP, constant).

| Prompt | avg position | GFLOP/token | at 25 TFLOPS |
|---|---|---|---|
| 8k | 4k | 9.8 | ~2,560 tok/s |
| 32k | 16k | 11.2 | ~2,240 tok/s |
| 60k | 30k | 12.7 | ~1,970 tok/s |

**Measured prefill beats this guide** (no drafter: 5,060 / 4,210 / 3,451 tok/s at 8k / 32k / 60k, PLAN b07): llama.cpp's
quantized matmuls (MMQ, int8 tensor cores) run well above 50% of the FP16 figure on a model this small. Against the
full FP16 spec peak (51 TFLOPS: 5,200 / 4,550 / 4,020 tok/s) those are 97% / 92% / 86%, and the int8 peak is about twice
that, so the real compute ceiling is above the measured rates and is not pinned down here (GEMM not measured).
Percentages in RESULTS.md use the 51 TFLOPS line and say so.

## TTFT and startup floors
TTFT ≈ prompt / prefill rate + one decode step (~10 ms). Startup: 6.18 GB from page cache (a few GB/s) → ~1–2 s,
from the Micron NVMe cold (~1.4 GB/s) → ~4.5 s, plus CUDA context and graph warm-up.
