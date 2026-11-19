# Flint Q4_K_M on one RTX 3060: theoretical ceilings

Method from [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill) (`references/ceilings.md`): bytes per token over measured bandwidth for decode, and bytes moved per prefill chunk over measured PCIe rate for prefill (prefill here is transfer bound, not compute bound).

## Measured hardware (2026-11-18)

| What | Value | How |
|---|---|---|
| RAM read bandwidth | 25.6 GB/s (1 thread), 50.9 (4), **57.0 (6)**, 56.4 (12) | `tools/membw.c`, 2 GiB AVX2 sum, best of 5 |
| PCIe link under load | Gen4 x16 (Gen1 at idle is power saving) | `nvidia-smi` during a 16k prefill |
| Host→GPU traffic during prefill | ~14 GB/s peak (1 s averages) | `nvidia-smi dmon -s t`, `runs/bench-ub-big-dmon.txt` |
| GPU memory bandwidth | 360 GB/s spec; not measured (no nvcc on this box) | |

## Model (from the GGUF header)

- 49 layers: 2 dense FFN + 47 MoE. 256 routed experts, top-6, plus 2 shared experts. Hidden 2048, 32 query / 4 KV heads, head dim 128.
- Attention: 14 full-attention layers; the other 35 use a 513-token sliding window.
- Tensor bytes: routed experts 19.83 GiB (21.3 GB, Q4_K), shared experts 0.29 GiB (Q8_0), everything else 1.66 GiB.

## Decode ceiling (single user)

Per token, with `-ncmoe 43` (experts of 43 layers in RAM, 4 on the GPU):

| Part | Bytes / token | Where | Time |
|---|---:|---|---:|
| Routed experts, 43 layers: 21.3 GB × 6/256 × 43/47 | 0.457 GB | RAM @ 57 GB/s | 8.0 ms |
| Attention, shared experts, dense FFN, LM head, 4 GPU expert layers | ~2.1 GB | VRAM @ ~330 GB/s practical | ~6.4 ms |
| KV at short context | small | VRAM | — |

CPU and GPU parts run one after the other within each layer, so the times add: **~14.4 ms → ~69 tok/s ceiling**.
Measured: 52.0 tok/s prose, 50.6 code (≈75% of ceiling). With all experts in RAM (`-ncmoe 47`) the ceiling is ~66 tok/s.
Speculative decoding (ngram-map-k) raises the effective ceiling only for text that repeats the context.

## Prefill ceiling

With experts in RAM, llama.cpp copies each CPU-resident expert tensor to the GPU once per micro-batch (`-ub`) and runs the matmul there. Each chunk moves 21.3 GB × 43/47 = 19.5 GB:

| `-ub` | Copies for an 11k prompt | Transfer @ 14 GB/s | Ceiling |
|---:|---:|---:|---:|
| 512 | 22 | 30.6 s | ~360 tok/s (measured 329 server / 375 bench) |
| 4096 | 3 | 4.2 s | **~2,600 tok/s** (measured 1,742) |
| 8192 | 2 | 2.8 s | ~3,900 tok/s (does not fit next to 128k f16 KV) |

GPU compute is not the limit: the 3060 has ~50 TFLOPS of fp16 tensor throughput and Flint activates only a few billion parameters per token.

## KV cache

- Full-attention layers: 14 × 2 × 4 heads × 128 × 2 bytes = 28.7 KB/token in f16, so **3.5 GiB at 128k** (q8_0: ~1.9 GiB).
- Sliding-window layers hold only window + micro-batch tokens per layer.
- 262k (the model's native context) in f16 would need ~6.5 GiB, which only fits by moving all experts back to RAM and shrinking `-ub`.
