# Inkling-2-Mini results

- GPU: RTX 3060 12 GB (sm_86), driver 615.78.08, 342 GB/s measured VRAM bandwidth. CPU: i5-12500. RAM: 62 GiB, **57.1 GB/s** measured read bandwidth at 6 threads.
- Model: thinkingmachines/Inkling-2-Mini (@1fb4134b). 26.4B-parameter MoE with 128 experts (8 active) and 24 layers, of which layers 6–17 form a loop core that runs 3 times per token, so a token does 48 layer applications. It also takes image input.
- Weights: ggml-org/Inkling-2-Mini-GGUF @ db61c5b4 (IQ4_NL, Q8_0, mmproj). Plus our own repack, `Inkling-2-Mini-NVFP4.gguf`, which carries the checkpoint's own NVFP4 experts.
- Runtime: llama.cpp master 29b52d398 (the Inkling 2 Mini merge), CUDA 12.9. The tuned config runs on the `inkfix` branch on top of it: two small patches, see [Engine patches](#engine-patches).
- Measured 2026-11-20. The experiment log is `PLAN.md`, the ceilings are in `THEORY.md`, and the raw data is in `runs/` (server runs in `runs/ledger.jsonl`, llama-bench runs in `runs/bench-*.jsonl`).

## Verdict

- **Ships: `serve.sh`, IQ4_NL with the loop-core experts (layers 6–17) on the GPU and the rest in RAM, 64k context. It decodes at 29.0 tok/s, 1.66× the experts-in-RAM baseline (17.5). Prefill is 145 tok/s at 8k (baseline 39).** It finds 3 of 3 needles at 32k and at 62k, and uses 10.6 GB of VRAM.
- **The biggest lever is the loop.** Each core-layer expert is read three times per token, so the 6.4 GiB of core experts carry 70% of the expert bytes per token. Putting exactly those on the GPU gives +68% decode on its own.
- **The memory is not in the weights.** Two things in the compute buffer decide what fits:
  - Op-offload staging takes ~6.7 GB when all experts are in RAM.
  - The per-head relative-position bias mask grows as 190 B × context × ubatch.

  The brief's baseline (64k, ub 512) cannot even load on 12 GB. 64k with the core on the GPU needs q8_0 KV and ub 128.
- **Stock master has a correctness bug with this model: any batch of ≥ 32 tokens that runs a loop-core layer whose experts sit in RAM comes out NaN, as long as op offload is on (the default).** Every placement that keeps the core in RAM is affected, including `-ot exps=CPU`. So are image prompts, which come back as "????". The shipped config keeps the core on the GPU and is not affected. The baseline numbers above use `--no-op-offload`.
- **NVFP4 repack: about 3× closer to Q8_0 than IQ4_NL (KLD 0.0029 vs 0.0085 on wikitext), 7% slower.** It is shipped as an option (`INK_QUANT=nvfp4`), not the default. Both pass 8 of 8 in the coding eval.
- **unsloth's UD-IQ3_XXS and UD-Q3_K_XL do not load on master.** They are a pre-merge conversion with the loop unrolled to 48 blocks.

## Baseline vs tuned (single user, 64k context)

Server numbers come from llama-server's own timings (`tools/srvtest.py`). Each row is the median of 3. Decode is a capped coding answer (reasoning_effort low, 512 tokens max) after D tokens of code context. Prefill is a cold, unique code prompt.

| | Baseline: stock master, every expert in RAM | **Tuned: `serve.sh`** | Ceiling (THEORY.md) |
|---|---:|---:|---:|
| Decode, empty context | 17.5 tok/s | **29.0 tok/s (1.66×)** | ~26 / **~50** |
| Decode at 32k | | 23.7 tok/s | |
| Decode at 62k (needle run) | | 20.2 tok/s | |
| Prefill, 8k prompt | 39.1 tok/s (205 s) | **144.6 tok/s (55 s)** | |
| Prefill, 32k prompt | | 123.3 tok/s (260 s) | |
| Needles at 32k / 62k | | 3/3, 3/3 | |
| VRAM on the card (incl. ~0.9 GB desktop) | 11.2 GB | 11.5 GB | |
| KV cache | f16 | q8_0 | |

The baseline is the brief's command, `-ot exps=CPU` on stock master, with two changes it needs to run:
- `--no-op-offload`, or every prompt over 32 tokens comes out NaN;
- `-ub 512` without op offload, or 64k does not fit.

Its llama-bench decode is 17.67 tok/s, 68% of the ~26 tok/s ceiling for that placement. The tuned decode is 58% of the ~50 tok/s ceiling for its placement.

llama-bench (tg64 ×6 / pp2048, empty context) agrees: 29.07–29.45 tok/s decode and 174–175 tok/s prefill for the tuned flags.

### 128k

128k is a stretch target and fits only by giving some of the core back to RAM:
- layers 16–17 in RAM (10 of the 12 core layers stay on the GPU);
- ub 64;
- `--no-op-offload`, because a core layer in RAM with op offload on gives NaN.

VRAM: model 6.7 GB + KV 2.2 GB + compute 1.2 GB = 10.2 GB.

`INK_PROFILE=128k ./serve.sh`, measured the same way (median of 2 for prefill and decode, `runs/server-ctx128k-core10-nopo.log`):

| | 128k profile |
|---|---:|
| Decode, empty context | 26.1 tok/s |
| Decode at 64k / 124k (needle runs) | 18.7 / 14.6 tok/s |
| Prefill, 8k prompt | 85.2 tok/s |
| Prefill, 64k / 124k prompt | 68.5 / 56.2 tok/s (124k takes 37 min) |
| Needles at 64k / 124k | **3/3, 3/3** |
| VRAM on the card | 11.3–11.6 GB |

Decode loses 10% at short context, because 2 core layers are read from RAM three times per token. Prefill loses ~40%, because without op offload the RAM layers' prefill runs on the CPU.

## What was tried

| # | Change | Result | Verdict |
|---|---|---|---|
| 1 | Find where the VRAM goes | 7.2–8.4 GB compute buffer at load. ~6.7 GB is op-offload staging of RAM experts; the rest is the per-head relative-bias mask (190 B × n_kv × ubatch) | explains every fit limit below |
| 2 | Baseline `-ot exps=CPU` | tg 17.67 (llama-bench) | baseline |
| 3 | Loop-core experts (6–17) on the GPU | tg **29.67** vs 17.61 / 17.60 | **accept, +68%** |
| 4 | Fit 64k with the core on the GPU | f16 KV: OOM. q8_0 KV, ub 128: 10.4 GB. ub 256: OOM | q8_0 KV, ub 128 |
| 5 | Op offload on with the core on the GPU | pp2048 175 vs 132 without; tg same | **accept, +33% prefill** |
| 6 | Threads 4–12 | t8 +0.8% (noise), t4/t12 worse | keep 6 |
| 7 | Check prefill output, not just speed | `exps=CPU` + op offload → NaN PPL; core on the GPU → 6.03 (nopo 6.01) | engine bug, see below |
| 8 | KLD vs Q8_0 | IQ4_NL 0.0085 / 0.0088; NVFP4 0.0029 / 0.0044 (wiki / code) | NVFP4 ~2–3× better |
| 9 | unsloth UD-IQ3_XXS / UD-Q3_K_XL | `check_tensor_dims: tensor 'blk.24.attn_q.weight' not found` | do not load |
| 10 | NVFP4 instead of IQ4_NL | tg 27.13 vs 29.07 / 29.02; pp 163 vs 175 | option, not default |
| 10b | NVFP4 only in the GPU core layers | tg 27.51 vs 29.45 | the loss is in the CUDA NVFP4 kernel on sm_86, not the CPU |
| — | F16 relative-bias mask (engine patch) | compute buffer at 64k: 1632 → 1248 MiB (ub 128), 6527 → 4991 (ub 512); PPL identical | **accept**: in the shipped build |
| — | MoE cache (`--moe-cache-mib`) | not run: with the core on the GPU at 64k only ~0.4 GB of the card is free | open; needs VRAM first |
| — | DSpark (PR #32218) | not run: the PR predates the loop merge (conflicts in 3 files), its taps need re-indexing per layer application, and it needs the DSpark GGUF | open |

## Engine patches

The `inkfix` build is master 29b52d398 plus branch `inkling-loop-scale-fix` (`/mnt/scratch/llama.cpp/src-inkfix`, commits 7c396f834, 4c836a8eb, 6aafbc7d2):

1. **Loop passes keep their expert scales.** The generic per-expert `.scale` pass ran after the loop aliasing, so passes 2–3 of the core lost the scales of NVFP4 experts. That breaks any GGUF with NVFP4 experts: our repack, and unsloth's down projections. The patch moves the aliasing to after the scale pass (`share_loop_layers()`). IQ4_NL and Q8_0 have no scales and are unaffected.
2. **F16 relative-bias mask.** Inkling has no RoPE. Every head gets an additive bias gathered from a table, so the attention mask is n_kv × n_tokens × 24 heads. Master builds it in F32, adds the causal mask in F32, then copies it to F16 for flash attention. The patch casts the gathered bias to F16 and adds the F16 mask directly. That cuts the buffer by 24%. The values are identical, because the mask only adds 0 or −inf (PPL bit-identical, `runs/nanprobe/summary.txt`).

   A first version that used `ggml_cpy` into a new tensor made the buffer *larger* (4198 MiB): the destination is a graph leaf, so every layer's mask stayed allocated. `ggml_cast` fixed that.

## The op-offload NaN

Repro: `llama-perplexity -m Inkling-2-Mini-IQ4_NL.gguf -ngl 99 -ot exps=CPU -fa on -c 512 -f wiki.test.raw` gives `[1]nan,[2]nan,[3]nan`. With `--no-op-offload` it gives 6.007 (`runs/nanprobe/`).

| Experts in RAM | Op offload | PPL (3 chunks) |
|---|---|---:|
| all | on | NaN |
| all | off | 6.007 |
| layers 0–5, 18–23 (core on the GPU) | on | 6.030 |
| layers 0–5, 18–23 | off | 6.013 |
| layers 0–17, 20–23 (18–19 on the GPU) | on | NaN |

Only the core layers trigger it. Their weights are shared by three graph nodes per token (`layers[il] = layers[layer_phys(il)]`), so the scheduler stages the same host tensor for several splits. The likely cause is a staged copy being reused after its slot in the compute buffer was recycled. Not fixed here. Decode (batch 1) never offloads, so every decode number is valid.

## Quality

### KL divergence vs Q8_0

`tools/kld.sh`: llama-perplexity, 24 × 512 tokens per text, all experts computed on the CPU (`--no-op-offload`, see above), against ggml-org's Q8_0. ggml-org measured that Q8_0 at 0.0030 from BF16.

| GGUF | Size | wikitext-2 KLD | same top token | code KLD | same top token | PPL wiki (Q8_0 7.358) |
|---|---:|---:|---:|---:|---:|---:|
| IQ4_NL (ggml-org, imatrix) | 17.6 GB | 0.0085 | 95.5% | 0.0088 | 97.5% | 7.367 |
| **NVFP4 (our repack)** | 17.6 GB | **0.0029** | **97.7%** | **0.0044** | **98.2%** | 7.344 |

The code text is 160 KB of CPython 3.14 stdlib source (`runs/data/kld-code.txt`).

The NVFP4 file holds the checkpoint's own 4-bit expert weights: the E2M1 nibbles and E4M3 block scales are copied bit-for-bit, plus a per-expert F32 scale. So its experts are the ones the model was trained to use. The remaining KLD comes from Q8_0's own rounding and from the non-expert weights, which both files keep at Q8_0. Dequantised against the Q8_0 GGUF, the worst tensor differs by 0.6% relative L2, which is Q8_0's rounding of the same values (`runs/repack-nvfp4.log`).

### Coding and chat

- `tools/codeeval.py`: 8 Python tasks, each answer run against asserts. Temperature 0, reasoning_effort low, at most 2048 tokens. **IQ4_NL 8/8, NVFP4 8/8**, all finished on their own (`runs/codeeval-*.json`).
- `tools/smoke.py --image`, both quants: chat, arithmetic (17 × 23 = 391), a code answer, and one image. The image is described correctly: "A vertical red and blue split background with a white square centered across the dividing line."
- No reasoning loops in any capped server request: srvtest's loop score was 0.0 on every tuned answer.

## Stock master vs the patches

Tuned flags (`serve.sh` defaults, IQ4_NL) on **unpatched master 29b52d398** (`INK_BIN=/mnt/scratch/llama.cpp/master-29b52d398/bin`), measured 2026-11-20:

| Context | Result on stock master | Same flags on inkfix |
|---|---|---|
| llama-bench (empty) | tg 29.40, pp2048 175.3 (`runs/bench-b02-core-q8kv-ub128.jsonl`) | tg 29.07 / 29.45, pp2048 174.6 |
| 32k server | decode 29.07 / 28.98 / 29.05; 29.6k-token prompt: prefill 121.4, decode 23.68 (`runs/server-stock-master-32k.log`) | decode 29.0; 23.7 at 32k |
| 64k server | loads, then **CUDA OOM on the first request** (`cudaGraphInstantiate`, `runs/server-stock-master-64k.log`), with ~0.95 GB held by the desktop | runs; needles 3/3 at 62k |

So the speed comes from flags alone. The F16-mask patch (commits 4c836a8eb + 6aafbc7d2, `patches/0002`, `0003`) is only what makes 64k fit on this 12 GB card. The loop-scale patch (7c396f834, `patches/0001`) only matters for NVFP4 GGUFs; IQ4_NL does not need it.
