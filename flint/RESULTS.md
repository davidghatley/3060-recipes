# Flint benchmark results

- GPU: RTX 3060 12 GB (PCIe Gen4 x16), driver 610.57.04
- CPU: i5-12500 (6P/12T); RAM: 62 GiB, 57 GB/s measured read bandwidth
- Model: ggml-org/Flint-GGUF, Flint-Q4_K_M.gguf (23.4 GB; 49 layers, 256 experts top-6)
- Runtime: llama.cpp b12242, commit 3b4d6ab3f
- Measured 2026-11-18. Experiment log: `PLAN.md`. Ceilings: `THEORY.md`. Raw data: `runs/`.

## Old vs tuned server (128k context, single user)

| Metric | Old `serve.sh` | Tuned `serve.sh` | Ceiling |
|---|---:|---:|---:|
| Cold 11k-token prompt (opencode system prompt): prefill | 329 tok/s | **1,751 tok/s** (5.3×) | ~2,600 |
| ... time to first token | 33.4 s | **6.3 s** | |
| 121k-token prompt: prefill | not measured | 1,003 tok/s (2 min) | |
| Decode, prose | 48.2 tok/s | **51.9–52.0** | ~69 |
| Decode, code task (mostly reasoning) | 46.7 | **50.0–51.5**; up to 72 when copying text | ~69 (no spec) |
| Decode at 32k depth (llama-bench) | 34.0 | **43.9** (f16 KV) | |
| Needle retrieval, 3 codes at 60k / 120k | not run | **3/3, 3/3** | |
| VRAM after load and after a 121k request | 5.8 GB | 10.8 GB of 12.3 | |

Medians of 3–6 requests using llama-server's own timings, temperature 1.0 (needles at 0).

## What changed and why

| Flag | Gain | Evidence |
|---|---|---|
| `-b 4096 -ub 4096` | 4.1× prefill | Prefill copies the RAM-resident experts over PCIe once per micro-batch; bigger batches amortize it. |
| `--load-mode none` | +24% prefill | Weights read into RAM instead of mmap; host→GPU copies are faster. |
| `-ctk f16 -ctv f16` | +29% decode at 32k | q8_0 KV is slow on llama.cpp for models with few full-attention layers (Flint: 13 of 49). Costs ~1.5 GB more VRAM at 128k. |
| `-ncmoe 43` (was 47) | +4% decode, +3% prefill | 4 layers of experts in the VRAM left over after 128k f16 KV. |
| `--spec-type ngram-map-k` | 0 to +43% decode | Only helps when output repeats context; never below the control in the clean test. |

Kept: `-t 6` (RAM bandwidth saturates at 6 threads), default `--poll`.

## Earlier runs (2026-11-14)

`runs/20261114-*.jsonl` and `runs/server-*.log`: 18 tok/s decode at an earlier baseline, 43 tok/s with `-ncmoe 47`, prefill ~230 tok/s on 10–11k opencode prompts.
