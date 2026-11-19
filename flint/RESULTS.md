# Flint benchmark results

- GPU: RTX 3060 12 GB (PCIe Gen4 x16), driver 610.57.04
- CPU: i5-12500 (6P/12T); RAM: 62 GiB, 57 GB/s measured read bandwidth
- Model: ggml-org/Flint-GGUF, Flint-Q4_K_M.gguf (23.4 GB; 49 layers, 256 experts top-6)
- Runtime: llama.cpp b12242, commit 3b4d6ab3f
- Measured 2026-11-18. Experiment log: `PLAN.md`. Ceilings: `THEORY.md`. Raw data: `runs/`.

## Old vs tuned server (128k context, single user)

The default `serve.sh` profile is now **128k + MoE cache**: every routed expert lives in RAM (`-ncmoe 49`), and the VRAM this frees holds a 2944 MiB cache of the hot ones (`--moe-cache-mib 2944 --moe-cache-cpu-share 0.95`). The first tuned profile (`-ncmoe 43`, no cache) is kept as `FLINT_PROFILE=nocache`. Evidence for the cache: `experiments/RESULTS.md`, experiment 5. Runs with ngram speculation on: `experiments/runs/phaseF*.log`.

| Metric | Old `serve.sh` | Tuned, no cache | **Tuned + MoE cache (default)** | Ceiling |
|---|---:|---:|---:|---:|
| Cold 11k-token prompt (opencode system prompt): prefill | 329 tok/s | 1,751 tok/s | **1,708 tok/s** (5.2×) | ~2,600 |
| ... time to first token | 33.4 s | 6.3 s | **6.4 s** | |
| 121k-token prompt: prefill | not measured | 1,003 tok/s | 989 tok/s | |
| Decode, prose | 48.2 tok/s | 51.9–52.0 | **58.8** (+22%) | ~76 |
| Decode, code task (mostly reasoning) | 46.7 | 50.0–51.5 | **55.0–55.8** | |
| Decode at 32k depth | 34.0 | 43.9 (f16 KV) | **46.8–47.2** | |
| Needle retrieval, 3 codes at 60k / 120k | not run | 3/3, 3/3 | **3/3, 3/3** | |
| VRAM after load and after a 121k request | 5.8 GB | 10.8 GB | 11.3 GiB (11,585 MiB) of 12 | |

Medians of 3–6 requests using llama-server's own timings, temperature 1.0 (needles at 0). The cache warms within ~256 tokens and stays warm across requests. KL divergence vs the all-GPU path is no worse than the plain CPU-expert path (experiment 5).

Other profiles: `FLINT_PROFILE=64k ./serve.sh` (5248 MiB cache, spec off) decodes 63.4 tok/s on prose and 60.9 on code. With ngram spec on, the 64k cache profile measured 58.2 / 58.4, so spec is off there. At 128k, spec on vs off is within noise (code 55.0 vs 55.8, prose 58.8 vs 58.3), so it stays on for the cases where output repeats context.

## What changed and why

| Flag | Gain | Evidence |
|---|---|---|
| `-b 4096 -ub 4096` | 4.1× prefill | Prefill copies the RAM-resident experts over PCIe once per micro-batch; bigger batches amortize it. |
| `--load-mode none` | +24% prefill | Weights read into RAM instead of mmap; host→GPU copies are faster. |
| `-ctk f16 -ctv f16` | +29% decode at 32k | q8_0 KV is slow on llama.cpp for models with few full-attention layers (Flint: 14 of 49). Costs ~1.5 GB more VRAM at 128k. |
| `-ncmoe 49 --moe-cache-mib 2944 --moe-cache-cpu-share 0.95` | +14% decode, −2.5% prefill | On code, the top quarter of experts takes ~58% of routing picks. The adaptive cache serves 45% of expert reads from VRAM (360 GB/s) instead of RAM (~46 GB/s effective). Replaces `-ncmoe 43` (+4%). cpu-share 1.0 freezes the cache and loses most of the gain. |
| `--spec-type ngram-map-k` | 0 to +43% decode | Only helps when output repeats context; never below the control in the clean test. |

Kept: `-t 6` (RAM bandwidth saturates at 6 threads), default `--poll`.

## Earlier runs (2026-11-14)

`runs/20261114-*.jsonl` and `runs/server-*.log`: 18 tok/s decode at an earlier baseline, 43 tok/s with `-ncmoe 47`, prefill ~230 tok/s on 10–11k opencode prompts.
