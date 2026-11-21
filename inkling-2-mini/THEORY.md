# Inkling-2-Mini on one RTX 3060: theoretical ceilings

Method from [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill) (`references/ceilings.md`): bytes read per token over measured bandwidth for decode; bytes moved per micro-batch over the PCIe rate, or FLOPs over practical tensor throughput, for prefill.

## Measured hardware (2026-11-20)

| What | Value | How |
|---|---|---|
| RAM read bandwidth | 25.9 GB/s (1 thread), 51.1 (4), **57.1 (6)**, 54.1 (8), 56.1 (12) | `../flint/tools/membw.c`, 2 GiB AVX2 sum, best of 5, idle host 17:32 (`runs/membw.txt`; an earlier run during a download gave 54.2) |
| VRAM bandwidth | 342 GB/s | device copy, measured earlier on this card (`../qwen35-3d-coder/tools/gpubw.py`) |
| PCIe | Gen4 x16; flint saw ~14 GB/s host→GPU during prefill | `../flint/THEORY.md` |

## Model (from the IQ4_NL GGUF header, `runs/gguf-iq4nl.txt`)

- 24 physical layers, hidden 2304, 24 q heads / 8 KV heads × 128. 128 routed experts top-8, expert FFN 1152, no shared expert.
- Loop: layers 6–17 run 3 times (`loop.start 6, end 18, count 3`), so a token does **48 layer applications**.
- llama.cpp (#32694) makes 48 cache slots: slots 24–47 alias the physical weights of 6–17 (`layers[il] = layers[layer_phys(il)]`), and each pass is its own graph node. **Expert reads are not deduplicated across passes**: each pass does its own `mul_mat_id` and routes independently, so the 8 experts of each pass are read again.
- Attention: 20 sliding-window layers (1024) and 4 global layers (5, 11, 17, 23). Globals 11 and 17 sit in the core, so there are **8 global KV slots** and 40 SWA slots. Short conv state per slot (kernel 4).
- IQ4_NL tensor bytes: experts 14.71 GiB (layers 0–19 IQ4_NL, 547 MiB/layer = 4.27 MiB/expert; layers 20–23 Q8_0, 1033 MiB/layer = 8.07 MiB/expert); attention + loop controllers 0.75 GiB (Q8_0 + F32); LM head 0.46 GiB and token embeddings 0.46 GiB (Q8_0).

## Decode ceiling (single user)

Bytes per token, IQ4_NL:

| Part | Applications/token | Bytes/token |
|---|---:|---:|
| Experts, layers 0–5, 18–19 (IQ4_NL) | 8 × 8 experts | 0.287 GB |
| Experts, core 6–17 (IQ4_NL), 3 passes | 36 × 8 experts | **1.290 GB** (70% of expert bytes) |
| Experts, layers 20–23 (Q8_0) | 4 × 8 experts | 0.271 GB |
| Attention/norm/conv weights (~28.8 MB/layer app) + loop controllers (9.4 MB, passes 2–3) | 48 + 24 | ~1.61 GB |
| Router (F32), LM head (Q8_0) | | ~0.55 GB |
| KV at short context | | small |

Placement scenarios (CPU and GPU parts of each layer run one after the other, so times add):

| Placement | RAM bytes @ 57 GB/s | VRAM bytes @ 342 GB/s | Ceiling |
|---|---:|---:|---:|
| All experts in RAM (`-ot exps=CPU`, baseline) | 1.85 GB → 32.5 ms | 2.16 GB → 6.3 ms | **~26 tok/s** |
| Core experts (6–17, 6.41 GiB) on GPU, rest in RAM | 0.56 GB → 9.8 ms | 3.45 GB → 10.1 ms | **~50 tok/s** |
| Everything on GPU (needs ~16.5 GiB, does not fit) | 0 | 4.0 GB → 11.8 ms | ~85 tok/s |

So putting the looped core's experts on the GPU first is worth ~2× by itself: every byte there is read 3 times per token.

VRAM budget for "core on GPU": 1.24 GiB dense + 6.41 GiB core experts + KV + SWA + compute buffers ≈ 8 GiB + KV.

Measured compute buffers (PLAN #1, #4):
- ~6.7 GB of op-offload staging when every expert is in RAM, ~0.9 GB with the core on the GPU;
- plus the per-head relative-bias mask, 190 B × n_kv × ubatch on master (~145 B with the F16 patch).

That, not the weights, sets the context and ubatch limits.

## KV cache

- Global slots: 8 × 2 (K,V) × 8 heads × 128 × 2 B (f16) = **32 KiB/token** → 2 GiB at 64k, 4 GiB at 128k. q8_0 halves it (~1.06 GiB at 64k, 2.1 GiB at 128k).
- SWA slots: 40 × (1024 + ubatch) × 4 KiB → 0.24 GiB at ub 512, 0.8 GiB at ub 4096.
- Fit at 64k f16 with the core on GPU: ~8 + 2 + 0.3 = ~10.3 GiB plus compute buffers: tight on a 12 GiB card shared with a desktop.

## Prefill ceiling

- Compute: ~5.4 B effective active params → ~10.8 GFLOP/token + attention. At ~25 TFLOP/s practical on the 3060 that is ~2,300 tok/s.
- Transfer: with experts in RAM llama.cpp copies each CPU expert tensor to the GPU per micro-batch, **per graph node**, so the core layers' experts are copied 3 times per ubatch. All experts in RAM: 44 × 547 MiB + 4 × 1033 MiB ≈ 28 GiB per ubatch → ~2.1 s at 14 GB/s → ~1,900 tok/s at ub 4096, ~240 tok/s at ub 512. Core on GPU: 8 × 547 + 4 × 1033 ≈ 8.4 GiB → 0.64 s per ubatch → compute bound at ub ≥ 2048.
