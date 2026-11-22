# Inkling-2-Mini results

- GPU: RTX 3060 12 GB (sm_86), driver 615.78.08, 342 GB/s measured VRAM bandwidth. CPU: i5-12500. RAM: 62 GiB, **57.1 GB/s** measured read bandwidth at 6 threads.
- Model: thinkingmachines/Inkling-2-Mini (@1fb4134b). 26.4B-parameter MoE with 128 experts (8 active) and 24 layers, of which layers 6–17 form a loop core that runs 3 times per token, so a token does 48 layer applications. It also takes image input.
- Weights: ggml-org/Inkling-2-Mini-GGUF @ db61c5b4 (IQ4_NL, Q8_0, mmproj). Plus our own repack, `Inkling-2-Mini-NVFP4.gguf`, which carries the checkpoint's own NVFP4 experts.
- Runtime: llama.cpp master **225a5345b** (build 12627) plus the two F16-mask patches in `patches/`, CUDA 12.9. Round 1 ran on 29b52d398 with three patches; see [Round 2](#round-2-2026-11-22-new-master-smaller-quants-the-128k-boundary) for what changed.
- Measured 2026-11-20 (round 1) and 2026-11-21/22 (round 2). Round-1 sections below are kept as measured, on the old build. The experiment log is `PLAN.md`, the ceilings are in `THEORY.md`, and the raw data is in `runs/` (server runs in `runs/ledger.jsonl`, llama-bench runs in `runs/bench-*.jsonl`).

## Verdict

- **Ships: `serve.sh`, IQ4_NL with the loop-core experts (layers 6–17) on the GPU and the rest in RAM, 64k context. It decodes at 29.0 tok/s, 1.66× the experts-in-RAM baseline (17.5). Prefill is 145 tok/s at 8k (baseline 39).** It finds 3 of 3 needles at 32k and at 62k, and uses 10.6 GB of VRAM.
- **The biggest lever is the loop.** Each core-layer expert is read three times per token, so the 6.4 GiB of core experts carry 70% of the expert bytes per token. Putting exactly those on the GPU gives +68% decode on its own.
- **The memory is not in the weights.** Two things in the compute buffer decide what fits:
  - Op-offload staging takes ~6.7 GB when all experts are in RAM.
  - The per-head relative-position bias mask grows as 190 B × context × ubatch.

  The brief's baseline (64k, ub 512) cannot even load on 12 GB. 64k with the core on the GPU needs q8_0 KV and ub 128.
- **Stock master has a correctness bug with this model: any batch of ≥ 32 tokens that runs a loop-core layer whose experts sit in RAM comes out NaN, as long as op offload is on (the default).** Every placement that keeps the core in RAM is affected, including `-ot exps=CPU`. So are image prompts, which come back as "????". The shipped config keeps the core on the GPU and is not affected. The baseline numbers above use `--no-op-offload`.
- **NVFP4 repack: about 3× closer to Q8_0 than IQ4_NL (KLD 0.0029 vs 0.0085 on wikitext), 7% slower.** It is shipped as an option (`INK_QUANT=nvfp4`), not the default. Both pass 8 of 8 in the coding eval.
- **unsloth's UD-IQ3_XXS and UD-Q3_K_XL in the repo root do not load on master.** They are a pre-merge conversion with the loop unrolled to 48 blocks. The repo's `Mainline_Support/` files do load (round 2).

Round 2 (2026-11-22, new master):

- **The headline is unchanged: 29.0 tok/s decode, 144 tok/s prefill at 8k, needles 3/3 at 32k and 62k**, now on master 225a5345b with two patches instead of three. Stock master still cannot run 64k with IQ4_NL on this card, and the NaN bug is still there.
- **Smaller quants trade quality for speed, and the table says how much.** UD-IQ2_XXS fits on the GPU whole and decodes at 41.4 tok/s with 295 tok/s prefill, at a KLD 10.7× that of IQ4_NL. UD-IQ3_XXS gives +7% decode and +42% prefill at 3.3× the KLD. All of them pass the needles and the 8 coding tasks. They are options (`INK_QUANT`), not the default.
- **Upstream PR #32740 is the largest gain left on the table for the default quant:** on the same gate it gives 361 tok/s prefill at 8k (2.5×), 297 at 62k (2.9×) and 24.2 tok/s decode at 62k (+20%). It is not merged, so it is not the default build.
- **128k needs the 6–15 layout, and on the shipped build only ub 64 fits.** A load is not a run: four layouts that loaded within 0.4 GB of the card's limit died on their first request.
- **With spare VRAM (32k), the MoE cache adds 10–12% decode and the DSpark drafter a median 14–20%.**

## Round 2 (2026-11-22): new master, smaller quants, the 128k boundary

Measured 2026-11-21/22 on llama.cpp master **225a5345b** (build 12627), 27 commits past the round-1 pin. PLAN.md rows 16 onward; raw logs in `runs/r2/`, `runs/membuf/summary-r2-*.txt`, `runs/nanprobe/r2-*`, `runs/bench-r2*`. The GPU was shared with other jobs through `gpu_run` all night, so every speed number has a control from the same GPU session.

### Rebase: what the recipe needs now

| Round-1 patch | On 225a5345b | Evidence |
|---|---|---|
| Loop passes keep their expert scales (old `0001`) | **Not needed: upstream since 690b87d88 (#32704).** | NVFP4 repack PPL: old pin stock 138.5, old inkfix 5.9639, new stock master 5.9639 |
| F16 relative-bias mask (old `0002` + `0003`, now `patches/0001` + `0002`) | **Still needed for 64k with IQ4_NL.** Stock master loads 64k (11.9 GB on the card) and dies on the first request, `cudaGraphInstantiate` out of memory, as it did on the old pin. | `runs/server-r2-master225-64k.log` |
| `loop.count = 1` override (now `patches/0003`) | Only for the loop-pass experiment in `eval/`. Not needed to serve. | |

The shipped build is now **225a5345b + `patches/0001` and `0002`** (`r2inkfix-19c41d2ff`). The patches apply with `git am`. The old four are kept in `patches/old-29b52d398/`.

Same flags, same gate as round 1 (`serve.sh` defaults, IQ4_NL, 64k; `runs/server-r2-inkfix-64k.log`):

| | Round 1 (29b52d398 + patches) | **Round 2 (225a5345b + patches)** |
|---|---:|---:|
| Decode, empty / 32k / 62k | 29.0 / 23.7 / 20.2 tok/s | **29.0 / 23.6 / 20.2 tok/s** |
| Prefill, 8k / 32k / 62k | 144.6 / 123.3 / 103 tok/s | **144.1 / 122.9 / 102.9 tok/s** |
| Needles at 32k / 62k | 3/3, 3/3 | **3/3, 3/3** |

The headline number did not change. llama-bench agrees (tg64 ×6 / pp2048 ×6, `runs/r2/benchA.log`): old pin 29.32 / 29.31 / 29.22 tok/s decode and 173.6–174.6 prefill; new master 29.28 / 29.17 and 174.1 / 174.2; new master + patches 29.32 and 174.9.

**Two open upstream PRs would replace our patches.** Both shrink the same mask buffer, in different ways, and they conflict with each other, so each was built alone on 225a5345b:

| Core placement, 64k, q8_0 KV, op offload on | Stock | + our F16 patches | + #32752 (mask in chunks) | + #32740 (compact bias) |
|---|---:|---:|---:|---:|
| Compute buffer, ub 128 | 1775 MiB | 1391 MiB | 1007 MiB | **928 MiB** |
| Compute buffer, ub 256 | OOM (3368) | OOM (2600) | 1448 MiB | **985 MiB** |
| Compute buffer, ub 512 | OOM | OOM | OOM (2459) | **1100 MiB** |
| llama-bench decode / prefill (ub 128) | 29.28, 29.17 / 174.1, 174.2 | 29.32 / 174.9 | 29.15 / 174.1 | **29.71 / 192.7** |
| 64k server: decode empty / at 62k | OOM on first request | 29.0 / 20.2 | 28.9 / 20.0 (ub 256) | 29.6 / 24.2 (ub 128), **29.5 / 24.1 (ub 512)** |
| 64k server: prefill 8k / 62k | | 144.1 / 102.9 | 200.1 / 123.1 (ub 256) | 166.7 / 152.1 (ub 128), **362.5 / 297.1 (ub 512)** |
| 64k server: needles at 62k | | 3/3 | 3/3 | 3/3, 3/3 |

Neither PR is merged. Until one is, the recipe keeps the two F16 patches.

### The op-offload NaN on new master

**Unchanged on 225a5345b** (`tools/nanprobe.sh`, `runs/nanprobe/r2-master-225a5345b-*`, llama-perplexity 3 × 512, IQ4_NL):

| Experts in RAM | Op offload | `-ub` | PPL |
|---|---|---:|---:|
| all | on | 512 | NaN |
| all | off | 512 | 6.0074 |
| all | on | 32 | NaN |
| all | on | 31 | 6.0212 |
| layers 0–5, 18–23 (core on the GPU) | on | 512 | 6.0297 |
| layers 0–5, 18–23 | off | 512 | 6.0131 |
| layers 0–6, 18–23 (one core layer in RAM) | on | 512 | NaN |
| layers 0–17, 20–23 | on | 512 | NaN |

New in this round: the threshold is exact (ub 31 is fine, ub 32 is NaN), and one core layer in RAM is enough. Upstream issue #32710 has the cause: the host expert tensor of a looped layer is registered as an input of the first pass's split only, so passes 2 and 3 read a staging slot that has been reused. The workarounds are the same: keep layers 6–17 on the GPU, or pass `--no-op-offload`.

### `--fit` against the `-ot` regex

`llama-fit-params -c 65536 -ctk q8_0 -ctv q8_0 -ub 128`, then llama-bench with what it chose (`runs/r2/fit-*.log`, `runs/bench-r2f-*`). Regex controls in the same session: 29.33 / 29.31 tok/s.

| Fit | What it chose | Decode |
|---|---|---:|
| Stock master, default margin (1024 MiB) | `-ngl 25`, whole layers | 10.84 tok/s |
| PR #32777, default margin | `-ngl 25`, whole layers | 10.86 tok/s |
| Stock master, `--fit-target 256` | experts of some core layers in RAM | 16.96 tok/s |
| PR #32777, `--fit-target 512` / `256` / `128` | core experts in RAM | 16.40 / 16.59 / 17.03 tok/s |
| **PR #32777, `--fit-target 0`** | **the recipe's placement** (0–5 and 18–23 in RAM) | **29.40 tok/s** |

Automatic placement only matches the regex with #32777 and a zero margin, and with the desktop holding 0.95 GB that is the one margin that leaves room for the core. Every other setting loses 40–63%, and the ones that put a core layer in RAM also land on the NaN placement. `--fit-target 0` was benchmarked but not run with a real 64k request. Keep the regex.

### Smaller quants (Unsloth, mainline layout)

The files in the root of unsloth/Inkling-2-Mini-GGUF are still the pre-merge conversion (the root UD-IQ3_XXS has the same sha256 as the file that failed in round 1). The mainline-layout files are in the repo's `Mainline_Support/` folder at rev 45fd0876, named `*.gguf_file`; they are stored here as `.gguf`. All three load on 225a5345b.

| | IQ4_NL (ggml-org) | NVFP4 (our repack) | UD-IQ3_XXS | UD-Q2_K_XL | UD-IQ2_XXS |
|---|---:|---:|---:|---:|---:|
| File | 17.6 GB | 17.6 GB | 11.7 GB | 9.1 GB | 8.5 GB |
| Experts (of which loop core) | 14.71 GiB (6.41) | same | 9.59 GiB (4.88) | 7.35 GiB (3.94) | 6.75 GiB (3.48) |
| Experts in RAM | layers 0–5, 18–23 | same | layers 0–2, 20–23 | none | none |
| llama-bench decode / prefill (ub 128) | 29.3 / 174 | 27.1 / 163 (round 1) | 32.2 / 246 | 41.7 / 345 | 43.4 / 355 |
| Server at 64k: decode empty / 32k / 62k | 29.0 / 23.6 / 20.2 | 27.4 / 22.5 / 19.3 | 31.0 / 24.8 / 21.6 | 39.9 / 30.4 / 25.6 (ub 64) | **41.4 / 31.3 / 26.1** |
| Server at 64k: prefill 8k / 32k / 62k | 144.1 / 122.9 / 102.9 | 126.3 / 115.8 / 98.0 | 205.0 / 162.3 / 129.1 | 255.3 / 191.0 / 146.5 (ub 64) | **295.2 / 213.9 / 159.7** |
| Needles at 32k / 62k | 3/3, 3/3 | 3/3, 3/3 | 3/3, 3/3 | 3/3, 3/3 | **3/3, 3/3** |
| Largest context that ran a real long request | **128k** (124k prompt, 6–15 profile, ub 64) | 64k (62k prompt) | 64k (62k prompt) | 64k (62k prompt) | **96k** (92k prompt, ub 32; needles 3/3, prefill 105, decode after it 21.9). 128k and 262k fail |
| KLD vs Q8_0, wikitext / code | 0.0085 / 0.0088 (again this round) | 0.0029 / 0.0044 (round 1) | 0.0280 / 0.0179 | 0.0723 / 0.0440 | 0.0910 / 0.0562 |
| Same top token, wikitext / code | 95.5% / 97.5% | 97.7% / 98.2% | 93.0% / 95.9% | 88.0% / 93.9% | 86.8% / 93.3% |
| PPL, wikitext (Q8_0 7.352) | 7.367 | | 7.489 | 7.731 | 7.910 |
| `codeeval.py` (8 tasks) | 8/8 | 8/8 | 8/8 | 8/8 | **8/8** |

Speed columns are from `r2inkfix`, the shipped build, at ub 128 unless noted. NVFP4's llama-bench and KLD cells are round 1 (old build); its server rows are this round (`r2-nvfp4-64k`).

- **Every step down in bits is faster and further from the full model.** All four Unsloth and ggml-org files find the needles and pass the 8 coding tasks, so those two gates do not separate them. KLD does: 0.0085 → 0.028 → 0.072 → 0.091 on wikitext.
- **The default stays IQ4_NL.** None of the smaller files wins on quality, so none replaces it.
- `INK_QUANT=iq3xxs` is the middle: +7% decode, +42% prefill, 3.3× the KLD. It keeps layers 3–19 on the GPU.
- `INK_QUANT=iq2xxs` is the fastest: 1.43× decode and 2.05× prefill, 10.7× the KLD.
- `INK_QUANT=q2kxl` is 4% slower than IQ2_XXS with a 21% lower KLD. It needs ub 64 to load at 64k.
- `INK_QUANT=nvfp4` is still the closest to the full model, 5.5% slower to decode and 12% slower to prefill than IQ4_NL.
- The coding eval is 8 short tasks. It cannot see what KLD measures, so the 2-bit files are untested on hard work.

**How far the context goes with every expert on the GPU (UD-IQ2_XXS).** Each case is a real request, not a load (`runs/r2/ctx-*.log`):

| Context | Build, ubatch | Result |
|---|---|---|
| 64k | shipped, ub 128 | runs: 62k prompt, needles 3/3 |
| 96k | shipped, ub 32 | runs: 92k prompt, needles 3/3, prefill 105.4, decode after it 21.9 |
| 96k | + #32740, ub 128 | runs: 92k prompt, needles 3/3, prefill 288.0, decode after it 29.3 |
| 128k | shipped, ub 32 | does not load (compute buffer 1124 MiB) |
| 128k | + #32740, ub 128 | loads (11.87 GB), fails on the first request |
| 262k, q4_0 KV | + #32740, ub 64 | does not load (KV 2304 MiB, compute 1138 MiB) |

The model's 262k window is out of reach on this card with the experts on the GPU: the q8_0 KV cache alone would be 4.35 GB. UD-IQ3_XXS and UD-Q2_K_XL were only run at 64k.

**Decode on the GPU is not limited by memory bandwidth here.** UD-IQ2_XXS reads about 2.7 GB per token, which at the card's 342 GB/s would allow ~125 tok/s. It measures 43.4: 23 ms per token, or about 0.48 ms for each of the 48 layer applications. IQ4_NL with the core on the GPU takes 34.1 ms: the same ~23 ms plus ~11 ms for the 12 applications that read experts from RAM. UD-IQ3_XXS with the same layers in RAM as IQ4_NL is no faster than IQ4_NL (29.2 against 29.3 tok/s), although those experts are 40% smaller. So shrinking the RAM experts did not buy speed, and what is left on the GPU is per-layer overhead, not bytes. THEORY.md's ceilings count bytes only, so they overstate what an all-GPU layout can reach.

### The 128k boundary

Which layouts hold a 128k context on this card. IQ4_NL, q8_0 KV (2176 + 106 MiB at 128k), the desktop holding 945–965 MiB of the card at the time, `--no-op-offload`. "6–15" means the experts of core layers 6–15 on the GPU (6732 MiB of model; this is `INK_PROFILE=128k`), "6–16" adds layer 16 (7279 MiB).

Step 1, the compute buffer at load (`runs/membuf/summary-r2-128k.txt`):

| Build | 6–15, ub 64 | 6–15, ub 128 | 6–15, ub 192 | 6–15, ub 256 | 6–16, ub 64 | 6–16, ub 128 |
|---|---:|---:|---:|---:|---:|---:|
| Stock 225a5345b | 1608 MiB | OOM (3216) | OOM (4823) | OOM (6431) | OOM (1608) | OOM (3216) |
| + our F16 patches (shipped) | 1224 MiB | OOM (2448) | OOM (3671) | OOM (4895) | 1224 MiB | OOM (2448) |
| + #32752 | 1256 MiB | 1744 MiB | OOM (2231) | OOM (2719) | 1256 MiB | OOM (1744) |
| + #32740 | 579 MiB | 645 MiB | 712 MiB | 778 MiB | 579 MiB | 645 MiB |

With op offload **on**, nothing loads at 128k on any build: staging for the RAM experts adds about 1.2 GB (6–15 at ub 64 needs 2480 MiB on the shipped build, 1841 MiB with #32740, which allocates and then fails in CUDA). It would also be the NaN placement.

Step 2, a real long request for each case that loads:

| Build | Layout | At load | First real request | Long request |
|---|---|---:|---|---|
| Shipped (F16 patches) | 6–15, ub 64 | 11.35 GB | runs | **124k-token prompt: needles 3/3**, prefill 56.0 tok/s, decode 14.6 tok/s after it |
| Shipped (F16 patches) | 6–16, ub 64 | 11.9 GB on the card | **OOM** (`cudaGraphInstantiate`) | |
| + #32752 | 6–15, ub 128 | 11.86 GB | **OOM** | |
| + #32740 | 6–15, ub 256 | 10.9 GB | runs | **104k-token prompt: needles 3/3**, prefill 92.2 tok/s, decode 20.0 tok/s after it |
| + #32740 | 6–16, ub 128 | 11.32 GB | runs | **104k-token prompt: needles 3/3**, prefill 101.2 tok/s, decode 20.7 tok/s after it |
| + #32740 | 6–17 (whole core), ub 128 | 11.87 GB | **OOM** | |

A load that leaves less than about 0.4 GB of the card free does not survive its first request: instantiating the CUDA graph needs room on top of the buffers llama.cpp prints. So the load table above is an upper bound, and only the rows in this table count.

Speed of the layouts that run, against round 1 (same tests: 3 capped answers, three 8k prompts, then the long needle prompt):

| 128k layout | Decode, empty | Prefill, 8k prompt | Long prompt: prefill / decode after it | Needles |
|---|---:|---:|---|---|
| Round 1: 6–15, ub 64, old build | 26.1 | 85.2 | 64k: 68.5 / 18.7. 124k: 56.2 / 14.6 | 3/3, 3/3 |
| **Shipped: 6–15, ub 64** (`INK_PROFILE=128k`) | **26.4** | **85.4** | 124k: 56.0 / 14.6 | 3/3 |
| + #32740: 6–15, ub 256 | 26.9 | 101.0 | 104k: 92.2 / 20.0 | 3/3 |
| + #32740: 6–16, ub 128 | 28.2 | 112.9 | 104k: 101.2 / 20.7 | 3/3 |

No higher ubatch is stable on the shipped build, so the 128k profile keeps ub 64 and its numbers are the round-1 numbers. The gain at 128k is in #32740: +5–8% decode at empty context, +18–32% prefill at 8k, and a long prompt processed at 92–101 tok/s at 104k against 56 at 124k (different depths, so not like for like).

**Community report, same card (RTX 3060 12 GB), unverified, build and settings unknown:** layers 6–15 on the GPU at ub 128 runs 128k at 20 tok/s; 6–16 runs out of memory at ub 128; at 6–15, ub 192 works and ub 256 runs out of memory.

| Reported | Here |
|---|---|
| 6–15, ub 128 runs 128k | **Not reproduced on the shipped build** (does not load: needs 2448 MiB of compute buffer) or on stock master. With #32752 it loads and then runs out of memory on the first request, 0.4 GB short. With #32740 it loads with room (645 MiB) |
| about 20 tok/s | **Similar**: 20.0 tok/s after a 104k-token prompt (#32740, 6–15, ub 256); round 1 measured 18.7 at 64k and 14.6 at 124k on the old build |
| 6–16 runs out of memory at ub 128 | **Reproduced** on stock, the shipped build and #32752 (does not load). With #32740 it loads and ran the 104k request |
| 6–15: ub 192 works, ub 256 runs out of memory | **Not reproduced on any build.** Shipped and #32752: both fail. #32740: both load, and ub 256 ran the 104k request |

The report fits one build best, though not exactly: **master with #32752 (or the same change), on a card with nothing else on it.** There the 6–15 layout needs 8476 MiB of model and compute buffer at ub 128, 8963 at ub 192 and 9451 at ub 256, and 6–16 at ub 128 needs 9023. Our card had 0.95 GB taken by the desktop and failed at the first of those on its first request; a card with that 0.95 GB free would pass ub 128 and ub 192 and fail ub 256, as reported. The 6–16 failure sits only 60 MiB above the ub 192 success, so that part fits only if their card was filled to the last few tens of MiB. This is an inference from buffer sizes, not a measurement: we could not free the desktop's memory to test it, and we do not know their build, KV type or quant.

**Guidance.** Up to 64k, use the default layout (core layers 6–17 on the GPU, op offload on): it is the fast one. For 128k use the 6–15 layout with `--no-op-offload` (`INK_PROFILE=128k`). On the shipped build that means ub 64; nothing larger loads. With #32740 the same layout runs at ub 256 with about 1 GB to spare; that build is the one to use for 128k once the PR is merged.


### Closing the gap where there is VRAM: MoE cache and DSpark

Both need memory the 64k default does not have on this build, so both were measured at 32k (6 capped coding answers at empty context, median, controls on the same build in the same GPU session; `runs/r2/batch7.log`).

| Config at 32k | Control | With the lever | Change |
|---|---:|---:|---:|
| IQ4_NL + **MoE cache 768 MiB** (`INK_MOE_CACHE_MIB=768`) | 29.1 / 29.1 / 29.2 | **32.0** (31.6–32.3) | **+10%** |
| UD-IQ3_XXS + MoE cache 768 MiB | 31.2 / 31.4 | **35.1** (34.8–35.2) | **+12%** |
| IQ4_NL + **DSpark** drafter, 3 draft tokens | 29.0 / 28.9 | **33.0** (25.7–36.4) | +14% median, two of six answers slower than the control |
| UD-IQ2_XXS (all on GPU) + DSpark | 41.2 (one control) | **49.4** (45.1–52.2) | +20% |
| NVFP4 repack, for reference | 29.1 / 29.2 | 27.6 | −5% |

- **MoE cache.** The cache keeps the hottest RAM experts in VRAM. It takes 0.86 GB of the card (10.66 → 11.52 GB), which exists at 32k and not at 64k. Gate at 32k with a no-cache control in the same session (`runs/r2/batch10.log`): decode 31.9 against 29.1, 8k prefill 152.9 against 146.1, 3 of 3 needles in a 30k prompt on both, decode after it 25.8 against 24.0. It passes and is a supported 32k option: `INK_CONTEXT=32768 INK_MOE_CACHE_MIB=768 ./serve.sh`.
- **DSpark** is Unsloth's small drafter for this model (0.37 GiB at Q8_0), run through llama.cpp PRs #32218 and #32773, which merge cleanly onto 225a5345b. 41–73% of drafted tokens were accepted on IQ4_NL (mean accepted run 2.2–2.95 tokens) and 48–60% on IQ2_XXS. The gain depends on the text: the two IQ4_NL answers with under 50% acceptance came out at 25.7 and 27.8 tok/s, below the 29.0 control. It was not run through the needle gate and is not in `serve.sh`, because it needs two unmerged PRs. To try it: build `dspark-61004ada8` and add `-md dspark-Inkling-2-Mini-Q8_0.gguf --spec-type draft-dspark --spec-draft-n-max 3 -ngld 99`.

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
| — | MoE cache (`--moe-cache-mib`) | round 1: not run, no VRAM at 64k. Round 2 at 32k: 32.0 vs 29.1 tok/s | **+10% at 32k** (round 2) |
| — | DSpark (PR #32218) | round 1: not run, the PR conflicted. Round 2 (PR updated, + #32773): median 33.0 vs 29.0 tok/s at 32k | works, median +14%; needs unmerged PRs (round 2) |

## Engine patches

Round 1, on the old pin (for the current state see "Rebase: what the recipe needs now" above). The `inkfix` build is master 29b52d398 plus branch `inkling-loop-scale-fix` (`/mnt/scratch/llama.cpp/src-inkfix`, commits 7c396f834, 4c836a8eb, 6aafbc7d2):

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

Round 1, on the old pin. The same comparison on 225a5345b is the table under "Rebase: what the recipe needs now": the outcome is the same (speed from flags alone, the F16 patches only for 64k), and the loop-scale patch is now upstream.

Tuned flags (`serve.sh` defaults, IQ4_NL) on **unpatched master 29b52d398** (`INK_BIN=/mnt/scratch/llama.cpp/master-29b52d398/bin`), measured 2026-11-20:

| Context | Result on stock master | Same flags on inkfix |
|---|---|---|
| llama-bench (empty) | tg 29.40, pp2048 175.3 (`runs/bench-b02-core-q8kv-ub128.jsonl`) | tg 29.07 / 29.45, pp2048 174.6 |
| 32k server | decode 29.07 / 28.98 / 29.05; 29.6k-token prompt: prefill 121.4, decode 23.68 (`runs/server-stock-master-32k.log`) | decode 29.0; 23.7 at 32k |
| 64k server | loads, then **CUDA OOM on the first request** (`cudaGraphInstantiate`, `runs/server-stock-master-64k.log`), with ~0.95 GB held by the desktop | runs; needles 3/3 at 62k |

So the speed comes from flags alone. The F16-mask patch (commits 4c836a8eb + 6aafbc7d2, `patches/0002`, `0003`) is only what makes 64k fit on this 12 GB card. The loop-scale patch (7c396f834, `patches/0001`) only matters for NVFP4 GGUFs; IQ4_NL does not need it.
