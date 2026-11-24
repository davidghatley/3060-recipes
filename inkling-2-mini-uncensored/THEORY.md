# Inkling-2-Mini uncensored: what changes in the ceilings

The model, the hardware and the ceilings are the base recipe's: [`../inkling-2-mini/THEORY.md`](../inkling-2-mini/THEORY.md)
(57.1 GB/s RAM at 6 threads, 342 GB/s VRAM, 48 layer applications per token, the loop core 6–17 read three times).
Its round-2 finding matters most here: with the core on the GPU the IQ4_NL layout takes **34.1 ms per token**, about
23 ms of per-layer GPU overhead (~0.48 ms per application, many small kernels) plus ~11 ms of RAM expert reads.
The practical ceiling for that layout is **~29 tok/s** and the base already sits on it. So an edit can only cost speed
here, and the question is how much. This file states only what each edit adds.

## nokeepai Unbound v2, rank-64 LoRA at runtime (`--lora`)

Tensor list from the adapter (`runs/lora-info-nokeepai.txt`): q, k, v, output and gate projections of all 24 layers,
F32, rank 64. Per layer 1.46 M adapter parameters (q, o, gate: 64 × (2304 + 3072); k, v: 64 × (2304 + 1024)), 5.8 MB.

| Added per token | Amount | Time at 342 GB/s |
|---|---:|---:|
| Adapter reads: 5.8 MB × 48 applications (the core's adapter is read on each pass, like its weights) | 0.28 GB | 0.82 ms |
| Extra graph nodes: per edited matmul llama.cpp adds `A·x`, `B·(A·x)`, scale, add = 4 nodes; 5 × 4 × 48 | 960 nodes | not bandwidth: at the base's measured ~0.48 ms per application (~25–30 nodes) that is ~15–20 µs per node, so **~15–19 ms** if each node costs what the base's do; ~2–4 ms if they cost a CUDA-graph launch only |

- Bandwidth-only ceiling: 34.1 + 0.8 ms → **28.6 tok/s** (−2.4%).
- If every added node costs what an average base node costs, 34.1 + ~17 ms → ~20 tok/s (−32%). The truth is between;
  the A/B in RESULTS.md measures it.
- Prefill: the adapter adds 2 × 64 × (in + out) FLOPs per token per edited matmul, ~0.2% of the dense attention FLOPs.
  No measurable change expected.
- VRAM: +140 MB of adapter on the GPU (the attention tensors are on the GPU in the base layout).
- **Merged instead of runtime**: `llama-export-lora` writes a merged tensor as F16 when the base tensor is quantized.
  The five attention projections are 25.95 M parameters per layer: Q8_0 27.6 MB → F16 51.9 MB, so +0.58 GB of VRAM
  (does not fit at 64k next to the 11.5 GB the base layout already uses) and +1.17 GB per token (+3.4 ms). Requantized
  back to Q8_0, a merged file has exactly the base's bytes and speed.

## AtomicChat, rank-1 LoRA at runtime

(`runs/lora-info-atomicchat.txt`) Edits `attn_output` and the routed experts' down projection of all 24 layers, plus
the token embedding. Rank 1, so the adapter bytes are negligible (0.04 GB file) and the cost is graph nodes only:
4 for `attn_output` and 4 for the expert down projection per application (`mul_mat_id` on A and B, scale, add), ~384
nodes per token. The expert half runs where the expert tensor lives: on the CPU for layers 0–5 and 18–23.

## AtomicChat baked AD-Q4_K (16.5 GB file)

Per-layer bytes and quant types: `runs/gguf-layers-ad-q4k.txt`. Every layer's experts are Q4_K gate/up + Q5_0 down,
587 MiB per layer (4.59 MiB per expert). ggml-org's IQ4_NL is 547 MiB per layer for 0–19 and Q8_0, 1033 MiB, for 20–23.

| | IQ4_NL (base) | AD-Q4_K |
|---|---:|---:|
| Core 6–17 experts on the GPU | 6.41 GiB | **6.88 GiB** (+0.47) |
| Experts left in RAM (0–5, 18–23) | 8 × 547 + 4 × 1033 MiB = 8.4 GiB | 12 × 587 MiB = **6.9 GiB** |
| RAM expert bytes read per token (8 of 128 experts × 12 applications) | 0.56 GB → 9.8 ms at 57.1 GB/s | **0.46 GB → 8.1 ms** |
| Per-token time if only the RAM read changes (base 34.1 ms) | 34.1 ms → 29.3 tok/s | 32.4 ms → **~30.9 tok/s** |
| RAM experts copied to the GPU per ubatch in prefill, at ~14 GB/s | 0.64 s | 0.53 s |
| Prefill ceiling from that copy alone at ub 64 / 96 / 128 | 100 / 150 / 200 tok/s | 121 / 181 / 241 tok/s |

- The extra 0.47 GiB on the card is what the base layout had as compute-buffer room: at ub 128 the 1.43 GiB compute
  buffer no longer fits. ub scales the buffer (mostly the per-head relative-bias mask, n_kv × ubatch × 24 heads), so
  ub 96 and ub 64 fit.
- Decode should be a little faster than base (fewer RAM bytes, no Q8_0 layers in RAM), prefill slower at a smaller
  ubatch. The measured numbers (29.6–29.7 decode, 112 at ub 64 and 137 at ub 96) follow that; prefill sits at 76–93%
  of the copy-only ceiling, as the base's 145 sits at 72% of its 200.
- Moving one more layer's experts to the GPU costs 587 MiB, which does not fit; moving one back to RAM (6–16 on the
  GPU) needs `--no-op-offload` against the NaN bug, and ub 128 with `--no-op-offload` ran out of VRAM on the first
  request even with the core placement (#7 in PLAN.md). Not tried further.
