# Qwen3.5-4B-3D-Coder results

- GPU: RTX 3060 12 GB, driver 615.78.08. Measured VRAM bandwidth: **342 GB/s** (cuBLAS SGEMV, 1 GiB).
- CPU: i5-12500; RAM: 62 GiB.
- Model: ccore/Qwen3.5-4B-3D-Coder, revision 4b9f05f (the Oct 27 checkpoint).
  - 32 layers: 8 full-attention layers (4 KV heads × 256) and 24 Gated DeltaNet layers.
  - 248k-vocabulary tied embedding.
- Runtime: llama.cpp b12242 (commit 3b4d6ab3f), CUDA 12.8 build.
- Measured 2026-11-19. The experiment log is `PLAN.md`. Raw data: `runs/`. All server runs are in `runs/ledger.jsonl`.

## Verdict

- **Ships: Q5_K_M without speculation (`serve.sh`): 77.5 tok/s task-weighted, 1.28× the Q8_0 baseline (60.6).** It decodes at 80.7 tok/s while reasoning and 74.0 tok/s while writing code. Its pages work as often as Q8_0's (render eval 9 vs 10 of 20).
- **MTP is opt-in (`QC_SPEC=draft-mtp`): 1.41× faster on the real task (105.7 vs 75.0 tok/s median), and not the default.** Its first quality check, one answer per prompt, failed: 1 page of 8 worked against 6. The follow-up found no engine bug (state matches a clean prefill through 12k tokens), no higher loop rate (0/16 vs 2/16 on the prompts that looped), and the same page pass rate with 2 seeds per arm (10/16 vs 9/16). But 5 of its 19 finished pages across all runs failed on syntax errors, against 0 of 35 for no-spec Q5_K_M (p = 0.004, pooled over mixed runs; 3/16 vs 0/16 in the controlled one). A re-score of every token found nothing MTP picked that plain decoding couldn't, so the cause is unknown and may be chance. See [Does MTP break long answers?](#does-mtp-break-long-answers).
- **Q4_K_M does not ship either.** It is the fastest quant (84.8 no-spec, 107.1 with MTP), but it passed 5 of 20 prompts in the render eval, and 62% of its finished pages threw an error, against 29% for Q5_K_M and 33% for Q8_0.
- **A custom CUDA kernel is not worth writing yet.** Fixing MTP is worth +31% (77.5 → 101.7, measured) and needs no new CUDA code. After that, a phase-aware MTP/DFlash switch (+8%) and a vocabulary-pruned MTP LM head (+10–13% while writing code) each beat a custom kernel (~+5% on the task with MTP on). Without speculation, a fused single-token decode kernel would be worth ~+15%. See [the kernel section](#is-a-custom-cuda-kernel-worth-writing).

## Baseline vs tuned (single user, 64k context)

The task has two phases. The model reasons in prose, then writes a ~10k-token HTML/JS page. Speculation behaves very differently in each phase, so each is measured separately with llama-server's own timings:

- **R**: the model starts reasoning on a fresh prompt.
- **C**: the prompt plus the dataset's reference reasoning, so the model is writing the page at 4k–21k tokens of context.

Each cell is the median of 5 prompts × 1024 tokens, sampled as the model card says (T 0.6, top-p 0.95, top-k 20).

"Task" is the time-weighted rate `1 / (0.55/R + 0.45/C)`. The 0.55 is the share of the reference answers' tokens that are reasoning.

| Config | Decode, reasoning | Decode, writing code | Task | Card memory used* |
|---|---:|---:|---:|---:|
| Q8_0 official, no speculation (baseline) | 62.5 | 58.3 | 60.6 | 8.0 GB |
| Q8_0 ours + MTP n=2 (no quant change; opt-in, see below) | 77.8 | 107.7 | 88.9 (1.47×) | 8.7 GB |
| Q4_K_M ours, no speculation (fails the render eval) | 88.5 | 80.6 | 84.8 (1.40×) | 6.3 GB |
| **Q5_K_M ours, no speculation (`serve.sh`)** | **80.7** | **74.0** | **77.5 (1.28×)** | 7.1 GB |
| Q4_K_M ours + MTP n=2 (fastest; both problems) | 92.8 | 132.2 | 107.1 (1.77×) | 6.9 GB |
| Q5_K_M ours + MTP n=2 (opt-in; pages 10/16 vs 9/16 without) | 86.9 | 128.7 | 101.7 (1.68×) | 7.3 GB |
| Ceiling, Q4_K_M without speculation, at 0 / 16k depth | 122.2 | 102.5 | | |

\* Whole card while serving at 64k context, including ~1.4 GB held by the desktop and an idle ComfyUI.

Prefill (llama-bench, Q4_K_M, `-ub 2048`): 3,343 tok/s at 2k and 3,047 tok/s at 16k, so a 16k prompt takes about 5.4 s. Q8_0 prefills 3,532 tok/s at 2k. The model is small enough that prefill is compute bound, and Q8_0's simpler dequantisation wins there.

MTP n=2 on Q5_K_M was measured in two sessions: task 101.7 both times (R 86.9 / 86.8, C 128.7 / 128.8). In the second session the interleaved Q5_K_M no-spec controls held R 80.7 and C 74.0, and MTP n=3 lost again (task 92.2). Through `serve.sh`, Q5_K_M prefills a 32k prompt in 12.9 s (2,480 tok/s averaged over the prompt) and a 62k prompt in 29.9 s (2,070 tok/s).

MTP n=2 on Q4_K_M was measured in three separate sessions: R 92.8 / 92.8 / 92.6 and C 132.2 / 132.1 / 132.5. The interleaved no-spec controls stayed within R 88.5–88.9 and C 80.5–80.9 across all of them.

## What was tried

| Lever | Result | Verdict |
|---|---|---|
| Quant Q8_0 → Q5_K_M | decode 63.6 → 82.5 tok/s (llama-bench tg128); KLD 0.001 → 0.007; render eval 10 → 9 of 20 | **kept** |
| Quant Q8_0 → Q4_K_M | decode 63.6 → 91.0 tok/s; KLD 0.026; render eval 10 → 5 of 20, 62% of finished pages throw | rejected on quality |
| MTP head restored, n=2 | +5% reasoning, +64% code (Q4_K_M); +31% task on Q5_K_M | **opt-in**: pages 10/16 vs 9/16 and loops 1/16 vs 3/16 with 2 seeds, but syntax-error pages 5/19 vs 0/35 (unexplained; tokens match plain decoding's) |
| MTP n=3 / n=4 / n=6 | n=3 loses 13% in reasoning; n≥4 worse | rejected |
| MTP + `--spec-draft-p-min` 0.5 / 0.75 | higher acceptance, fewer accepted tokens; task 99–103 | rejected |
| DFlash (z-lab drafter, n=15) | 158 tok/s writing code, but 71.5 reasoning (acceptance 7%) | rejected for this model |
| DFlash + p-min 0.5 / 0.8 | reasoning 74.5 / 71.7; code drops | rejected |
| DFlash n=8 | 163.2 tok/s writing code (the fastest), 72.9 reasoning; task 97.0 | rejected (see below) |
| Qwen3.5-0.8B draft model | 38.6 / 61.5 tok/s | rejected |
| ngram-map-k | no drafts while reasoning; code at noise level | rejected |
| `-fa off` | −29% at 16k depth | rejected |
| q8_0 KV | −0.6% at d0, −4% at 16k (KV is only 32 KB per token) | rejected |
| `-ub 2048` | prefill +3.4% at 2k, +4.3% at 16k | kept |
| CUDA graphs off / fusion off / `GGML_CUDA_GRAPH_OPT` | −6.3% / −2.7% / ±0 | defaults kept |

### Why DFlash loses here

On the **base** Qwen3.5-4B, the same converted drafter is a clear win: task rate 78.3 → 96.7 tok/s, with acceptance of 11% while reasoning and 13% while coding. That proves the conversion works.

On the fine-tune, acceptance during reasoning falls to 4–7%. The fine-tune reasons in a much terser style than the base model, and a drafter trained on the base model's hidden states can't follow it.

While writing code, DFlash is the fastest option measured: 163 tok/s at n=8, against MTP's 132. llama.cpp tries spec types in a fixed priority order (MTP before DFlash) and cannot switch per phase. A phase-aware switch would be worth about **+8% task rate** over MTP n=2 (1/(0.55/92.8 + 0.45/163.2) = 116). That needs engine code, not a kernel.

## Quality

### KL divergence vs our F16

Measured with llama-perplexity on 12 held-out validation answers (reasoning plus HTML, 8 × 4096 tokens). None of these answers is in the render-eval subset.

| GGUF | Mean KLD | 99% KLD | Same top token | PPL ratio |
|---|---:|---:|---:|---:|
| Q8_0 official | 0.00107 | 0.0061 | 98.1% | 1.000 |
| Q8_0 ours | 0.00107 | 0.0062 | 98.2% | 1.000 |
| Q6_K | 0.00303 | 0.0185 | 97.0% | 1.001 |
| Q5_K_M | 0.00732 | 0.0485 | 95.8% | 1.006 |
| Q4_K_M ours | 0.0256 | 0.180 | 92.2% | 1.019 |
| Q4_K_M official | 0.0257 | 0.179 | 92.1% | 1.019 |

Our Q8_0 is byte-identical to the official one on all 249 quantized tensors. Adding the MTP tensors changes nothing for normal decoding.

### Render eval

**Setup.**
- Prompts: the first 20 prompts of the fixed 40-prompt validation subset, two per difficulty level 1–10 (`runs/data/subset-40.jsonl`, `tools/make_subset.py`).
- Sampling: one sample per prompt, the model card's sampling, a 32k-token cap.
- Server: llama-server with 4 slots × 32k context and no speculation, so the quant is the only variable.
- Rendering: each page was rendered in headless Chromium on the CPU (`--headless=new --disable-gpu`, SwiftShader), never on the GPU.
- Pass: the answer finished, contains a full HTML page, throws no error, creates a WebGL context, and draws something (≥2% of the canvas differs from the background in the 6 s screenshot).
- Harness check: the dataset's reference answers pass 40/40.

| | eval-q8-official | eval-q5km-own | eval-q4km-own |
|---|---:|---:|---:|
| prompts | 20 | 20 | 20 |
| **pass** (no error, WebGL, drawn) | 10 | 9 | 5 |
| finished within 32k tokens | 15 | 14 | 13 |
| page throws an error | 5 | 4 | 8 |
| animated | 5 | 6 | 2 |
| throws / finished | 33% | 29% | 62% |

| id | level | eval-q8-official | eval-q5km-own | eval-q4km-own |
|---|---:|---|---|---|
| scene-000048 | 1 | pass | pass | throw: TypeError: THREE.Object33D is not a cons |
| scene-000049 | 1 | throw: ReferenceError: rightHydrogenPosition is | pass | cap |
| scene-000144 | 2 | pass | pass | pass |
| scene-000145 | 2 | throw: ReferenceError: bossHitObjects is not de | blank | throw: TypeError: Cannot read properties of und |
| scene-000238 | 3 | pass | cap | cap |
| scene-000239 | 3 | cap | pass | pass |
| scene-000334 | 4 | pass | pass | pass |
| scene-000335 | 4 | pass | pass | cap |
| scene-000428 | 5 | cap | cap | cap |
| scene-000429 | 5 | pass | cap | cap |
| scene-000519 | 6 | pass | throw: TypeError: Cannot read properties of und | throw: TypeError: points.map is not a function |
| scene-000520 | 6 | throw: TypeError: Cannot read properties of und | pass | cap |
| scene-000612 | 7 | cap | cap | pass |
| scene-000614 | 7 | cap | pass | throw: ReferenceError: makeWheel is not defined |
| scene-000705 | 8 | cap | pass | throw: SyntaxError: Missing initializer in cons |
| scene-000706 | 8 | pass | throw: TypeError: Cannot read properties of nul | throw: ReferenceError: pressHeadMat is not defi |
| scene-000799 | 9 | pass | cap | throw: TypeError: Cannot read properties of und |
| scene-000800 | 9 | pass | throw: ReferenceError: dwellings is not defined | cap |
| scene-000888 | 10 | throw: ReferenceError: side is not defined | throw: TypeError: Cannot set properties of unde | throw: SyntaxError: Identifier 'label' has alre |
| scene-000889 | 10 | throw: ReferenceError: fires is not defined | cap | pass |

`cap` means the answer hit the 32k-token cap. `tools/loop_check.py` (zlib ratio of the last 20k characters) shows that nearly all of these are reasoning loops: 4 at Q8_0, 4 at Q5_K_M and 6 at Q4_K_M. The loops happen at every quant, so they come from the 4B model at T 0.6, not from quantization.

**What separates the quants is broken code in finished pages.** Q4_K_M's errors are token-level slips, such as:
- `THREE.Object33D`;
- `Identifier 'label' has already been declared`;
- `Missing initializer in const declaration`.

Q8_0's and Q5_K_M's errors are mostly undefined variables, the kind the full-precision model makes too.

With one sample per prompt, Q5_K_M vs Q8_0 (9 vs 10) is within noise. Q4_K_M vs either (5) agrees with its 4× higher KL divergence and its 92% top-token agreement.

**Verdict: Q5_K_M ships.** Its pages work as often as Q8_0's. Q4_K_M is 9% faster without speculation (84.8 vs 77.5 tok/s), but it breaks twice as many pages.

### Acceptance gates (`tools/qualify.sh`, run with MTP on, then the scenes again without)

- Chat: "ok", with reasoning returned separately.
- Needles: 3 of 3 codes found at 32,070 prompt tokens (prefill 12.9 s) and 3 of 3 at 62,073 tokens (29.9 s), out of the 64k window.
- VRAM, whole card while serving: 7.1 GB without speculation, 8.0 GB with MTP.

- Scenes: see the next section. The gate first ran with MTP on, and that is how the MTP problem was found.

### Does MTP break long answers?

The worry came from the `serve.sh` scene gate. With MTP on, its first prompt (scene-000048, which Q5_K_M finished in 12k tokens in the eval) hit the 24k cap in a reasoning loop, twice.

The same 8 subset prompts were then run through `serve.sh` (64k context, one slot, card sampling, a 24k cap, one sample each) with and without `--spec-type draft-mtp`. The pages were rendered on the CPU and scored like the render eval (`runs/qualify-mtp/`, `runs/qualify-nospec/`):

| Q5_K_M via `serve.sh` | MTP n=2 | No speculation |
|---|---:|---:|
| Pages that work | **1 / 8** | **6 / 8** |
| Answers stuck in a reasoning loop (24k cap) | 4 | 0 |
| Finished pages that throw | 3 of 4 | 2 of 8 |
| Decode on these answers | 98–132 tok/s | 73–77 tok/s |

Counting the gate's first MTP run of scene-000048, MTP looped on 5 of 9 answers against 0 of 8 without it (Fisher's exact test, p ≈ 0.03). The MTP pages also show token-level slips like Q4_K_M's: a duplicate `const direction`, and `rgba(16721477,1)`.

**First reading: an engine bug.** llama.cpp accepts a draft token only if the target's own sampler, run on the verify logits, picks the same token (`common_sampler_sample_and_accept_n`). That is exact in distribution however bad the draft is, so the suspect was the 24 Gated DeltaNet layers, whose recurrent state has to be rolled back after every rejected draft.

**What the follow-up found: no bug, and no higher loop rate** (PLAN.md, 2026-11-20 and 2026-11-21/22, `runs/mtprepro/`):

- **The state is exact.** Greedy to 6k tokens and sampled to 12k tokens (past where the loops began), the MTP run's own logprobs match a clean no-spec prefill of the same prefix as closely as no-spec decode does (median difference 0.0000–0.0021 nats). The verifier's top-1 pick rate matches what T / top-k / top-p predict, the same as without speculation.
- **The loop rate is the same.** The 4 prompts that looped, 4 seeds each, 16k cap, card sampling:

  | Q5_K_M via `serve.sh` | MTP n=2 | No speculation |
  |---|---:|---:|
  | Answers stuck in a reasoning loop | **0 / 16** | **2 / 16** |
  | Decode | 100.2 tok/s | 76.2 tok/s |

  0/16 vs 2/16 is Fisher p = 0.48. Pooled with every earlier run on these prompts: 6/31 vs 2/27, p = 0.26. Plain decoding loops on these prompts too. The first 5/9 vs 0/8 split was one sample per prompt.

- **Pages work as often.** The same 8 prompts as the first split, 2 seeds per arm, through `serve.sh` as shipped, 24k cap, rendered and scored like the render eval (`tools/rendercmp.sh`, `runs/eval-rc-*`):

  | prompt | MTP seed 1 | MTP seed 2 | none seed 1 | none seed 2 |
  |---|---|---|---|---|
  | 048 | pass | throws | throws | pass |
  | 049 | pass | pass | pass | pass |
  | 144 | pass | throws | pass | pass |
  | 145 | pass | pass | loop (cap) | loop (cap) |
  | 238 | throws | throws | pass | pass |
  | 239 | pass | pass | throws | pass |
  | 334 | pass | pass | throws | pass |
  | 335 | loop (cap) | throws | loop (cap) | throws |
  | **pages that work** | **6** | **4** | **3** | **6** |
  | decode, median | 105.7 tok/s (97–114) | | 75.0 tok/s (74–78) | |

  MTP 10/16 vs no speculation 9/16 (Fisher p = 1.0). Loops: MTP 1/16, none 3/16. Pooled with the first split: 11/24 vs 15/24, p = 0.39. The seed-to-seed swing inside one arm (3 vs 6 for no-spec) is as large as the first split's gap, which is why one sample per prompt misled.
- **But more MTP pages fail on syntax errors.** 3 of MTP's 5 throwing pages here are syntax errors (`Identifier 'resetCamera' has already been declared`, `Unexpected identifier 'isOpen'`). All 4 no-spec throws are runtime errors (`line is not defined`). Counting every scored run (`runs/**/score.json`, first error per page):

  | | finished pages | syntax-error pages |
  |---|---:|---:|
  | Q5_K_M + MTP n=2 (first split + this comparison) | 19 | **5** |
  | Q5_K_M, no speculation (first split + this comparison + the 20-prompt render eval) | 35 | **0** |
  | Q8_0, no speculation (render eval) | 15 | 0 |
  | Q4_K_M, no speculation (render eval) | 13 | 2 |

  5/19 vs 0/35 is Fisher p = 0.004. The pool mixes prompt sets and settings (the render eval used 4 slots and a 32k cap), so this is strong but not clean. Of the 5, only one is a one-token slip (`let shelf isOpen`, a space inside an identifier). Three are a name declared twice in one scope (`addBambooBand` and `direction` written again, `resetCamera` used for both a button and a function), the same kind of error Q4_K_M makes. One passes a packed hex colour to `rgba()` (`rgba(16721477,1)`).

- **Could plain decoding have written those pages? Yes** (`tools/plainscore.sh`, 2026-11-22, `runs/plainscore/`). Every answer token of the 28 finished render-comparison pages was re-scored on the shipped no-spec server, one token at a time, so the logits come from the same one-token decode path plain sampling uses. The pages were sampled with top-k 20, top-p 0.95 and min-p 0.05, so a token outside that set has zero probability under plain decoding. If MTP's batched 3-token verify gave different logits, MTP pages would carry more such tokens.

  | | pages | answer tokens | tokens plain decoding could not pick |
  |---|---:|---:|---:|
  | MTP n=2 | 15 | 116,508 | 2 (0.017 per 1k) |
  | no speculation | 13 | 103,202 | 2 (0.019 per 1k) |

  All 4 are rank 2–11 picks just under the min-p cut, the noise re-tokenizing the text adds to both arms. The three MTP syntax-error pages have none: each slip token, `isOpen` included, was in plain decoding's allowed set at that point. (1 position, where plain decoding's top pick ends the answer, could not be judged.) So the verify path doesn't pick tokens plain decoding can't, and the batched-verify idea is not supported. The MTP-on-Q8_0 test was meant to probe that idea, so it was dropped. This checks the allowed set, not exact probabilities; the earlier state checks (median logprob difference ≤ 0.002 nats, calibrated top-1 picks) cover the probabilities on average.

  No mechanism has been found for the excess. In the one controlled comparison it is 3/16 vs 0/16 (p = 0.23); the 0.004 comes from pooling runs with different prompts and settings. Chance plus the mixed pool is the likeliest explanation, but it isn't ruled out.

**Verdict: MTP stays opt-in, not the default.** It is 1.41× faster on the real task, its pages pass as often (10/16 vs 9/16), and it loops less (1/16 vs 3/16). But 5 of its 19 finished pages failed on syntax errors, against 0 of 35 without speculation, and that excess is unexplained: the re-score found no token MTP picked that plain decoding couldn't. A default change needs a clean test of it: a render comparison sized for syntax errors (e.g. 20 prompts × 2 seeds per arm, about 4 h of GPU).

### Is MTP lossless?

**In distribution, yes as far as measured** (see the follow-up under [Does MTP break long answers?](#does-mtp-break-long-answers)); pages pass as often (10/16 vs 9/16), and every token of 15 finished MTP pages was one plain decoding could also have sampled (2 exceptions in 116k tokens, against 2 in 103k for no-spec pages). More MTP pages failed on syntax errors (5/19 vs 0/35, pooled), unexplained so far. It is not token-identical at temperature 0, as expected from batched verify numerics. At temperature 0 (3 prompts × 2 phases × 512 tokens), the two no-spec runs are identical to each other. Against them:

- MTP n=2 matches on 4 of 6 outputs;
- MTP n=4 with p-min 0.5 matches on 1 of 6.

At every divergence point, the top two tokens are 0.002–0.10 nats apart (`tools/greedy_check.py`). The long greedy and sampled checks later showed the state matches a clean prefill, so these are near-tie flips from batched-verify numerics.

## Is a custom CUDA kernel worth writing?

**Not yet.** The box has no nvcc, nsys or ncu, so this analysis comes from timing and byte counts, not a profiler trace. The measurements:

1. **Single-token decode is already at 74–93% of the bandwidth ceiling.**
   - Ceiling = bytes read per token ÷ 342 GB/s. The bytes are weights + the LM head + KV + the 100 MB of DeltaNet state read and written each token (`tools/ceiling.py`, `runs/ceilings.txt`).

     | GGUF | ms/token measured | ms/token ceiling | Gap | Effective GB/s |
     |---|---:|---:|---:|---:|
     | F16 | 26.9 | 24.9 | 2.0 ms | 317 |
     | Q8_0 | 15.8 | 13.4 | 2.4 ms | 290 |
     | Q6_K | 13.2 | 10.4 | 2.8 ms | 270 |
     | Q5_K_M | 12.1 | 9.3 | 2.9 ms | 261 |
     | Q4_K_M | 11.0 | 8.2 | 2.8 ms | 255 |

   - The gap is a roughly fixed 2–3 ms per token. Some of it is not weight streaming: the small DeltaNet and norm kernels and the per-token sync. The rest is K-quant dequantisation, which is why smaller quants reach a lower share of the ceiling.
   - CUDA graphs already hide most of the launch cost: turning them off costs only 0.7 ms per token (−6.3%).
   - Attention is already at bandwidth: going from 0 to 16k depth adds 1.58 ms for 0.54 GB of KV, which is 340 GB/s.
   - A perfect Q4_K_M kernel set would decode at 122 tok/s instead of 91 (+34%). A realistic custom fused matvec plus DeltaNet step, reaching ~88% of the ceiling, gives about +15%.

2. **With MTP, single-token decode is no longer the hot path.** In the code phase, one MTP n=2 step takes 19.6–20.6 ms and yields 2.72 tokens:
   - **Verify:** a 3-token target pass, 13.2–13.8 ms (`runs/bench-verify/`).
     - On Q8_0 the same pass costs 1.04× a single token (bandwidth bound).
     - On Q4_K it costs 1.13–1.17×: the K-quant small-batch kernels are compute bound.
     - An 8-token batch (21.9 ms) is slower than a 16-token one (17.3 ms), because the switch to the MMQ kernels happens too late for K-quants on this card.
   - **Drafting:** two MTP passes, about 6 ms together, roughly 3 ms each.
     - Each pass must read the MTP layer and the full 248k-row LM head: 0.60 GB, which is 1.75 ms at 342 GB/s.
     - The rest is per-draft overhead: CPU sampling over the whole vocabulary, and kernels outside the graph.
   - Ideal step: verify at bandwidth (about 9.5 ms) plus two drafts at bandwidth (3.5 ms) = 13 ms. Upper bound: about 210 tok/s while writing code, against the 132 measured.

3. **Remaining levers, ranked by estimated gain per unit of work:**

   | Lever | Estimated gain | Kind of work |
   |---|---|---|
   | Phase-aware speculation: MTP n=2 while reasoning, DFlash n=8 after `</think>` | +8% task (measured endpoints: 92.8 and 163.2 tok/s) | llama.cpp server logic |
   | Vocabulary-pruned LM head for the MTP draft (e.g. 32k rows instead of 248k) | about −2.6 ms per step, **+10–13% code phase** | model surgery + a draft-to-target vocab map, as EAGLE3 already has |
   | Earlier MMQ switch for K-quants at batch 5–8 | helps DFlash n=8 and larger MTP drafts; nothing for n=2 | a threshold in ggml-cuda, not a new kernel |
   | Custom Q4_K small-batch (2–4 token) matvec, as cheap as Q8_0's | about −2 ms per MTP step, **+10% code phase, ~+5% task** | **a real CUDA kernel** |
   | Custom fused single-token decode kernel | +15% without speculation; mostly hidden once MTP is on | a real CUDA kernel |

The numbers above are for Q4_K_M. The shipped Q5_K_M behaves the same way: a 3-token verify costs 1.13× one token (14.0 vs 12.4 ms), and single-token decode reaches 77% of its ceiling (12.1 vs 9.3 ms). The same levers and roughly the same gains apply.

**Verdict:** first fix MTP's correctness (+31%, an engine fix, not a kernel). With MTP working, a custom kernel would be worth about +5% on the real task. The two levers above it are each worth more and need no new CUDA code. Until MTP is fixed, the shipped no-spec config is limited by single-token decode at 77% of the ceiling. There, a fused single-token kernel is the relevant kernel lever: about +15% realistic, +30% at the ceiling.

If a kernel does get written, the target is the **2–4 token Q4_K/Q6_K matvec used by the speculative verify**, not single-token decode. The bar to beat is Q8_0's batch scaling: 3 tokens for 1.04× the cost of one.

## Sources

- Model: [ccore/Qwen3.5-4B-3D-Coder](https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder) at 4b9f05f3a0382725b679c5e32a338b88acaf0064.
  - GGUFs and FP16 safetensors from the same revision.
- MTP head: [Qwen/Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B) at 851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a.
- DFlash drafter: [z-lab/Qwen3.5-4B-DFlash](https://huggingface.co/z-lab/Qwen3.5-4B-DFlash) at 9a1996ccf887b79ab3af4fcbf8c1d1f4b5658bcf.
- DFlash control: [ggml-org/Qwen3.5-4B-GGUF](https://huggingface.co/ggml-org/Qwen3.5-4B-GGUF) Q4_K_M at 8d43d974efc48399cb58957ad49c8b26bf5a109c.
- Draft-model test: [ggml-org/Qwen3.5-0.8B-GGUF](https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF) Q8_0 at 004fd086eccea9f7cf867aa07ba328773beef81d.
- Eval data: [ccore/ThreeJS-3D-Scenes](https://huggingface.co/datasets/ccore/ThreeJS-3D-Scenes), validation split, at 57b77a19d38eee8316c8b1f9e71c772046d9f48c.
- All files are sha256-pinned in `tools/download.sh`.
