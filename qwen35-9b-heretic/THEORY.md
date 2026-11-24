# Ceilings: Qwen3.5-9B Defiant Fable Heretic MTP Q6_K on one RTX 3060 12 GB

Decode is bandwidth bound: bytes read per emitted token over measured GPU bandwidth. Prefill is compute bound:
FLOPs per token over a practical fraction of peak. Header facts from `runs/gguf-info.txt` (`tools/gguf_info.py`).

| Input | Value | Source |
|---|---|---|
| GPU bandwidth | ~342 GB/s (measured on this card) | `../notes`, other recipes' THEORY.md |
| FP16 tensor throughput | ~51 TFLOPS dense (spec sheet, not measured here); 50% practical = 25 TFLOPS | as in `../sensenova-loop-9b/THEORY.md` |
| Layers | 32 + 1 MTP layer (blk.32, `nextn_predict_layers = 1`); 3 Gated DeltaNet : 1 full attention (full attention at 3, 7, …, 31) | gguf |
| Hidden / FFN / vocab | 4096 / 12288 / 248,320 | gguf |
| Attention | 16 query heads, 4 K/V heads, head dim 256 | gguf |
| Block weights (layers 0–31) | 5.672 GB, Q6_K | gguf |
| Output head (`output.weight`) | **2.034 GB, BF16** (the "MAX" part of the quant: the card keeps the output tensor at 16 bit) | gguf |
| MTP layer (blk.32: attention + FFN + eh_proj) | 0.200 GB, Q6_K | gguf |
| token_embd | 0.834 GB Q6_K; a lookup (one row per token), kept in host memory by llama.cpp | gguf |

## Decode ceiling (one sequence)

Bytes per emitted token without speculation: 5.672 (blocks) + 2.034 (head) + ~0.10 (24 GDN layers' recurrent state,
32 heads × 128 × 128 × f32 = 2.1 MB per layer, read and written) = **7.81 GB**, plus K/V at the working depth.

K/V bytes per token of context: 8 full-attention layers × 2 (K, V) × 4 heads × 256 × 2 B = **32 KiB (f16)**,
17.4 KiB (q8_0), 9.2 KiB (q4_0). The 24 GDN layers have no K/V.

| Depth | K/V read (f16 / q8_0) | Bytes per token | Ceiling tok/s (f16 / q8_0) |
|---|---|---|---|
| 0 | 0 | 7.81 GB | **43.8** |
| 32k | 1.07 / 0.57 GB | 8.88 / 8.38 | 38.5 / 40.8 |
| 60k | 2.01 / 1.07 GB | 9.82 / 8.88 | 34.8 / 38.5 |
| 120k | – / 2.14 GB | – / 9.95 | – / 34.4 |

The BF16 head is 26% of the bytes of every token. A Q8_0 head (1.08 GB) would lift the d0 ceiling to 342 / 6.86 =
49.9 (+14%); that is a lossy change to the published file and is a labelled experiment only (PLAN).

## MTP ceiling

llama.cpp's `draft-mtp` runs the MTP layer once per draft token; each draft pass reads blk.32 (0.200 GB) **and the
same 2.034 GB BF16 head** (the MTP layer has no head of its own), so one draft token costs ~2.23 GB, 29% of a full
step. The verify pass reads the full 7.81 GB once for n+1 tokens. With per-token acceptance `a` (assumed independent):

| Draft n | Bytes per step | Tokens per step | a = 0.5 | a = 0.7 | a = 0.85 |
|---|---|---|---|---|---|
| 1 | 10.04 GB | 1 + a | 51.1 | 57.9 | 63.0 |
| 2 | 12.27 GB | 1 + a + a² | 48.8 | 61.0 | 71.7 |
| 3 | 14.50 GB | 1 + a + a² + a³ | 44.2 | 59.7 | 75.2 |

(tok/s at d0, bytes only; kernel launch and sampling overheads come on top.) So MTP can at best be ~1.4–1.6× the
plain ceiling at realistic acceptance, and n=3 only pays above a ≈ 0.8. Per-step cost is dominated by the head;
a smaller head (Q8_0) would help MTP more than plain decode (n=2, a=0.7: 79.5 tok/s).

## Prefill ceiling

llama.cpp computes the output head only for the last prompt token, so prefill FLOPs per token are the block matmuls:
2 × 6.915 B params (5.672 GB / 0.820 B per Q6_K param) = 13.8 GFLOP, plus attention ≈ 4 × 8 layers × 4096 × position.

| Prompt | avg position | GFLOP/token | at 25 TFLOPS | at 51 TFLOPS |
|---|---|---|---|---|
| 8k | 4k | 14.4 | 1,740 | 3,550 |
| 32k | 16k | 15.9 | 1,570 | 3,200 |
| 120k | 60k | 21.7 | 1,150 | 2,350 |

Q6_K matmuls in llama.cpp run as int8 MMQ, whose peak is about twice the FP16 line, so measured prefill may beat the
25 TFLOPS guide. RESULTS.md reports percentages against the 51 TFLOPS line and says so.

## TTFT, startup, KV room

- TTFT ≈ prompt / prefill rate + one decode step (~25 ms).
- Startup: 8.75 GB from page cache (or ~1.4 GB/s from the Micron NVMe when cold, ~6 s) plus CUDA init and graph warm-up.
- VRAM: 12,288 MiB card, ~1 GB held by the desktop. GPU weights ≈ 7.9 GB (all but token_embd), compute buffer
  ~0.5–1 GB (the 248k-vocabulary logits at ubatch size). Left for K/V: ~2–2.5 GB, i.e. ~64k f16, ~128k q8_0 or
  ~256k q4_0 on paper, less whatever the MTP draft context needs. Measured limits are in PLAN.md.
