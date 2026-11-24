# SenseNova-Loop-9B on one RTX 3060: theoretical ceilings

Method from [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill)
(`references/ceilings.md`): bytes read per emitted token over measured bandwidth for decode; FLOPs over practical
tensor throughput for prefill.

## Measured hardware

| What | Value | Source |
|---|---|---|
| VRAM bandwidth | 342 GB/s | device copy, `../qwen35-3d-coder/RESULTS.md` |
| RAM read bandwidth | 57.1 GB/s at 6 threads | `../inkling-2-mini/THEORY.md` |
| Card memory | 12,288 MiB, of which the desktop holds ~0.7–1.0 GB | `nvidia-smi` at each run |
| FP16 tensor throughput | ~51 TFLOPS dense (spec sheet, not measured here); 50% practical = 25 TFLOPS | as in `../qwen38-27b-family/THEORY.md` |

## Model (from the GGUF headers: `runs/gguf-info.txt`, `runs/params.txt`)

- `sensenova_loop` architecture (llama.cpp PR #32588). 32 physical decoder layers, hidden 4096, FFN 12288. Layers
  4–27 run twice with the same weights (`loop.start 4`, `loop.end 28`, `loop.count 2`), so a forward pass makes
  **56 layer passes**. The GGUF stores the unrolled plan: `block_count` 56 (57 with the MTP layer); the tail layers
  are named `blk.52`–`blk.55`.
- Hybrid attention: 3 linear-attention (Gated DeltaNet, as in Qwen3.5) layers to 1 full-attention layer
  (16 q heads, 4 KV heads × 256). Per pass: 42 DeltaNet visits, 14 full-attention visits on 8 physical layers.
- Two-stream mHC inside the loop block (Sinkhorn routing, 20 iterations, F32 router weights, 12 MB in all).
- Vocabulary 248,320; untied `output.weight` (Q6_K, 0.834 GB) and `token_embd` (looked up per token, not read whole).
- Official Q5_K_M: 6.658 GB; includes the MTP (NextN) layer `blk.56` (168 MB), loaded only with `--spec-type draft-mtp`.
- satellitedown abliterated `-upstream-` Q6_K: 7.368 GB; no MTP layer; `ssm_alpha`/`ssm_beta` kept BF16; `attn_qkv`
  and `attn_gate` stored as separate tensors (the official file fuses them as `attn_qkv_gate`).
- Matmul parameters per forward pass: 6.92 B physical trunk + 5.19 B loop block read a second time + 1.02 B LM head =
  **13.13 B** (the card's "about 14.6 B inference-equivalent" counts the embedding too) → **26.3 GFLOP per token**.

## Bytes read per decoded token (everything on the GPU)

| File | Trunk once | Loop block again | LM head | Per token | Decode ceiling at 342 GB/s |
|---|---:|---:|---:|---:|---:|
| Q5_K_M (official) | 4.96 GB | 3.69 GB | 0.83 GB | **9.49 GB** | **36.0 tok/s** |
| Q6_K abliterated | 5.70 GB | 4.28 GB | 0.83 GB | **10.81 GB** | **31.6 tok/s** |

The loop block's 3.7 GB is read twice: the GPU's 3 MB L2 cannot hold any of it between the passes, so looping costs
the full bandwidth. For comparison, at one loop (not how the model was trained, see below) the Q5_K_M would read
5.79 GB → 59 tok/s; at three loops 13.2 GB → 25.9 tok/s.

Context adds K/V reads: 8 cache layers (see below) × 2 × 4 × 256 × 2 B = 32 KiB per token at f16, but each cache
layer is read on both loop visits, so 14 reads: 56 KiB of reads per token of depth → +1.8 GB per token at 32k
(+5.4 ms, ceiling 24.8 tok/s at 32k f16; 30.4 tok/s at q8_0).

## Memory per token of context

The PR's last commit (`0ba8e4adf`, "reduce SenseNova Loop KV memory by sharing full-attention caches across
loops") gives the second visit of a full-attention layer the same K/V cache as its first visit, so only the 8
physical full-attention layers hold K/V:

| | f16 | q8_0 | q4_0 |
|---|---:|---:|---:|
| K+V per token (8 layers × 2 × 4 × 256) | 32 KiB | 17 KiB | 9 KiB |
| 32k | 1.07 GB | 0.57 GB | 0.30 GB |
| 128k | 4.29 GB | 2.28 GB | 1.21 GB |
| 256k | 8.59 GB | 4.56 GB | 2.42 GB |
| 512k (native) | 17.2 GB | 9.13 GB | 4.83 GB |

DeltaNet state is fixed per sequence: 42 visits × 32 heads × 128 × 128 × 4 B ≈ 88 MB (+ conv state).

## VRAM budget

12,288 MiB − ~900 MiB desktop − ~300 MiB CUDA context ≈ 11,100 MiB for weights, K/V, state and compute buffer.
GPU weights (token_embd stays in RAM): Q5_K_M ≈ 5.96 GB, Q6_K ≈ 6.53 GB. That leaves ~5 GB (Q5_K_M) or ~4.4 GB
(Q6_K) for K/V + compute: f16 K/V reaches ~128k, q8_0 ~256k, q4_0 the native 512k on paper (the compute buffer
grows with the window under flash attention, so the real limits are measured in PLAN.md).

## Prefill ceiling

26.3 GFLOP per token + attention (4 × 14 visits × 4096 × position: +3.8 GFLOP per token on average over a 32k
prompt, +15 GFLOP over 128k). At 25 TFLOPS practical: **~950 tok/s** at short context, ~840 tok/s averaged over a
32k prompt, ~600 tok/s over 128k. (llama.cpp's MMQ kernels use int8 tensor cores for K-quants, so the FP16 figure is
a conservative bound; the DeltaNet scan and the mHC Sinkhorn steps are not matmuls and are not counted.)

## Speculative decoding ceiling

Verifying k drafted tokens reads the same 9.49 GB once if the step stays bandwidth bound. The MTP head's own pass
reads the MTP layer (0.17 GB) + the LM head (0.83 GB) ≈ 1.0 GB ≈ 2.9 ms. With n=2 drafts and acceptance a, a step
yields 1 + a + a² tokens for one verify (~27.7 ms if bandwidth bound, more if the 3-token pass is not) + 2 drafts
(5.8 ms): at a = 0.8, 2.44 tokens / 33.5 ms ≈ **73 tok/s** upper bound. The qwen38 recipe measured that a 3-token
verify on master costs much more than 1× on that hybrid model (its DeltaNet state is copied per drafted token);
PLAN.md measures it here.

## Startup and TTFT floors

Weights from page cache at ~10 GB/s plus upload over PCIe 4.0 x16 (~20 GB/s practical, the card runs x16):
6.0 GB → ~0.5–1 s; from the Micron NVMe cold (~1.4 GB/s) ~5 s. TTFT for an N-token prompt ≈ N / prefill rate
(8k at 950 tok/s ≈ 8.6 s floor).
