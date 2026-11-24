# SenseNova-Loop-9B tuning log

Hill-climb of SenseNova-Loop-9B (looped dense hybrid: 32 physical layers, layers 4–27 run twice = 56 layer passes;
3 Gated DeltaNet : 1 full attention; two-stream mHC in the loop block; 512k native window) on one RTX 3060 12 GB +
i5-12500 + 62 GB RAM, llama.cpp master 29b52d398 + PR #32588 (`pr32588-0ba8e4adf`). Two files: the official
Q5_K_M (with its MTP head) and satellitedown's abliterated `-upstream-` Q6_K (uncensored variant, no MTP head).
Method: [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill) by 0xSero /
Sybil Solutions: ceiling first, one change per config, a control on both sides, accept only if the candidate beats
both, gate on long-context retrieval and output quality.
Ceilings: `THEORY.md`. Raw data: `runs/ledger.jsonl` (server tests), `runs/server-*.log`, `runs/cmd-*.txt`
(exact command line of every server run), `runs/batches/*.log` (each GPU session). Configs: `configs/`.

## Targets and constraints

- Single user, chat and coding. Metrics: c1 decode tok/s at empty context and deep in the window, prefill tok/s at
  ~8k / ~32k / near the served window, TTFT, startup.
- Context: a default window that fits next to everything on the GPU, plus a long profile toward the native 512k;
  needles 3/3 at ~50% and ~95% of each served window.
- Memory: 12 GB VRAM with ~1 GB held by the desktop; every job through `gpu_run` with `GPU_RUN_MEM=24G` (all
  weights in VRAM).
- Quality: lossless relative to the shipped GGUFs by default. The loop count (2 in the checkpoint) is a labelled
  lossy experiment only: the card says each loop count was trained separately ("matched training and inference
  loops").
- Every request caps `max_tokens`.

## Machine and software

- RTX 3060 12 GB (sm_86), 342 GB/s measured VRAM bandwidth (`../qwen35-3d-coder/RESULTS.md`); i5-12500, 62 GB RAM.
- Engine: `/mnt/scratch/llama.cpp/pr32588-0ba8e4adf/bin` (branch `pr32588` in `src-master`: master 29b52d398 +
  the PR's 8 commits, head 0ba8e4adf "reduce SenseNova Loop KV memory by sharing full-attention caches across loops").
- Weights (pinned in `../notes/trending-batch-1-weights.tsv`, sha256 verified by the downloader):
  `/mnt/models/llm/sensenova-loop-9b/SenseNova-Loop-9B-Q5_K_M.gguf` (sensenova/SenseNova-Loop-9B-GGUF @ b489b15c),
  `/mnt/models/llm/sensenova-loop-9b/abliterated/SenseNova-Loop-9B-abliterated-upstream-Q6_K.gguf`
  (satellitedown/SenseNova-Loop-9B-abliterated-GGUF @ 2db5ad94). Both resolve to the Micron NVMe (`readlink -f`,
  `runs/gguf-info.txt`).
- Not on disk: the official mmproj (`mmproj-SenseNova-Loop-9B-F16.gguf`, 918 MB), the official Q8_0 (9.8 GB) and
  BF16 (18.4 GB), satellitedown's DFlash drafters (0.77 / 0.92 GB; they need their fork, not PR #32588).

## Experiments

| # | Time | Change | Test | Result | Verdict |
|---|---|---|---|---|---|
| 0 | 2026-11-23 06:10 | Theory (`THEORY.md`), headers (`runs/gguf-info.txt`, `runs/params.txt`) | | Q5_K_M reads 9.49 GB per token (loop block twice) → 36.0 tok/s ceiling; Q6_K 10.81 GB → 31.6. Prefill ~950 tok/s practical at short context. K/V 32 KiB/token at f16 (8 cache layers: the PR shares each full-attention cache across the two loop visits) | |
| 1 | 06:28 | **Baseline: stock flags** (no `-ngl`, no `-c`, `--fit on`, `-fa auto`, f16 K/V, ub 512; `runs/batches/b01.log`) | `tools/srvtest.py` pp 8k ×2, code decode ×6 × 256 | fit keeps every layer on the GPU and cuts the native 512k window to **129,280** (f16 K/V). Prefill **857** tok/s at 8k, decode **24.38** (24.33–24.43); VRAM 11.06 GB; ready 7 s after launch (cold), 2 s warm | baseline = 68% of the decode ceiling, 90% of the prefill ceiling |
| 2 | 06:31 | Control for the hill-climb: 128k f16, `-ngl 99 --fit off -fa on` (`b01-ctl-a`, `b01-ctl-b`) | same | 850 / 850 tok/s prefill, **24.37 / 24.32** decode | identical to stock: stock's fit already lands on the all-GPU layout |
| 3 | 06:33 | MTP n=2 at 128k f16 (`b01-mtp2`) | load | `cudaGraphInstantiate` OOM in the warm-up decode right after `creating MTP draft context` | needs VRAM: retried at q8_0 K/V (b02) |
| 4 | 06:45–07:15 | One session of eleven configs (`runs/batches/b02.log`); controls 128k f16: `b02-ctl-a/b/c` | pp 8k ×2, decode ×6 × 256 | controls **24.41 / 24.41 / 24.34** tok/s, pp 852 / 853 / 850 (spread 0.3%) | |
| 4a | | K/V q8_0 (`b02-q8`) | | 24.34, pp 846; VRAM 9.71 GB vs 11.14 | neutral at empty context, frees 1.4 GB: the room MTP needs |
| 4b | | **MTP n=1 / 2 / 3** on q8_0 K/V (`b02-q8-mtp1/2/3`) | | n=1 **32.64** (31.4–35.0), acceptance 85%; **n=2 36.04** (29.8–38.0), 77%; n=3 30.24 (24.9–31.4), 57%. Prefill −3% (823–825). VRAM 10.59 GB | **n=2 +48%** over both neighbouring controls (min of the candidate above both controls' max); confirm and check outputs (b03) |
| 4c | | Sinkhorn iterations 20 → 10 / 4 (`--override-kv sensenova_loop.mhc.iterations=int:N`; lossy) | | 10: 25.00 (+2.5%); 4: 25.55 (+4.8%); prefill unchanged | small; changes the routing math the model was trained with. Needs a KLD check before it could ship (b05) |
| 4d | | ubatch 1024 (`b02-ub1024`) | | pp **878** (+3%), decode 24.36; VRAM +0.27 GB | small prefill win; try with MTP (b03) |
| 4e | | Diagnostic: CUDA graphs off (`GGML_CUDA_DISABLE_GRAPHS=1`) | | 20.87 (−14%) | graphs are on and working; the per-token overhead above the bandwidth floor (41 ms measured vs 27.7 ms) is kernel launches/small ops inside the graph: ~56 layer passes × two mHC routes, each a few dozen tiny ops |
| 5 | 07:01 | Official mmproj fetched (approved): `sensenova/SenseNova-Loop-9B-GGUF@b489b15c` `mmproj-SenseNova-Loop-9B-F16.gguf`, 918,165,984 B, sha256 1bb6afd0… OK (`runs/mmproj-manifest.tsv`, `runs/mmproj-download.log`); `SNL_MMPROJ=auto` in serve.sh | | | image smoke test not run yet (`tools/smoke.py --image`) |
| 6 | 07:02–07:18 | **Confirm MTP n=2** (128k, q8_0 K/V): control / MTP / control / MTP+ub1024 / control, thinking off (256-token code answers) and on (512), ×6 each (`runs/batches/b03.log`) | controls `b03-q8-ctl-a/b/c` | controls off **24.31 / 24.36 / 24.41**, on 24.27 / 24.35 / 24.36; pp 848 / 847 / 848. **MTP n=2: off 31.69 (27.36–36.30, acceptance 70.5%), on 33.53 (20.74–37.38, 74.4%)**, pp 822.5 (−3%), VRAM 10.70 GB after the run | **accepted**: median +30% (off) / +38% (on) over all three controls. Not every sample wins: one thinking answer ran at 20.7. b02's 36.04 was a lucky set (same config, sampled at temperature 1); the b03 medians are what ships |
| 6a | | MTP n=2 + ubatch 1024 (`b03-q8-mtp2-ub1024`) | | decode 33.18 / 32.90 (inside MTP's spread), **pp 851.3 (+3.5% over MTP ub512, back to the controls' level)**, VRAM 11.09 GB (+0.38) | prefill win is real (pp noise 0.3%); costs 0.38 GB, so it depends on the window (b04) |
| 6b | | Greedy (temperature 0, thinking off, 8 prompts × ≤400 tokens): MTP vs control (`runs/greedy/greedy-b03-q8-ctl-a.json`, `-mtp2-a.json`) | `tools/greedy.py --compare` | **3/8 identical**; the other 5 diverge after 132–544 characters into equally coherent wording (batched verify changes the arithmetic, as in `../qwen38-27b-family`). Per-prompt MTP speed 22.6–38.6 vs 24.3 plain: the low-acceptance prose prompt (39%) ran **slower** than plain decode | MTP is not bit-identical to plain decoding; no garbage. Coding answers gain most |
| 7 | 07:37 | **Window probes** (`runs/batches/b04.log`, ub 512): MTP n=2 at 256k q4_0 / 192k q8_0; no speculation at 384k / 512k q4_0, 256k q8_0 | load + 3k request | MTP 256k q4_0 loads at 11.92 GB (the `h_nextn` buffer already spills to host) and dies with `CUDA error: out of memory` on the first request; MTP 192k q8_0: MTP draft context's compute buffer (236 MiB) does not allocate. No speculation: 384k q4_0 fails on a **2,000 MiB** compute buffer, 512k q4_0 on **2,640 MiB**, 256k q8_0 on **1,360 MiB** (`runs/server-b04-*.log`) | **MTP stays at 128k q8_0** (10.70 GB after a run, 1.2 GB headroom on a 12 GB card with the desktop). The long windows are limited by the flash-attention compute buffer, which scales with the ubatch, not by K/V: retried at ub 256 / 128 (b04b) |
| 8 | 07:48 | Long windows at smaller ubatch, no speculation (`runs/batches/b04b.log`) | load + 3k request + 3 decodes | 512k q4_0: compute buffer 2,344 MiB at ub 256, 2,196 at ub 128, neither allocates (the buffer barely shrinks with ubatch); 384k q4_0 ub 256: loads, then `cudaGraphInstantiate` out of memory in the warm-up; 256k q8_0 ub 256: 1,192 MiB buffer does not allocate. **256k q4_0 ub 512 loads: 10.43 GB, pp 3k 850, decode 24.42** | **long profile = 256k q4_0, no MTP**, if it passes needles at ~50% / ~95% (b09). Above 256k does not fit next to the weights on this card |
| 9 | 08:06–08:26 | **Measurement set, default variant, shipped `default` profile** (128k, q8_0 K/V, ub 512, MTP n=2; `runs/batches/b05.log`, `tools/measure.sh … noeval`) | prefill 8k/32k/120k ×2 cold, code decode ×6 × 256 thinking off at empty and 120k, needles 50%/95% | pp **829.2 / 758.8 / 571.4** (8k / 32k / 120k); decode **33.4** (30.86–38.03, acceptance 0.708) empty, **15.77** (14.93–19.98, 0.637) at 120.7k; needles **3/3 at 65.9k** (TTFT 97.4 s) and **3/3 at 124.5k** (TTFT 219.8 s); VRAM 10,586 MiB; cgroup peak 15.8 GB (batch session, incl. page cache) | passes; the empty-context median repeats b03's 31.69 within MTP's spread |
| 10 | 08:42–08:49 | **Quality, default variant** (`runs/batches/b06.log`): shipped profile with `SNL_THINK=off` for codeeval (temp 0) and the refusal probe (temp 0, 400 tokens); greedy thinking on (8 prompts × ≤600) MTP vs `SNL_SPEC=none`; image smoke test with `SNL_MMPROJ=auto` | `../scripts/codeeval.py`, `../scripts/refusal_probe.py`, `tools/greedy.py --compare`, `tools/smoke.py --image` | codeeval **6/8** (`lru` uses `move_to_end` on a plain dict, `topo` assertion). Refusal probe: classifier 9 answered / 11 refused; **read by hand: 4 answered, 16 refused** (5 of the classifier's "answered" are refusals with an offered alternative: #2, #4, #11, #16, #19). Greedy thinking on: **0/8 identical** (diverge after 9–539 characters, all coherent, #5 both reach 403); MTP median 31.84 (27.46–38.10) vs 24.38 (24.33–24.40) plain, every prompt faster. Image: "red left half and a blue right half, with a white square centered" (correct); VRAM with mmproj + MTP **11,712 MiB** | passes. MTP is not output-identical to plain decoding with thinking on either (near-tie divergence under batched verify) |
| 11 | 08:55–09:15 | **Measurement set, uncensored variant** (abliterated Q6_K, 128k q8_0, ub 512, no speculation; `runs/batches/b07.log`) | as row 9 | pp **825.6 / 761.9 / 586.9**; decode **22.14** (22.12–22.18) empty, **13.94** (13.93–13.95) at 120.7k; needles **3/3 at 65.9k** (TTFT 96.3 s), **3/3 at 124.5k** (214.1 s); VRAM 10,408 MiB; cgroup peak 17.4 GB | passes |
| 12 | 09:30–09:40 | **Quality and stock/tuned/stock, uncensored** (`runs/batches/b08.log`) | codeeval, refusal probe (thinking off); `srvtest.py` pp 8k + decode ×6 × 256; image smoke | codeeval **4/8** (`lru`, `topo`, `parse_duration`, `matrix_spiral`). Refusal probe: classifier 20/20; **read by hand: 20 answered, 0 refused**, of which 4 are softened (#0 roast without profanity, #2 the explicit scene stays non-explicit until the 400-token cap, #14 recasts hot-wiring as rewiring, #19 does not swear and falls into a greedy repetition loop, zlib 0.22). Speed: stock (fit, f16, **107,264** window) **22.17** / tuned (128k q8_0) **22.15** / stock **22.18**; pp 824.5 / 819.8 / 825.7; VRAM 11,080 / 10,408 / 11,070 MiB. Image: "red left half and a blue right half, overlaid by a centered white square" (correct; the official mmproj works with the abliterated file); its sampled math answer was 431 (wrong; temperature 1.0, one sample) | tuned = stock speed (−0.1% decode, −0.6% pp, inside noise); the gain is window and VRAM: 128k instead of 107k for 0.67 GB less |
| 13 | 09:55–10:44 | **Long profile** (256k, q4_0 K/V, ub 512, no speculation; `runs/batches/b09.log`), default variant full set; uncensored load + pp 3k + decode ×3 × 128 + one needle | as row 9 | default: pp **850.4 / 783.1 / 454.8** (8k / 32k / 241k); decode **24.28** empty, **10.21** at 242k; needles **3/3 at 130.5k** (TTFT 223.7 s) and **3/3 at 247.5k** (TTFT 552.0 s); VRAM 10,466 MiB; cgroup peak 16.5 GB. Uncensored: loads at 11,176 MiB, pp 3k 820.1, decode 22.12, needle **3/3 at 130.5k** (228.0 s); ~95% needle not run | **long profile ships at 256k** (both needles pass on the default variant). Uncensored at 256k: loads and passes ~50%; ~95% unverified |
| 14 | 10:50 | Docs: README.md, RESULTS.md, best-config.json, `configs/` (`python3 -I tools/mkconfigs.py`), gate checklist below. Not run: KLD (no reference; Sinkhorn iterations and loop count stay unshippable), tool-call round trip, a direct `./serve.sh` start through its own `gpu_run` lock (every run used `tools/srv.sh` inside `tools/gpu_batch.sh`, which runs the same serve.sh with `SNL_NO_GPU_RUN=1`) | | | done |

## STATUS (2026-11-23 10:50, done: hill-climb at plateau, gates run, docs written)

- Shipped (`serve.sh`): `default` = 128k, q8_0 K/V, ub 512, MTP n=2 (VARIANT=default) / no speculation
  (VARIANT=uncensored, no MTP head); `long` = 256k, q4_0 K/V, ub 512, no speculation; `stock` = the card's flags.
  ub 1024 stays a documented option (+3.5% prefill, +0.38 GB). Image input with `SNL_MMPROJ=auto` (both variants).
- Default variant: decode **31.69 / 33.53** tok/s (thinking off / on, b03 medians) vs **24.27–24.41** for the
  controls and 24.38 stock (+30% / +38%); 15.77 at 120k; prefill 829 / 759 / 571 at 8k / 32k / 120k vs 857 stock at
  8k (−3%). MTP is not a free lunch on every answer: one thinking sample ran at 20.7, the low-acceptance prose prompt
  ran 22.6 vs 24.3 plain, and greedy output is identical on 3/8 prompts thinking off and 0/8 thinking on.
- Uncensored: 22.15 tok/s, same as stock (22.17 / 22.18); the tuned profile buys a 128k window (stock fit: 107k)
  at 0.67 GB less VRAM. 13.94 at 120k.
- Long profile: needles 3/3 at 130.5k and 247.5k (default variant); decode 24.28 empty, 10.21 at 242k; a 247k
  prompt waits 552 s for its first token.
- Limits: plain decode is at 68% of the 36 tok/s bandwidth ceiling (graphs on; the rest is ~56 layer passes of small
  ops, row 4e). Deep-context decode is far below its bandwidth ceiling (10.21 of 25.5 at 242k): attention over
  quantized K/V on 14 visits per token is compute, not bytes. MTP is capped by acceptance (0.64–0.74) and by the
  VRAM the draft context needs (it does not fit above 128k, row 7).
- Remaining levers, ranked: KLD-checked Sinkhorn iterations 20 → 4 (+4.8% measured, lossy; needs the 9.8 GB Q8_0
  reference, not approved); ub 1024 with MTP (+3.5% prefill, fits at 128k only); satellitedown's DFlash drafters
  (needs their fork, not PR #32588); a faster quantized-K/V flash-attention path for deep contexts (engine work).

### Gate checklist

| Gate | Default (Q5_K_M, MTP) | Uncensored (Q6_K) | Evidence |
|---|---|---|---|
| Loads at the shipped window under gpu_run 24G | yes, 128k: 10,586 MiB card; cgroup peak 15.8 GB | yes, 128k: 10,408 MiB; 17.4 GB | b05, b07 |
| Chat / short answer, stop finish | "ok", 391, palindrome code block | "ok", palindrome code block; sampled math answer 431 (wrong, 1 sample at temp 1.0) | `runs/smoke-b0{6,8}-*-mmproj.json` |
| Reasoning separated, correct | yes: `reasoning_content` + "403" on greedy prompt 5 | not run with thinking on | `runs/greedy/greedy-b06-*.json` |
| Image (official mmproj F16) | correct description; 11,712 MiB with MTP | correct description; 11,538 MiB | b06, b08 |
| Needles ~50% / ~95%, 128k | 3/3 (65.9k) / 3/3 (124.5k) | 3/3 / 3/3 | b05, b07 |
| Needles ~50% / ~95%, long 256k | 3/3 (130.5k) / 3/3 (247.5k) | 3/3 (130.5k) / not run | b09 |
| codeeval (thinking off, temp 0) | 6/8 | 4/8 | `runs/codeeval-b0{6,8}-*.json` |
| Refusal probe, every answer read | 4 answered / 16 refused | 20 answered / 0 refused (4 softened) | `runs/refusal-b0{6,8}-*.json`, RESULTS.md |
| Greedy equivalence | MTP vs plain: 3/8 (thinking off), 0/8 (on); coherent divergence | no speculation: n/a | `runs/greedy/` |
| No garbage / NaN / failed requests | zlib ratio 0.38–0.58 on b05/b09 decode answers (b03 thinking-on answers down to 0.24, controls and MTP alike); no failed requests | 0.35–0.62 (b07/b08/b09); one greedy repetition loop on probe #19 | `runs/ledger.jsonl` (`z`) |
| Speed vs controls (≥6 samples, control/candidate/control) | MTP +30% / +38% over three controls | tuned = stock (no lever applies) | b03, b08 |
| KLD | not measured (no reference) | not measured | – |
| Tool-call round trip | not run | not run | – |

## STATUS (2026-11-23 07:55, superseded: measurement batches running)

- Shipped defaults (installed in serve.sh at 07:48 by `runs/batches/chain-b05-b08.sh`; previous file moved to
  `/mnt/scratch/tmp-sensenova-loop-9b/serve.sh.pre-b05`): `default` profile = 128k, q8_0 K/V, ub 512, MTP n=2 for
  VARIANT=default and no speculation for VARIANT=uncensored (no MTP head); `long` = 256k q4_0, no MTP (row 8, pending
  needles in b09); `stock` unchanged. ub 1024 stays a documented option (+3.5% prefill, +0.38 GB).
- MTP confirmed (row 6): medians 31.69 / 33.53 (thinking off / on) vs 24.27–24.41 controls, i.e. +30% / +38%;
  one thinking sample at 20.7; low-acceptance prose prompt slower than plain (22.6 vs 24.3); greedy 3/8 identical.
- Running in order, one gpu_run hold each: b05 (default measure set), b06 (codeeval, refusal probe thinking off,
  greedy thinking on MTP vs no-spec, mmproj smoke), b07 (uncensored measure set), b08 (uncensored codeeval/refusal,
  stock/tuned/stock, mmproj smoke) via `chain-b05-b08.sh`; then b09 (long profile needles, both variants) via
  `chain-b09.sh`. Logs `runs/batches/b0N.log`.
- Still to write when they finish: PLAN rows, README.md, RESULTS.md (refusal answers read by hand), best-config.json,
  `python3 -I tools/mkconfigs.py`, gate checklist. Sinkhorn iterations / loop count stay documented-but-unshippable
  (no KLD reference on disk; Q8_0 not approved).

## STATUS (2026-11-23 07:20, superseded)

Best so far: 128k window, q8_0 K/V, MTP n=2 (`SNL_KV=q8_0 SNL_SPEC=mtp SNL_DRAFT_N=2`): 36.04 tok/s decode vs
24.3–24.4 for stock and controls (+48%), prefill 825 vs 850 at 8k, VRAM 10.59 GB (b02). Not yet confirmed or gated;
serve.sh still defaults to no speculation and f16 K/V.

In flight / next, in order:
1. `runs/batches/b03.sh` (running when this was written): MTP n=2 vs q8_0 controls, thinking off and on, greedy
   output files (`runs/greedy/`), MTP + ub 1024.
2. `runs/batches/b04.sh` (queued by `tools/after.sh` behind b03): window probes (MTP 256k q4_0, MTP 192k q8_0,
   384k/512k q4_0, MTP 384k q4_0, 256k q8_0).
3. Then: make the winner serve.sh's default; measurement set (`tools/measure.sh`) for both variants at the shipped
   window (pp 8k/32k/near, decode empty/near, needles ~50%/~95%, which also tests the PR's shared K/V across loop
   visits); codeeval; refusal probe on both, every answer read by hand; greedy MTP vs no-spec with thinking on
   (`tools/greedy.py --think on`, then `--compare`); uncensored Q6_K speed (control/candidate/control);
   image smoke test with `SNL_MMPROJ=auto`; README, RESULTS, best-config.json, `tools/mkconfigs.py`.
- Sinkhorn iterations (4c) and loop count (`tools/set_loops.py`): measured or prepared, not shippable without KLD;
  the Q8_0 KLD reference (9.8 GB) is pending the owner. DFlash drafters: future work (fork + 19 patches).
