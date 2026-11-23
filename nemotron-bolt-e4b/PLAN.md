# nemotron-bolt-e4b: plan and experiment log

Model: nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB @ 1db54d5b1, `Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf` (6.18 GB, sha256 c8af2b8a…).
Gemma-4-E4B architecture (post-trained by NVIDIA): 42 layers (35 sliding-window 512 + 7 global), last 18 layers reuse
earlier layers' KV, per-layer token embeddings (3.0 GB Q8_0 lookup table), 64k window.
Engine: llama.cpp master-225a5345b (stock). Port 8105. GPU via gpu_run, `GPU_RUN_MEM=24G`.

## STATUS (2026-11-23 12:30, done: hill-climb at plateau, gates run, docs written)
- Shipped (`serve.sh`): `default` = DFlash n=7 (card drafter, BF16) + ub 1024 + `-bs`, f16 K/V, 64k, 1 slot;
  `nospec` = same without the drafter; `multi` = 4 × 32k slots + DFlash, ub 512; `stock` = the card's command line.
  Opt-in `NB_DRAFT_Q8=1` (local Q8_0 drafter, `tools/quantize_drafter.sh`), held back for the drafter's licence.
- Qualified numbers (b07/b08, 64k): default 190.4 tok/s thinking on / 216.7 off / 157.8 at 60k vs stock 75.9 /
  76.3 / 54.2; prefill default 3,031 / 2,472 / 2,006 vs stock 4,890 / 3,901 / 3,117 and nospec 5,060 / 4,210 / 3,451.
  Ceilings: 109 plain at d0, 70 at 60k; nospec at 71% / 78%; DFlash at ~56% of its bytes-only ceiling.
- Limits: plain decode is 42 small layers + a 262k head per token (graphs on); DFlash is capped by acceptance
  (~0.41 thinking on) and by the drafter's prompt pass (−40% prefill), which no flag except ubatch moved.
- Remaining levers (all engine work): skip or defer the drafter's encoding of long prompts (would recover most of
  the prefill cost); prune the drafter's LM-head vocabulary (est. +5–10%); a faster quantized-K/V flash-attention
  path for 512-dim heads (theory +12% at 32k with q8_0, measured −22% today).

### Gate checklist
| Gate | Result | Evidence |
|---|---|---|
| Loads, chat answer correct, reasoning in `reasoning_content` | pass ("391", 261 reasoning chars) | b11 (direct `./serve.sh`, its own `gpu_run` lock) |
| Holds the GPU lock while serving, releases on stop | pass | b11 log, `gpu_run --status` free afterwards |
| Needles ~50% (32k) / ~95% (61k), all profiles | 3/3 / 3/3 (default, nospec, stock) | b07, b08 |
| Soak: 4 simultaneous long needles (multi) | 4 × 3/3 (4 × 30k, shipped layout); 4 × 3/3 (4 × 64k no-spec) | b09 |
| Greedy equivalence of lossless levers | `-bs` 4/4; Q8 drafter 8/8 vs BF16 drafter; DFlash 2/3–2/4 (near-tie divergence under batched verify) | `runs/greedy/` |
| No garbage / loops / NaN | zlib ratios 0.33–0.62 over 543 answers; no failed requests outside b08-multi OOM | `runs/ledger.jsonl` |
| codeeval | equal to stock: 7/8 thinking off; thinking on 1/8 strict, 6/8 lenient (bare code) | b10 |
| Speed vs controls, medians ≥6, control/candidate/control | yes for every accepted lever | b01–b06 |
| KLD | not measured (no BF16/Q8_0 reference on disk) | – |
| VRAM / RAM within caps | 8.6 GB card; cgroup peak 9.25 GB under 24G | b07 |

## Targets and constraints
- Everything in VRAM on the RTX 3060 12 GB (desktop holds ~1 GB). Single user (c1) first; parallel slots only if useful.
- Metrics: c1 decode at empty and deep context, prefill 8k/32k/near-window, TTFT, startup, VRAM/RAM peak.
- Window: the card's 64k (65536) must stay stable (needles at ~50%/~95%).
- Quality: lossless levers are default; anything lossy (K/V quantization) is labelled.

## Log

### 2026-11-23 setup
- Weights `readlink -f` = /mnt/models/llm/nemotron-bolt-e4b/Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf (Micron NVMe, not a symlink).
- GGUF header dump: `runs/gguf-info.txt`. Card read (data only): recommended temp 1.0, top-p 0.95; thinking on by default;
  `-c 65536 -ngl 999 --jinja`; companion DFlash drafter `nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB-DFlash`
  (`--spec-type draft-dflash --spec-draft-n-max 7 --spec-draft-ngl 999`).
- **Download (allowed: under 1 GB, named by the card):** DFlash drafter `Nemotron-3.5-Bolt-E4B-DFlash-BF16.gguf`
  737 MB @ 0949a2eb7, sha256 8103aa42…, to `/mnt/models/llm/nemotron-bolt-e4b/dflash/` via `scripts/hf_get.sh
  runs/dflash-manifest.tsv`. Engine master-225a5345b lists `draft-dflash` in `--spec-type`.
- No Q8_0/BF16 of this model on disk: KLD not measured (no download of a reference).

### 2026-11-23 10:44 b01 (`runs/batches/b01.{sh,log}`): baseline, DFlash, q8_0 K/V
Decode = median of 6 × 256 tokens (thinking off; `-think` = thinking on, 512 tokens). Order stock, ctl-a, dflash7, ctl-b, q8.

| # | config | pp 8k | decode d0 | decode 32k | d0 think | VRAM (desktop incl.) | verdict |
|---|---|---|---|---|---|---|---|
| 1 | stock (card command: fa auto, np default) | 4,902 | 76.18 | 62.45 | 75.98 | 5,408 MiB | baseline |
| 2 | ctl-a (fa on, np 1) | 4,884 | 76.24 | 62.16 | 76.12 | 5,334 | = stock |
| 3 | DFlash n=7 (card drafter) | 2,883 | **189.13** (151–216, accept 0.44) | **174.12** (accept 0.46) | **182.72** (accept 0.40) | 7,266 | **accept decode; prefill −41%** |
| 4 | ctl-b | 4,897 | 76.43 | 62.21 | 76.19 | 5,344 | control |
| 5 | q8_0 K/V | 4,640 | 74.95 | **48.30** | 74.47 | 5,094 | **reject**: −22% at 32k (theory said +12%) |

- Plain decode is 70% of the 109 tok/s ceiling at d0, 74% of 84 at 32k. Stock and ctl are identical within noise.
- DFlash: 2.5× at d0, 2.8× at 32k, 2.4× thinking on. Greedy 2/3 identical to the control (prompt 2 diverges at
  char 85 on a near-tie wording, `runs/greedy/`); controls and q8 are 3/3. Prefill drops 4.9k → 2.9k tok/s.
- q8_0 K/V: quantized K/V on the 512-dim global heads is slower than f16 at depth on this build (kernel path), so
  the bandwidth saving in THEORY does not materialise. q4_0 not tried (same quantized-K/V path; no new reason).
- Startup (server log listen timestamp): 6.26 s cold page cache (first run), ~1.0 s warm; 1.57 s with the drafter.

### 2026-11-23 10:58 b02 (`runs/batches/b02.*`): DFlash draft length, DFlash + ub 2048
Order df7-a, df3, df5, df7-b, df7-ub2048, df7-c. Decode median of 6 (off ×256 / think ×512).

| # | config | pp 8k | pp 32k | d0 off (accept) | d0 think (accept) | VRAM | verdict |
|---|---|---|---|---|---|---|---|
| 6 | df7 controls a/b/c | 2,925 / 2,901 / 2,901 | 2,316 / 2,303 / 2,304 | 204.3 / 176.0 / 178.0 (0.38–0.47) | 188.7 / 189.3 / 185.5 (0.41–0.43) | 7,266 | control |
| 7 | n=3 | 2,907 | 2,307 | 153.1 (0.66) | 154.8 (0.68) | 7,266 | reject (−18% think) |
| 8 | n=5 | 2,900 | 2,303 | 187.2 (0.56) | 168.1 (0.48) | 7,266 | reject (−10% think) |
| 9 | n=7, ub 2048 | 2,947 | 2,416 | 211.6 (0.49) | 188.4 (0.43) | **11,192** | reject: +2–5% prefill for +3.9 GB VRAM |

- n=7 (the drafter's block size 8 − 1, the card's value) is best. Thinking-off medians are noisy with DFlash
  (176–204 across controls: acceptance depends on the sampled text); thinking-on medians are tight (185.5–189.3).

### 2026-11-23 11:00 b03 (`runs/batches/b03.*`): no speculation; ubatch, FA off, 4 slots
Order ctl-a, ub1024, ub2048, faoff, ctl-b, np4, np4-df.

| # | config | pp 8k | pp 32k | d0 | d 32k | VRAM | verdict |
|---|---|---|---|---|---|---|---|
| 10 | ctl a / b | 4,909 / 4,889 | 3,945 / 3,937 | 76.50 / 76.44 | 62.06 / 62.03 | 5,334 | control |
| 11 | ub 1024 | **5,060** (+3.3%) | **4,210** (+6.8%) | 76.20 | 61.72 (−0.5%) | 5,542 | **accept** |
| 12 | ub 2048 | 4,960 | 4,168 | 76.23 | 60.81 (−2%) | 5,946 | reject (below ub 1024) |
| 13 | FA off | 4,336 | 3,529 | 73.88 | **39.91** | 6,700 | reject |
| 14 | 4 slots × 64k (`-np 4 -c 262144`) | – | – | c1 76.42; **c4 aggregate 185.1** | – | 8,534 | option (multi-user) |
| 15 | 4 slots + DFlash | – | – | c1 166.5 (accept 0.36); **c4 aggregate 264.7** | – | 10,546 | option |

- Four parallel slots cost nothing at c1 and give 2.4× aggregate (3.5× with DFlash). Each 64k slot adds ~1.07 GB
  f16 K/V, as THEORY says. Not the default: the card's use case is a single local assistant.

### 2026-11-23 11:20 b04 (`runs/batches/b04.*`): DFlash + ub 1024, probabilistic draft sampling (12 reps)
Order df-a, df-ub1024, df-prob, df-b.

| # | config | pp 8k | pp 32k | d0 off (accept) | d0 think (accept) | VRAM | verdict |
|---|---|---|---|---|---|---|---|
| 16 | df7 controls a / b | 2,934 / 2,902 | 2,316 / 2,306 | 195.0 / 205.3 | 182.8 / 185.4 | 7,276 | control |
| 17 | df7 + ub 1024 | **3,005** (+2.5%) | **2,457** (+6.3%) | 199.7 | **192.5** (+4%) | 8,572 | **accept** (same prefill gain as without spec; +1.3 GB) |
| 18 | df7 + `--spec-draft-sampling probabilistic` | 2,901 | 2,304 | 192.9 | 191.1 | 7,266 | reject: inside noise |

### 2026-11-23 11:30 b05 (`runs/batches/b05.*`): backend sampling `-bs` (12 reps), ub 1024 base
Order ns-a, ns-bs, ns-b, df-a, df-bs, df-b.

| # | config | d0 off | d0 think | greedy tok/s (prompts 1, 3) | greedy vs ns-a | verdict |
|---|---|---|---|---|---|---|
| 19a | no spec, controls a / b | 76.66 / 76.48 | 76.16 / 76.12 | 76.4, 76.4 / 76.3, 76.6 | – | control |
| 19b | no spec + `-bs` | **77.65** (+1.5%) | **77.51** (+1.8%) | 77.9, 78.0 | 4/4 identical | **accept** |
| 19c | DFlash, controls a / b | 187.1 / 196.4 | 173.3 / 181.6 | 161.3, 173.0 / 160.4, 171.8 | 2/4 | control |
| 19d | DFlash + `-bs` | **204.6** | **191.2** | **168.9, 180.9** (+5%) | 2/4 | **accept** |

- Sampled outputs clean (zlib ratios 0.40–0.56, no loops). `-bs` is marked experimental in llama.cpp's help.
- The greedy prompts are the cleanest DFlash comparison (same text, same acceptance): +5%.
- Made a local Q8_0 copy of the drafter (`llama-quantize` from master-29b52d398, CPU; 399 MB from 737 MB,
  `runs/dflash-quantize-q8.log`) for b06. It stays local (drafter licence: NVIDIA evaluation licence, see README).

### 2026-11-23 11:45 b06 (`runs/batches/b06.*`): drafter BF16 (card file) vs local Q8_0 copy, default profile
Order bf16-a, q8-a, bf16-b, q8-b. 12 reps; greedy = 8 fixed prompts × 300 tokens at temperature 0.

| # | drafter | d0 off | d0 think | greedy median tok/s (acceptance) | VRAM | verdict |
|---|---|---|---|---|---|---|
| 20a | BF16 a / b | 217.8 / 201.9 | 182.9 / 186.0 | 176.2 / 176.1 (0.414) | 8,584 | control |
| 20b | Q8_0 a / b | 205.4 / 207.4 | **200.5 / 198.3** (+7.5%) | **185.3 / 185.9** (+5.3%, 0.413) | 8,242 | **accept as opt-in** (`NB_DRAFT_Q8=1`) |

- Greedy output with the Q8_0 drafter is 8/8 identical to the BF16 drafter; acceptance unchanged; the gain is the
  drafter's own bytes (737 → 399 MB per step). Thinking-off medians are inside DFlash's noise.
- Opt-in, not default: it is a locally made derivative of a file under the NVIDIA evaluation licence (owner's call).

### Plateau (config levers)
The last levers were small (`-bs` +1.5–5%), a licence-gated option (Q8_0 drafter +5–7%) and noise (probabilistic
drafts). What is left needs engine work (see STATUS). Moving to the measurement set and qualification gates:
b07 (default + nospec), b08 (stock + multi-slot soak) via `runs/batches/chain-b07-b08.sh`.

### 2026-11-23 12:00 b07 + b08 (`runs/batches/b07.*`, `b08.*`): measurement set (`tools/measure.sh`, 64k window)
Decode = median of 6 (thinking off ×256; think ×512). Prefill = median of 2 cold prompts. Needles: 3 codes at
10/50/90% depth, temperature 0. VRAM = whole card incl. the desktop, at the end of the run.

| profile | pp 8k | pp 32k | pp 60k | d0 off | d0 think | d 60k | needle 32k / 61k | TTFT 61k | VRAM | cgroup peak |
|---|---|---|---|---|---|---|---|---|---|---|
| stock (b08) | 4,890 | 3,901 | 3,117 | 76.28 | 75.94 | 54.15 | 3/3 / 3/3 | 19.8 s | 5,408 MiB | 7.97 GB |
| nospec (b07) | 5,060 | 4,210 | 3,451 | 77.61 | 77.45 | 54.59 | 3/3 / 3/3 | 18.0 s | 5,546 | 9.26 GB |
| **default** (b07) | 3,031 | 2,472 | 2,006 | **216.65** (0.48) | **190.38** (0.41) | **157.82** (0.45) | 3/3 / 3/3 | 30.9 s | 8,598 | 9.25 GB |

- Startup to listening (server log): ~1.0 s (stock, nospec), 1.66 s (default, drafter) with a warm page cache;
  6.26 s on the first cold start of the day (b01).
- codeeval passed 1/8 on both stock and default with "no code block" on answers that finished normally: a harness
  or template interaction, not the tuning. Investigated in b09.
- b08-multi (4 × 64k + DFlash + ub 1024) **crashed**: `CUDA error: out of memory` in `cudaGraphInstantiate` under
  4 simultaneous 60k-token needle prompts (`runs/server-b08-multi.log`). Re-laid out in b09.

### 2026-11-23 12:10 b09 (`runs/batches/b09.*`): codeeval raw answers, multi-slot soak
- `runs/codeeval-raw-b09-default.json`: with thinking on, the answers are correct-looking **bare code with no
  ``` fence** (e.g. `def to_roman(n: int) -> str: …`), so `../scripts/codeeval.py`'s regex finds "no code block".
  With thinking off, one of three had a fence. The model, not the tuning: stock failed the same way. Scored both
  ways in b10 (`tools/codeeval_lenient.py`).
- Soak, 4 simultaneous long needle prompts (one per slot), `tools/soak.sh`:

| # | layout | needles | c4 aggregate decode (3 rounds × 4 × 256) | VRAM | verdict |
|---|---|---|---|---|---|
| 21 | 4 × 32k + DFlash, ub 512 (`-c 131072 -np 4`) | 4 × 30k: 3/3, 3/3, 3/3, 3/3 | **270.7** | 8,688 MiB | **ships as `multi`** |
| 22 | 4 × 64k, no drafter, ub 1024 | 4 × 60k: 3/3 ×4 | 164.6 | 8,908 | documented (`NB_CTX=262144 NB_SPEC=none`) |
| – | 4 × 64k + DFlash + ub 1024 (b08) | – | – | OOM | rejected |

  Per-request decode inside the soak is low (1.6–2.2 tok/s) for requests whose answer overlapped the others'
  60k/30k prefills: the slots share one GPU.


### 2026-11-23 12:20 b10 + b11: codeeval both ways, direct serve.sh gate
- b10 (`tools/codeeval_lenient.py`, temperature 0): default and stock identical. Thinking off: strict 7/8, lenient
  7/8. Thinking on: strict 1/8, lenient 6/8 (bare code accepted). Failures left: `lru` (both modes) and
  `parse_duration` (thinking on), answers mixing code and prose. Shared-harness note for the owner: `scripts/codeeval.py`
  only accepts ```-fenced blocks, which undercounts this model with thinking on (not edited; brief says report it).
- b11: `./serve.sh` launched directly (own `gpu_run`, lock held by llama-server for its lifetime), ready in 4 s
  (warm), "17 × 23" → "391" with reasoning separated, 289.7 tok/s on that short answer (175 drafted, 129 accepted).
