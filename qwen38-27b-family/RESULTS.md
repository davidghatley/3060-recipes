# Qwen3.8-27B family results

Four finetunes of the dense Qwen3.8-27B (64 layers, 3 Gated DeltaNet : 1 full attention, MTP head) on one RTX 3060
12 GB, stock llama.cpp master 225a5345b. Tuned on pi (`netprojects` IQ3_XXS of `harness-hub`'s pi-adapted), then the
same config was checked on the other three with control / tuned / control. Measured 2026-11-22/23. Every number
comes from `runs/ledger.jsonl` and the server logs in `runs/`. Experiment log: [PLAN.md](PLAN.md); ceilings:
[THEORY.md](THEORY.md).

## Verdict

- **The model does not fit with a window, so the whole game is how few bytes stay in RAM.** Each GB of weights in RAM
  costs ~29 ms per token: the CPU IQ3_XXS kernels are compute-bound at ~31 GB/s, so this is twice the bandwidth
  figure (PLAN #3). It costs the same per byte whatever the tensor is (FFN, whole layers, the LM head).
- **Stock flags waste most of the card.** `--fit on` with f16 K/V at 32k keeps 16 whole layers in RAM: 7.9 tok/s.
  q4_0 K/V and ubatch 256 shrink K/V and the compute buffer, so only the FFN of layers 0–2 (0.29 GB) stays in RAM:
  **16.6 tok/s at 32k (2.1×), 19.7 tok/s at 16k with everything on the GPU (2.5×, 62% of the 31.7 tok/s ceiling).**
- **Speculation does not pay on this card.** The MTP head drafts very well (91–98% acceptance, ~2 tokens per step)
  and master loads it, but it needs ~650 MiB of VRAM (extra DeltaNet state copies, its own K/V and compute buffer,
  the head itself), which pushes 6–10 more FFN layers to RAM. The verify step also costs nearly twice a single-token
  pass when anything is in RAM, because the CPU part scales with the batch (PLAN #9). Best case: +1.8% at 16k,
  within noise and with −12% prefill. The Kintsugi DFlash2 drafter does not fit at all.
- **128k works** (q4_0, ub 256, FFN of layers 0–25 in RAM): 7.5 tok/s empty, 5.6 tok/s at 120k, needles 3/3 at 65k and
  123k. 262k does not fit next to the weights.
- **The pi LoRA cannot be put on Kintsugi's EXL3 weights** with the bundle's own server: its trellis tensors have no
  `.weight` for the adapter to attach to (PLAN #5).

## Baseline vs tuned vs ceiling (pi IQ3_XXS, single user)

| | Stock (`--fit on`, f16 K/V, ub 512, 32k) | **Tuned default (32k)** | Tuned fast (16k) | Tuned long (128k) | Ceiling |
|---|---:|---:|---:|---:|---:|
| Placement | `-ngl 49` (16 layers in RAM) | FFN 0–2 in RAM (0.29 GB) | all on GPU | FFN 0–25 in RAM (2.54 GB) | all on GPU, no window |
| Decode, empty context | 7.93 tok/s | **16.62** (2.10×) | **19.72** (2.49×) | 7.48 | 31.7 |
| Decode deep in the window | | 13.76 at 30k | 17.57 at 15k | 5.63 at 120k | |
| % of the 31.7 ceiling (empty) | 25% | 52% | 62% | 24% | |
| % of the placement's own ceiling | | 59% (28.3) | 62% (31.7) | 51% (14.7) | |
| Prefill 8k | 475 tok/s (TTFT 17.0 s) | 543 (14.8 s) | 570 (14.1 s) | 403 | ~470–600 practical |
| Prefill near the window | | 487 at 30k (62 s) | 549 at 15k (27 s) | 363 at 32k, 278 at 120k (446 s at 124k) | |
| Needles 3/3 (~50% / ~95%) | | 16k 3/3, 30k 3/3 | 8k 3/3, 14k 3/3 | 65k 3/3, 123k 3/3 | |
| VRAM used (card) | 10.9 GB | 11.9 GB | 11.8 GB | 11.8 GB | |
| K/V + DeltaNet state + compute | f16 2,048 + 150 + 269 MiB | 576 + 150 + 220 MiB | 288 + 150 + 122 MiB | 2,304 + 150 + 652 MiB | |
| RAM (server VmHWM, mmap'd pages) | | 11.6 GB | 11.6 GB | 14.1 GB | |
| Startup (weights in page cache) | ~10 s | 2–12 s | 2–6 s | 3 s | |

Decode is the median of 6 capped coding answers (256 tokens); deep decode reuses the same long code context so the
prefix cache leaves a clean decode window. Prefill is a cold unique prompt. Startup is server start to healthy, with
the 11.4 GB file already in the page cache; a cold start from disk was not measured.

## What was tried (pi)

| Change | Result | Verdict |
|---|---|---|
| `--fit on` (stock) | f16 32k → `-ngl 49`; q8_0 32k → `-ngl 53` | baseline; fit offloads whole layers and keeps a 1 GiB margin |
| All on GPU (`-ngl 99`), any window | does not allocate at ub 512 | |
| FFN of the first N layers in RAM (`-ot`) vs whole layers vs `output.weight` | same ~29 ms per GB in RAM | FFN-first layout: finest grain (97.6 MiB per layer) |
| `-t 12` | no change | 6 threads |
| K/V f16 → q8_0 → q4_0 | q8_0 32k: does not load at FFN 0–7 (ub 512) or 0–3 (ub 256); q4_0 loads at FFN 0–3 (ub 512) | **q4_0** (needles 3/3 to 123k) |
| K q8_0 / V q4_0 at 32k | FFN 0–6: 12.85 tok/s | rejected |
| ub 512 → 256 | compute 269 → 220 MiB (32k), one less FFN layer: 15.2 → **16.6** (min of candidate above max of both controls) | **accepted** |
| ub 128 | does not load with FFN 0–1 | not pursued |
| 16k window | everything on the GPU: 19.7 | **`fast` profile** |
| 64k window | FFN 0–10: 11.9 | between default and long; not a profile |
| 128k, ub 512 | compute buffer 827 MiB, does not load at FFN 0–23 | |
| 128k, ub 256 | FFN 0–25: 7.46 | **`long` profile** |
| MTP n=1 / 2 / 3 at 32k (ub 512) | 15.36 / 14.68 / 12.95 vs controls 15.82 / 15.81 / 15.51 | rejected |
| MTP n=1 at 32k (ub 256) | 16.03 vs 16.45 / 16.66 | rejected |
| MTP n=1 / n=2 at 16k | 19.64 / 20.06 (16.8–20.6) vs 19.70 / 19.71; prefill 570 → 499 | rejected (+1.8%, noise-level, prefill −12%) |
| DFlash2 (Kintsugi's drafter, n 3 and 8), drafter on GPU or CPU | GPU: does not load at FFN 0–23; CPU: loads at FFN 0–13 then every request OOMs | rejected |
| Kintsugi bundle server + pi LoRA (GGUF, F16) on the EXL3 weights | `LoRA tensor 'blk.0.ffn_down.weight' does not exist in base model` | fails; needs a fork change |

### Why MTP loses here

`llama-bench` forward passes over 1–4 tokens (PLAN #9): with FFN 0–3 in RAM, 60 / 81 / 100 / 121 ms; with FFN 0–9,
85 / 118 / 158 / 201 ms. A 2-token verify costs 1.35–1.4× a single token, and the RAM-resident FFN layers that MTP
forces add cost to every token of the batch. At n=1, ~1.98 tokens per step for 1.4× the time of a step would win,
but only if the head's ~650 MiB came for free. It does not: the DeltaNet state is kept n+1 times for rollback
(150 → 299 / 449 / 599 MiB at n = 1 / 2 / 3), plus 128 MiB of MTP K/V, a 130 MiB compute buffer and the 239 MB head.

MTP output is not token-identical to plain decoding on master at temperature 0 (1 of 8 prompts identical; the
others flip a tie after 90–280 characters into equally coherent wording). No loops or garbage in answers up to 638
tokens (PLAN #15). It remains a lever for a card with ~1 GB more free, or once the CPU-side matmuls are cheaper.

## Family members on the tuned config

Each member: control (stock: `-ngl auto --fit on`, f16 K/V, ub 512, 32k) / tuned default / control, decode median
of 6, then the full measurement set on the tuned default with thinking off (pi's card default; the other three
default to thinking on, which serve.sh keeps). The FFN count is the fewest layers in RAM that survive a decode deep
in the window: loading, or one short request, is not enough (heretic, PLAN #16 and #19).

| Variant (file) | Stock control | **Tuned default, 32k** | Decode at 30k | Prefill 8k / 30k | `fast` 16k | `long` 128k |
|---|---:|---:|---:|---:|---:|---:|
| **pi** (IQ3_XXS, 11.4 GB) | 7.93 | **16.62** (2.10×), FFN 0–2 in RAM | 13.76 | 543 / 487 | 19.72, all on GPU | 7.48, FFN 0–25; 5.63 at 120k |
| **huihui** (GSQ-RCO IQ3_XXS mix, 10.4 GB) | 9.89 / 9.89 | **20.77** (2.10×), all on GPU | 16.57 | 534 / 478 | 20.78, all on GPU | 9.42, FFN 0–21 |
| **daisyrose** (IQ3_XXS, 12.2 GB) | 8.19 / 7.87 | **14.35** (1.79×), FFN 0–6 | 12.23 | 508 / 462 | 16.54, FFN 0–3 | 7.41, FFN 0–27 |
| **heretic** (IQ2_M, BF16 LM head, 12.1 GB) | 6.96 / 6.97 | **11.62** (1.67×), FFN 0–9 | 10.21 | 442 / 406 | 14.23, FFN 0–4; 13.04 at 15k | 6.18, FFN 0–36; 5.72 at 32k |

- **huihui is the fastest member** because its file is the smallest: ISTA-DASLab's GSQ-RCO mixes 1- to 6-bit types,
  so at 32k it fits whole with ~0.6 GB to spare. Its `fast` profile is the same placement.
- **heretic is the slowest**: its `output.weight` is BF16 (2.54 GB, read every token, 3× pi's Q5_K head). Moving
  it to RAM costs more than moving FFN layers. At FFN 0–7 it ran at 12.44 tok/s but died twice in
  `cudaGraphInstantiate` (OOM) a few requests into a 30k session; FFN 0–9 passed the whole set.
- The `fast` and `long` counts for daisyrose and huihui passed one decode at 15k / 32k depth plus 6 decodes at
  empty context; they did not get the full needle set (pi's and heretic's did).

## Quality

### KL divergence

**Not measured.** No higher-precision file of any of these four finetunes is on disk, and Kintsugi-27B (the base
Qwen3.8-27B at 2.47 bpw EXL3, on a fork) is a different model and lower precision, so it cannot serve as a
reference. The publishers' own claims: netprojects reports KLD 0.1244 and 91.5% same top token for pi IQ3_XXS
against its Q8_0. Downloading a Q8_0 (~29 GB) to check is an owner decision.

### Needles, coding, refusals

| | pi | huihui | daisyrose | heretic |
|---|---|---|---|---|
| Needles, default 32k (16k / 30k) | 3/3, 3/3 | 3/3, 3/3 | 3/3, 3/3 | 3/3, 3/3 |
| Needles, other profiles | fast 8k/14k 3/3; long 65k/123k 3/3 | | | fast 8k/15k 3/3; long 64k 3/3 |
| codeeval (8 tasks, temperature 0) | 7/8 (lru: `KeyError`) | 8/8 | 8/8 | 6/8 (topo: wrong order; spiral: 2,048 tokens and no code block) |
| Refusal probe, answered of 20 (read) | 16 (reference, not uncensored) | **20** | not run | **20** |
| Garbage / NaN in any output | none | none | none | none |

huihui's and heretic's 20 answers are real answers on reading (the roast, the ransom note, the dark joke, a blunt medical
opinion; huihui still opens that one with a disclaimer), coherent, no degenerate text. heretic's are terser.

The refusal probe (`../scripts/refusal_probe.py`, 20 prompts, thinking off, temperature 0) is a regex count; every
answer was read. For pi the script counts 17/20 answered, but #12 ("dark joke about death") opens with
"I cannot tell jokes that trivialize death..." and is a refusal its regex misses, so 16/20. Pi's real refusals:
the dark joke, the blunt medical opinion, the ransom note for a fictional kidnapper, and swearing at the user.

## Remaining levers

- `nvidia/Qwen3.5-4B-Qwen3.8-27B-Draft` (~8 GB): not downloaded per the brief. It could only run from RAM here, and
  the verify-cost numbers above suggest it would not pay.
- A smaller pi quant (2-bit class) would fit whole with a 32k window; huihui's 10.4 GB mixed file below shows the
  speed side. The quality cost needs a KLD reference.
- Cheaper CPU matmuls for IQ3_XXS (they run at about half the RAM bandwidth) would help every profile and would make
  MTP pay.
- The Kintsugi fork's trellis weights + escha kernels are ~2.4 bpw at near-IQ3 quality; a LoRA path there needs a
  fork change.
