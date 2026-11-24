# Qwen3.8-27B family on one RTX 3060: theoretical ceilings

Method from [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill)
(`references/ceilings.md`): bytes read per emitted token over measured bandwidth for decode; FLOPs over practical
tensor throughput for prefill.

## Measured hardware

| What | Value | Source |
|---|---|---|
| VRAM bandwidth | 342 GB/s | device copy, `../qwen35-3d-coder/RESULTS.md` |
| RAM read bandwidth | 57.1 GB/s at 6 threads | `../inkling-2-mini/THEORY.md` (`../flint/tools/membw.c`) |
| Card memory | 12,288 MiB, of which the desktop holds ~0.7–1.0 GB | `nvidia-smi` at each run (`runs/server-*.log`) |

## Model (from the GGUF headers, `runs/gguf-*.txt`)

- `qwen35` architecture: 64 decoder layers, hidden 5120, FFN 17408. Every 4th layer (3, 7, …, 63) is full attention
  (24 q heads, 4 KV heads × 256, q with an output gate); the other 48 are Gated DeltaNet (16 k heads / 48 v heads × 128,
  conv kernel 4). Layer 64 is the MTP (NextN) head; llama.cpp loads it only with `--spec-type draft-mtp`.
- 248,320-token vocabulary; untied: `output.weight` (Q5_K in pi's IQ3_XXS, 0.874 GB) and `token_embd`
  (looked up one row per token, kept on the CPU).
- pi IQ3_XXS (11.414 GB file): trunk weights read per token = 11.414 − 0.546 (token_embd) − 0.239 (MTP layer) =
  **10.63 GB**, of which 0.874 GB is the LM head. Per trunk layer: 156 MB (DeltaNet) or 141 MB (attention);
  the three FFN matrices are 102 MB of that.

## Memory per token of context

| | f16 | q8_0 | q4_0 |
|---|---:|---:|---:|
| K+V per token (16 attention layers × 2 × 4 × 256) | 64 KiB | 34 KiB | 18 KiB |
| 32k window | 2.15 GB | 1.14 GB | 0.60 GB |
| 64k | 4.29 GB | 2.28 GB | 1.21 GB |
| 128k | 8.59 GB | 4.56 GB | 2.42 GB |
| 262k | 17.2 GB | 9.13 GB | 4.83 GB |

DeltaNet state is fixed-size: 48 layers × 48 heads × 128 × 128 × 4 B = 151 MB, plus 6 MB of conv state, per sequence.

## VRAM budget

12,288 MiB card − ~900 MiB desktop − ~300 MiB CUDA context ≈ 11,100 MiB for weights, K/V, DeltaNet state and the
compute buffer. pi's trunk is 10,137 MiB, so with any useful window **some weights must live in RAM**: every GB of
weights in RAM costs 1/57 − 1/342 s ≈ 14.6 ms per token at full RAM bandwidth (more if the CPU kernels for IQ3_XXS
are compute-bound).

**Measured (PLAN #3): ~29 ms per GB in RAM**, twice the bandwidth figure: the CPU IQ3_XXS dot products run at
~31 GB/s on 6 threads, compute-bound, and `-t 12` does not help. Same cost per byte for FFN matrices, whole layers or
the LM head. Measured VRAM budget (PLAN #4): ~10.75–10.85 GB for weights + K/V + state + compute (desktop ~770 MiB
after `gpu_run --free`).

## Decode ceiling (single user, no speculation)

t(token) = (GPU bytes)/342 GB/s + (RAM bytes)/57 GB/s, with the CPU and GPU parts running one after the other.

| Placement | VRAM bytes | RAM bytes | ms/token | Ceiling |
|---|---:|---:|---:|---:|
| Everything on the GPU (does not fit with a window) | 10.78 GB | 0 | 31.5 | **31.7 tok/s** |
| 0.5 GB of FFN in RAM | 10.28 GB | 0.5 GB | 30.1 + 8.8 = 38.8 | 25.8 tok/s |
| 1.0 GB of FFN in RAM | 9.78 GB | 1.0 GB | 28.6 + 17.5 = 46.1 | 21.7 tok/s |
| 2.0 GB of FFN in RAM | 8.78 GB | 2.0 GB | 25.7 + 35.1 = 60.8 | 16.5 tok/s |

(VRAM bytes include 0.15 GB of DeltaNet state; K/V read at depth D adds D × 34 KiB at q8_0: +3.3 ms at 32k.)

## Speculative decoding ceiling

**Memory cost first (measured, PLAN #6):** llama.cpp keeps n+1 copies of the DeltaNet state so it can roll back
rejected drafts (RS 150 MiB → 449 MiB at n=2, 599 at n=3, 1,347 at n=8), and the MTP context adds its own K/V
(128 MiB) and compute buffer (130 MiB). On this card every 100 MiB of that pushes one more FFN layer (97.6 MiB) to
RAM, ~2.8 ms per token.

Verifying k drafted tokens reads the same weights once (bandwidth bound up to a few tokens), so speculation divides
the per-token cost of everything above, including the RAM part, by the mean accepted length plus one.

- **MTP (the file's own head):** one draft pass reads the MTP layer (0.239 GB) + the LM head (0.874 GB) = 1.11 GB
  ≈ 3.3 ms on the GPU. With n=2 and the acceptance the netprojects card reports on a Mac (72–76%), a step yields
  ~2.5 tokens for one verify (~1.05× a single token) + 2 drafts: at 1.0 GB in RAM, (46.1 × 1.05 + 6.6) / 2.5 ≈
  22 ms → **~45 tok/s**.
- **DFlash2 drafter** (`dflash-Qwen3.8-27B-Q4_0.gguf`, 1.08 GB, block of 8, from the kintsugi-27b recipe): one pass
  per block, ~3.2 ms on the GPU, but its 1.08 GB of VRAM pushes another ~1 GB of trunk weights to RAM (+14.6 ms per
  verify). Kintsugi measured 2.2–3.8× with it on its fork.

## Prefill ceiling

2 × 26.9 G active params ≈ 54 GFLOP per token. The 3060's dense FP16 tensor rate is ~51 TFLOPS (spec, not measured
here); at ~50% practical and with the dequantising MMQ kernels, ~470 tok/s at short context is a rough practical
ceiling. Weights kept in RAM are copied to the GPU once per ubatch: 1 GB at ~14 GB/s PCIe ≈ 70 ms per 512-token
ubatch (+~15% at 470 tok/s), which larger ubatches amortise.
