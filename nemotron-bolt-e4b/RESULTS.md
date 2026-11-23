# NVIDIA-Nemotron-3.5-Bolt-E4B results

- GPU: RTX 3060 12 GB (sm_86), ~1 GB of it held by the desktop. CPU: i5-12500, 6 threads. RAM: 62 GiB. Measured
  bandwidth: 342 GB/s VRAM (`THEORY.md`).
- Model: nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB, NVIDIA's post-train of Gemma-4-E4B-it. 42 dense layers (35 with a
  512-token sliding window, 7 global), the last 18 layers reuse earlier layers' K/V, per-layer input embeddings,
  262k vocabulary, 64k window (`runs/gguf-info.txt`, `runs/params.txt`).
- Weights: @ 1db54d5b1, `Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf` (6.18 GB, sha256 c8af2b8a…; NVIDIA's own imatrix quant).
  Drafter: nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB-DFlash @ 0949a2eb7, `Nemotron-3.5-Bolt-E4B-DFlash-BF16.gguf`
  (737 MB, sha256 8103aa42…; 5 non-causal layers, block size 8, reads target layers 6/12/18/24/36;
  `runs/gguf-info-dflash.txt`).
- Runtime: stock llama.cpp **master 225a5345b** (`/mnt/scratch/llama.cpp/master-225a5345b`), CUDA build. No patches.
- Measured 2026-11-23. Speed rows: `tools/srvtest.py` (llama-server's own timings; decode = median of 6 or 12 capped
  coding answers, thinking off ×256 tokens or thinking on ×512; prefill = median of 2 cold prompts), every tuning
  candidate between controls in one GPU-lock hold. Raw: `runs/ledger.jsonl`, `runs/batches/*.log`,
  `runs/server-*.log`, `runs/greedy/`, `runs/codeeval-*.json`. One config JSON per run in `configs/`.

## Verdict

- **Ships: `serve.sh` default. All in VRAM, the card's DFlash drafter (n=7), ubatch 1024, backend sampling (`-bs`),
  f16 K/V, 64k window, one slot.** 190 tok/s decode with thinking on (217 thinking off) and 158 at 60k of context,
  against 76 / 54 for the card's own command line: **2.5× at empty context, 2.9× deep in the window**. 8.6 GB on
  the card including the desktop.
- **The price is prefill.** With the drafter loaded, prompts process at 3,031 / 2,472 / 2,006 tok/s (8k / 32k / 60k)
  against 4,890 / 3,901 / 3,117 stock, so a 61k prompt waits 30.9 s for its first token instead of 19.8 s. The drafter
  has to see the whole prompt and the target exports hidden states from five layers for it; only ubatch moved it.
  `NB_PROFILE=nospec` is the prompt-heavy choice: fastest prefill (5,060 / 4,210 / 3,451), 77.6 tok/s decode.
- **Plain decode is near its wall.** 77.6 tok/s is 71% of the 109 tok/s bandwidth ceiling at empty context and 78%
  of 70 tok/s at 60k. Graphs are on; the rest is 42 small layers and a 262k-vocabulary head per token. Speculation was
  the only big lever, which is why the drafter is the default.
- **q8_0 K/V is a trap here.** On paper it should be +12% at 32k (K/V reads are a third of the bytes at depth on the
  512-dim global heads). Measured: −22% (48.3 vs 62.2 tok/s at 32k). f16 K/V costs only 1.07 GB at 64k anyway.
- **Quality is the stock model's.** Needles 3/3 at 32k and 61k on every profile, including 4 simultaneous long
  needles on the multi-slot layouts. codeeval is identical between stock and tuned (7/8 thinking off). With
  thinking on the model mostly answers with bare, unfenced code, which the shared harness counts as a failure
  (1/8 strict, 6/8 counting bare code); the same on stock.
- **A local Q8_0 copy of the drafter is +5–7% more** (greedy 185.6 vs 176.2 tok/s at identical acceptance, thinking
  on ~199 vs ~184), output 8/8 identical. Opt-in only (`NB_DRAFT_Q8=1`): the drafter carries NVIDIA's evaluation
  licence, so making a derivative of it is the owner's call.

## Baseline vs tuned vs ceiling (single user, 64k window)

| Metric | Stock (card command) | `nospec` | **`default` (DFlash)** | Ceiling | % of ceiling (default / nospec) | How |
|---|---:|---:|---:|---:|---:|---|
| Decode, empty, thinking on | 75.9 | 77.5 | **190.4** (accept 0.41) | 109 plain; ~340 DFlash at that acceptance | 56% / 71% | median of 6 × 512, b07/b08 |
| Decode, empty, thinking off | 76.3 | 77.6 | **216.7** (accept 0.48) | 109; ~380 DFlash | 57% / 71% | median of 6 × 256 |
| Decode at 60k context | 54.2 | 54.6 | **157.8** (accept 0.45) | 70 plain (f16 K/V) | – / 78% | median of 6 × 256 |
| Prefill 8k | 4,890 | **5,060** | 3,031 | 5,200 (FP16 spec peak) | 58% / 97% | median of 2 cold |
| Prefill 32k | 3,901 | **4,210** | 2,472 | 4,550 | 54% / 92% | median of 2 cold |
| Prefill 60k | 3,117 | **3,451** | 2,006 | 4,020 | 50% / 86% | median of 2 cold |
| TTFT, 32k / 61k needle prompt | 8.4 / 19.8 s | **7.8 / 18.0 s** | 13.3 / 30.9 s | prompt ÷ prefill | – | needle runs |
| Needles 32k / 61k (3 codes each) | 3/3 / 3/3 | 3/3 / 3/3 | 3/3 / 3/3 | – | – | temperature 0 |
| Startup to listening, warm cache | 1.0 s | 1.0 s | 1.7 s | ~1 s | – | server log timestamp |
| Card (whole GPU incl. desktop) | 5.4 GB | 5.5 GB | 8.6 GB | – | – | nvidia-smi at end of run |

- DFlash ceiling = bytes per step (target 3.13 GB + drafter 0.74 GB) over 342 GB/s = 88 steps/s, times the measured
  tokens per step (1 + 7 × acceptance). It ignores the drafter's pass over the shared 262k LM head for 7 positions
  and the verify pass's extra compute, so the real ceiling is lower than this.
- The prefill "ceiling" is the FP16 spec sheet (51 TFLOPS, not measured). llama.cpp's int8 matmuls beat the usual
  50%-practical guide here; the true compute ceiling is above these numbers (THEORY.md).
- Thinking-off DFlash medians are noisy (176–218 across identical controls, 12 reps) because acceptance depends on
  the sampled text; thinking-on and greedy medians are tight. Compare like with like.

### Multiple users

| `NB_PROFILE=multi` (and alternative) | Soak | c4 aggregate decode | Card |
|---|---|---:|---:|
| **4 slots × 32k + DFlash, ub 512** (shipped) | 4 simultaneous 30k needles: 3/3 each | **270.7 tok/s** | 8.7 GB |
| 4 slots × 64k, no drafter, ub 1024 (`NB_CTX=262144 NB_SPEC=none`) | 4 simultaneous 60k needles: 3/3 each | 164.6 tok/s | 8.9 GB |
| 4 slots × 64k + DFlash + ub 1024 | **CUDA out of memory** in `cudaGraphInstantiate` under the soak | – | – |

Four slots cost nothing at c1 (76.4 vs 76.5 tok/s, PLAN row 14). A request that arrives while another slot is
prefilling a long prompt decodes at ~2 tok/s until that prefill ends.

## What was tried

| Lever | Result | Verdict |
|---|---|---|
| Card command (`-c 65536 -ngl 999 --jinja`, fa auto, default slots) vs `-fa on -np 1` | identical (76.2 vs 76.2–76.4) | baseline |
| DFlash drafter, n=7 (card) | 2.4–2.8× decode; prefill −41%; greedy 2/3 identical, the third diverges on a near-tie word | **accepted** |
| DFlash n=3 / n=5 | −18% / −10% thinking on vs n=7 | rejected |
| DFlash probabilistic draft sampling | 191.1 vs 182.8 / 185.4 controls thinking on, 192.9 vs 195.0 / 205.3 off | rejected (noise) |
| DFlash + ub 2048 | +2–5% prefill for +3.9 GB VRAM | rejected |
| ub 1024 (with or without DFlash) | prefill +3% at 8k, +6–7% at 32k; decode −0.5% at 32k; +0.2–1.3 GB | **accepted** |
| ub 2048 (no drafter) | below ub 1024 on prefill, −2% decode at 32k | rejected |
| Backend sampling `-bs` (experimental flag) | +1.5% plain, +5% DFlash on greedy prompts; greedy 4/4 identical | **accepted** |
| q8_0 K/V | −22% decode at 32k, −5% prefill | rejected |
| Flash attention off | −36% decode at 32k, −11% prefill | rejected |
| Local Q8_0 drafter | +5.3% greedy, +7.5% thinking on, same acceptance, 8/8 identical | opt-in (licence) |
| 4 parallel slots | c4 aggregate 185 (plain) / 265–271 (DFlash); c1 unchanged | `multi` profile |

Not tried, with reasons: q4_0 K/V (same quantized-K/V path as q8_0); context beyond 64k (the card and the GGUF
say 64k; the drafter's 131k does not change the target); CUDA graph toggles (already the default and gave ±0 or worse
on `../qwen35-3d-coder/`).

## Quality

### KL divergence
**Not measured.** No higher-precision file of this model (BF16 or Q8_0) is on disk, and none was downloaded. The
tuned levers are lossless or close to it: DFlash and `-bs` do not change the target's distribution (greedy output
identical except near-ties under batched verify), f16 K/V is unchanged from stock.

### Coding, long context, garbage

| Check | Stock | Tuned default | File |
|---|---|---|---|
| codeeval thinking off (strict harness) | 7/8 | 7/8 | `runs/codeeval-lenient-b10-*-nothink.json` |
| codeeval thinking on, strict / counting bare code | 1/8 / 6/8 | 1/8 / 6/8 | `runs/codeeval-lenient-b10-*-think.json`, `runs/codeeval-b0{7,8}-*.json` |
| Needles 32k / 61k | 3/3 / 3/3 | 3/3 / 3/3 | `runs/ledger.jsonl` (needle-*) |
| Greedy vs control | 3/3 | 2–4/4 (DFlash: near-tie divergence), `-bs` 4/4, Q8 drafter 8/8 vs BF16 drafter | `runs/greedy/` |
| Looping / garbage (zlib ratio of every decode answer; < ~0.1 = looping) | 0.39–0.57 (31 answers) | 0.33–0.62 (343 DFlash answers); no-spec runs 0.36–0.58 | `runs/ledger.jsonl` (`z`) |

The codeeval failures: with thinking on, 7 of 8 answers are bare code without a ``` fence, which
`../scripts/codeeval.py` does not accept; scored leniently, 6 pass. The two left (`lru`, `parse_duration`) and the
one thinking-off failure (`lru`) mix code and prose. Refusal probe: not run (not an uncensored variant).

## Memory and startup

- VRAM (whole card, incl. ~1 GB desktop): stock 5.4 GB, nospec 5.5 GB, default 8.6 GB, multi 8.7 GB. The 3 GB
  per-layer embedding table stays in host memory (llama.cpp keeps input embeddings on the CPU side).
- Host: cgroup peak 7.97 GB (stock) and 9.25 GB (default), including the page cache of the 6.2 GB file; `gpu_run`
  cap 24G is ample. VmHWM 11.6–12.8 GB (counts the mmapped file).
- Startup to the listen line: 6.26 s on the first cold start, ~1.0 s warm, ~1.6 s with the drafter.

## Unverified

- No KLD (no reference file on disk).
- Tool calling, conversational mode and `--reasoning-budget` from the card were not exercised.
- DFlash acceptance was measured on coding and the stdlib-code corpus; prose, chat and other languages may accept
  less (`../qwen35-3d-coder/` saw a generic drafter collapse on reasoning). Acceptance here was 0.38–0.50.
- The prefill compute ceiling (GEMM throughput) was not measured on this card.
- `-bs` is marked experimental by llama.cpp; checked only by greedy equivalence and output sanity.
