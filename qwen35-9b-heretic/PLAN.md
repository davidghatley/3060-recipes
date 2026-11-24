# qwen35-9b-heretic: plan and experiment log

Model: DavidAU/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP-GGUF @ 4d47954f2,
`Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf` (8.76 GB, sha256 b54d045c…). Qwen3.5-9B hybrid
(32 layers, 3 Gated DeltaNet : 1 full attention, 262k native window) with one MTP layer (blk.32); Q6_K blocks with
a BF16 output head; DavidAU + Nightmedia multi-stage merge of Heretic'd Qwen3.5-9B finetunes.
Engine: llama.cpp master-225a5345b (stock). Port 8106. GPU via gpu_run, `GPU_RUN_MEM=24G`.
Method: [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill) by 0xSero /
Sybil Solutions: ceiling first, one change per config, a control on both sides, accept only if the candidate beats
both, gate on long-context retrieval and output quality. Ceilings: `THEORY.md`.

## STATUS (2026-11-23 15:05, done: hill-climb at plateau, gates run, docs written)
- Shipped (`serve.sh`): `default` = published file + its MTP head (n=2), 64k f16 K/V, 1 slot, ub 512;
  `fast` = local Q8_0-head copy (`tools/requant_head.sh`, KLD 0.0001) + MTP n=2, 128k q8_0; `nospec` = published,
  128k q8_0; `long` = published, 192k q4_0; `stock` = llama-server defaults.
- Qualified numbers: default (b13) 64.32 tok/s off / 61.51 thinking on / 49.93 at 60k vs stock (b08) 39.40 / 39.41 /
  31.47 at 63k; prefill 1,681 / 1,513 / 1,350 vs 1,787 / 1,624 / 1,438. fast (b07) 78.34 / 78.08 / 38.20 at 120k.
- Ceilings: plain 43.8 (stock at 90%); MTP n=2 at acceptance 0.85: 71.7 (default at 90%); fast 90.4 (87%).
- Limits: plain decode is at the bandwidth wall (7.81 GB per token, 26% of it the BF16 head); MTP is capped by
  acceptance (0.79–0.85) and by each draft re-reading the head; deep in the window the flash-attention path over
  the 8 full-attention layers (especially quantized K/V in the 3-token verify, b11) costs more than the bytes say.
  VRAM (12 GB with ~1 GB desktop) caps the window: 64k f16 / 96k q8_0 with MTP on the published file.
- Remaining levers (ranked): a vocabulary-pruned or Q8_0 head for the MTP draft only, leaving the target's BF16 head
  (engine work; most of `fast`'s gain without touching the target, est. +10–15%); faster quantized-K/V flash
  attention for small verify batches (engine; +19% deep per b11); `fast` at f16 K/V (measure; smaller window);
  4-slot profile if a card with more free VRAM is available (2.4× aggregate measured, b12).

### Gate checklist
| Gate | Result | Evidence |
|---|---|---|
| Loads via `./serve.sh`, chat answer correct, reasoning in `reasoning_content` | pass ("391", 860 reasoning chars, 64.0 tok/s) | b12 (direct `./serve.sh`, its own `gpu_run` lock) |
| Holds the GPU lock while serving, releases on stop | pass | `runs/batches/b12.log` |
| Needles ~50% / ~95%, every profile | 3/3 / 3/3 (default 32.8k/61.8k, fast 65.9k/124.5k, nospec, long 98.5k/186.0k, stock, 96k q8_0) | b06–b09, b13 |
| MTP long-answer quality (the b12242 failure mode) | pass: same finishes and no loops with/without MTP (6 prompts, 10k cap); 24k answer coherent | b02, b03, b10, `runs/longans/` |
| Greedy equivalence | MTP vs no spec 3/3 (off) and 3/4 (thinking on, near-tie divergence); ub 1024 and `-bs` 3/3 | `runs/greedy/` |
| No garbage / loops / NaN | zlib 0.27–0.64 over 322 answers; no failed requests outside load probes | `runs/ledger.jsonl` |
| codeeval | default 5/8 = stock 5/8; fast 6/8; all answers fenced (strict = bare-code-accepted) | b06–b08, b13 |
| Refusal probe (uncensored) | 20/20 answered thinking off; thinking on 17 answered, 3 empty (cap), 0 refused; no base on disk | b10 |
| Speed vs controls, medians of 6, control/candidate/control | yes for every accepted lever | b01, b04, b05, b11 |
| KLD | lever-vs-published only (no higher-precision reference on disk): Q8_0 head 0.00009/0.00004, q8_0 K/V 0.0004/0.0013, q4_0 0.0026/0.0073 | b04, b05, `runs/kld/` |
| VRAM / RAM within caps | default 11.40 GB card; cgroup peak 9.37 GB under 24G | b13 |

## Targets and constraints
- Everything in VRAM on the RTX 3060 12 GB (desktop holds ~1 GB). Single user (c1) first; parallel slots only if useful.
- Metrics: c1 decode at empty and deep context, prefill 8k/32k/near-window, TTFT, startup, VRAM/RAM peak.
- Window: as large as fits and passes needles at ~50%/~95%.
- Quality: lossless levers by default. MTP must keep long answers intact (it broke them on b12242 for the
  same family, `../qwen35-3d-coder/RESULTS.md`), checked with `tools/longans.py` (thinking on, 10k cap, loops/garbage
  flagged, answers read by hand). K/V quantization and any head requant are labelled lossy.

## Log

### 2026-11-23 setup
- Weights `readlink -f` = /mnt/models/llm/qwen35-9b-heretic/Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-Q6_K.gguf
  (Micron NVMe, not a symlink). Header: `runs/gguf-info.txt`.
- Card read (data only): thinking general temp 1.0 / top-p 0.95 / top-k 20 / min-p 0 / no penalties (serve.sh
  default); repetition penalty must stay 1 with MTP; "if 2-token acceptance falls below 50%, use the regular quants".
  The card gives no llama.cpp MTP flags.
- No base Qwen3.5-9B GGUF and no higher-precision copy of this model on disk: no base refusal comparison, KLD not
  measured (nothing downloaded).

### 2026-11-23 11:40–12:08 b01 (`runs/batches/b01.{sh,log}`): baseline, controls, MTP n=1/2/3
Decode = median of 6 × 256 tokens (thinking off) and 6 × 512 (thinking on, `-think`); prefill = median of 2 cold 8k
prompts. Controls: 32k f16 K/V, fa on, np 1, ub 512. Order stock, ctl-a, mtp2, ctl-b, mtp1, mtp3, ctl-c.

| # | config | pp 8k | decode d0 off | d0 think | accept off/on | VRAM (card, desktop incl.) | verdict |
|---|---|---|---|---|---|---|---|
| 1 | stock (no -c/-ngl/-np: fit gives 4 slots × 69,376 unified, all on GPU, fa auto) | 1,811 | 39.47 | 39.40 | – | 10,976 MiB | baseline; first start 8.3 s (cold page cache) |
| 2 | ctl-a | 1,768 | 39.41 | 39.31 | – | 9,646 | = stock (90% of the 43.8 ceiling) |
| 3 | **MTP n=2** | 1,669 (−6%) | **64.51** (56.3–67.7) | **61.26** (57.7–65.3) | 0.86 / 0.78 | 10,196 | **+64% / +56%**, min above every control's max |
| 4 | ctl-b | 1,767 | 39.27 | 39.10 | – | 9,646 | |
| 5 | MTP n=1 | 1,667 | 55.93 | 53.18 | 0.91 / 0.82 | 10,146 | below n=2 |
| 6 | MTP n=3 | 1,662 | 60.26 | 60.15 | 0.72 / 0.72 | 10,246 | below n=2 (more spread) |
| 7 | ctl-c | 1,764 | 39.05 | 39.02 | – | 9,646 | controls drift −0.9% over 25 min |

- Greedy (temperature 0, 3 prompts × 200 tokens) vs ctl-a: MTP n=1 3/3, n=2 3/3, n=3 2/3 identical; ctl-b 3/3.
- MTP n=2 at 64.5 is 90% of its bytes-only ceiling at a = 0.86 (THEORY: 12.27 GB per step / 2.60 tokens → 72).
- Next: MTP n=2 is the candidate default **only if long answers survive** (b02 `tools/longans.py`, then the same
  prompts without MTP in b03). Window probes in b02. CPU: Q8_0-head local copy (`tools/requant_head.sh`, lossy, labelled).

### 2026-11-23 12:08–12:17 b02 (`runs/batches/b02.{sh,log}`): window probes, long answers with MTP n=2
| # | config | result | verdict |
|---|---|---|---|
| 8 | MTP n=2, 128k q8_0 | MTP draft context's own K/V (512 MiB) fails to allocate (`runs/server-b02-mtp-128k-q8.log`) | too big with MTP |
| 9 | MTP n=2, 256k q4_0 / no spec 256k q4_0 | compute buffer 1,344 MiB fails to allocate (ub 512) | retry ub 256 (b04) |
| 10 | no spec, 256k q8_0 | K/V 4,352 MiB fails | no |
| 11 | MTP n=2, 64k f16 | loads, **11,376 MiB card** (~0.9 GB left), pp 3k 1,681, decode 64.29 (accept 0.88) | fits, tight; 96k q8_0 / 128k q4_0 probed in b04 |
| 12 | **Long answers, MTP n=2** (32k f16; 6 prompts, thinking on, card sampling, 10k cap; `runs/longans/longans-b02-mtp2.json`) | 5/6 stopped, 1 hit the cap (the marble probability problem: 10k tokens of coherent case analysis, still working, z = 0.37); **no loops** (z 0.29–0.61, no repeated lines), no garbage. 45–62 tok/s, acceptance 0.46 (prose explainer) – 0.82 (code). Read by hand: the three.js page is complete to `</html>`; the story has title, scenes and an ending; the ledger CLI is complete but has no unittest class (asked for) | MTP passes this check so far; same prompts without MTP in b03 |

### 2026-11-23 12:17–12:30 b03 (`runs/batches/b03.{sh,log}`): the same long answers without speculation
| # | config | result | verdict |
|---|---|---|---|
| 13 | **Long answers, no spec** (`runs/longans/longans-b03-nospec.json`) | 5/6 stopped, the marble problem hit the 10k cap again (same behaviour), no loops (z 0.18–0.58), 38.6–39.2 tok/s. This time the ledger CLI has its unittest class | **MTP n=2 and no-spec behave alike on long answers** (b02 vs b03: same finishes, same z range, no loops either way). Unlike `../qwen35-3d-coder` on b12242, master-225a5345b shows no MTP breakage here; a 24k-cap recheck runs with the gates |

### 2026-11-23 12:31–12:43 b04 (`runs/batches/b04.{sh,log}`): window probes, Q8_0 output head, KLD
Local copy `tools/requant_head.sh` (llama-quantize from master-29b52d398, `--output-tensor-type q8_0`; every other
tensor keeps its type and is copied unchanged, checked by comparing the two headers): 7.43 GiB vs 8.34 GiB, 48 s CPU,
at `/mnt/scratch/tmp-qwen35-9b-heretic/Qwen3.5-9B-Defiant-Fable-Heretic-MTP-Q6_K-headQ8_0-local.gguf`.

| # | config | result | verdict |
|---|---|---|---|
| 14 | MTP n=2, 96k q8_0 | loads, 11,514 MiB card | fits, ~0.8 GB left |
| 15 | MTP n=2, 128k q4_0 | loads, 11,344 MiB | fits |
| 16 | no spec, 128k q8_0 / 192k q4_0 | load, 11,348 / 11,220 MiB | fit |
| 17 | no spec, 256k q4_0 ub 256 | compute buffer 1,184 MiB fails (ub 512: 1,344) | 256k does not fit with the BF16 head |
| 18 | ctl-a / ctl-b (no spec, 32k f16) | 39.43 / 39.42 off, 39.41 / 39.42 think; pp 8k 1,776 / 1,766 | |
| 19 | **Q8_0 head, no spec** (lossy, labelled) | **44.33 / 44.19** (+12.4%), pp 1,768 (=), card 8,728 MiB (−920) | **beats both controls (min > max)**; 89% of its 49.9 ceiling |
| 20 | MTP n=2 / MTP n=2 (b), published file | 64.57 / 62.94 off, 61.74 / 60.49 think, accept 0.86 / 0.82 | reproduces b01 |
| 21 | **Q8_0 head + MTP n=2** | **76.26 off (68.0–84.2), 77.56 think**, accept 0.78 / 0.80, card 9,288 MiB | **+18% / +26%** over both MTP controls |
| 22 | KLD vs the published file (`runs/kld/summary.txt`; llama-perplexity, 16 × 512-token chunks, wikitext-2 test / code text) | Q8_0 head: mean KLD **0.000093 / 0.000038**, same top token 99.36% / 99.76%, PPL ratio 1.0017 / 1.0002. q8_0 K/V: 0.00036 / 0.0013, top 99.02% / 99.04% | the head change is ~4× smaller than q8_0 K/V, and ~1/800 of the card's own Heretic-vs-original KLD (0.079) |

### 2026-11-23 12:44–12:53 b05 (`runs/batches/b05.{sh,log}`): windows with the Q8_0 head, ubatch, `-bs`, q4_0 K/V KLD
| # | config | result | verdict |
|---|---|---|---|
| 23 | Q8_0 head + MTP n=2, 128k q8_0 | loads, 11,456 MiB, decode 78.1 | fits (the published file's 512 MiB MTP K/V did not) |
| 24 | Q8_0 head + MTP n=2, 192k q4_0 | loads, 11,650 MiB | too tight to ship (~0.6 GB left with the desktop) |
| 25 | Q8_0 head, no spec, 256k q4_0 | loads, 11,206 MiB, decode 44.14 | the full native window fits only with the Q8_0 head |
| 26 | Q8_0 head + MTP n=2, 256k q4_0 | MTP K/V 1,024 MiB fails | no |
| 27 | MTP controls a / b / c (32k f16) | 60.77 / 64.85 / 61.85 off, 61.68 / 61.39 / 61.55 think; pp 1,686 / 1,666 / 1,665 | MTP spread is ±4% sample to sample |
| 28 | MTP + ub 1024 | pp 8k **1,711.5** (+2.7% vs the mean of its neighbours), decode 63.13 / 62.42 (inside the controls), +234 MiB | real but small; rejected for the default (the VRAM buys window instead) |
| 29 | MTP + `-bs` (backend sampling) | 62.92 / 60.73, pp 1,664 | inside noise: rejected |
| 30 | KLD q4_0 K/V | mean 0.0026 / 0.0073, same top 97.5% / 97.4% (q8_0: 0.00036 / 0.0013, 99.0%) | q4_0 costs ~7× q8_0's KLD: used only for the long profile |
- Greedy vs mctl-a: ub 1024 3/3, `-bs` 3/3; MTP vs b01 no-spec control 3/3 identical.
- Profiles set from this (serve.sh): `default` published file + MTP n=2, 96k q8_0 (row 14); `fast` Q8_0 head + MTP
  n=2, 128k q8_0 (row 23); `nospec` published, 128k q8_0 (row 16); `long` published, 192k q4_0 (row 16).
  Measurement sets: b06 default, b07 fast, then nospec/stock/long, refusal probe, 24k-cap MTP long answers.

### Interim STATUS (2026-11-23 12:55, hill-climb at plateau; measurement batches running)
- Levers measured: MTP n=1/2/3 (n=2 accepted, +56–64%), Q8_0 output head (accepted as the labelled `fast`
  profile: +12% plain, +18–26% with MTP, KLD 0.0001), K/V type (q8_0 for windows; q4_0 only for `long`), ubatch 1024
  (+2.7% prefill, rejected for VRAM), `-bs` (noise), fit/np defaults (= control). Three consecutive levers inside
  noise or rejected (ub 1024, `-bs`, q4_0): plateau.
- Plain decode 39.4 = 90% of the 43.8 ceiling; Q8_0 head 44.3 = 89% of 49.9. MTP n=2 ~63 = ~87% of its
  bytes-only ceiling at the measured acceptance.

### 2026-11-23 12:56–13:18 b06, b07: measurement sets for `default` and `fast` (`tools/measure.sh`)
| profile | pp 8k / 32k / near | decode d0 off / think / near | needles ~50% / ~95% | codeeval | card | startup |
|---|---|---|---|---|---|---|
| default (96k q8_0, MTP n=2) | 1,688 / 1,506 / 1,191 (90k) | 62.59 / 61.20 / **37.16** (90k) | 3/3 (48.7k) / 3/3 (92.3k, TTFT 78.1 s) | 6/8 (lru, topo fail) | 11,530 MiB | 1.13 s |
| fast (Q8_0 head, 128k q8_0, MTP n=2) | 1,672 / 1,494 / 1,074 (120k) | 78.34 / 78.08 / **38.20** (120k) | 3/3 (65.9k) / 3/3 (124.5k, TTFT 117.3 s) | 6/8 (same two) | 11,474 MiB | 1.07 s |
- Deep in the window MTP keeps little of its gain (37–38 tok/s, acceptance unchanged at 0.77–0.83), close to the
  plain ceiling at that depth (THEORY: 36–38). Hypothesis: the 3-token verify batch over **quantized** K/V takes
  llama.cpp's non-vector flash-attention path, which converts K/V to F16 every step. b11 tests it (58k, MTP vs no
  spec × f16 vs q8_0).
- codeeval failures are the same two tasks in both (an `lru` node class with `__slots__` and a wrong topological
  order); all 8 answers fenced, so no bare-code rescoring was needed.

### 2026-11-23 13:18–13:58 b08, b09: stock baseline, `nospec`, `long`
| profile | pp 8k / 32k / near | decode d0 off / think / near | needles ~50% / ~95% | codeeval | card | startup |
|---|---|---|---|---|---|---|
| stock (fit: 4 slots, 69,376 unified f16) | 1,787 / 1,624 / 1,438 (63k) | 39.40 / 39.41 / 31.47 (63k) | 3/3 (34.7k) / 3/3 (65.7k, TTFT 45.9 s) | 5/8 | 10,976 MiB | 1.45 s (8.3 s cold in b01) |
| nospec (128k q8_0) | 1,767 / 1,601 / 1,173 (120k) | 39.32 / 39.25 / 24.64 (120k) | 3/3 (65.9k) / 3/3 (124.5k, TTFT 107.2 s) | – | 11,372 MiB | 1.09 s |
| long (192k q4_0) | 1,752 / 1,599 / 996 (180k) | 39.33 / 39.26 / 20.17 (180k) | 3/3 (98.5k) / 3/3 (186.0k, TTFT 188.6 s) | – | 11,244 MiB | 1.07 s |
- b07's hypothesis is wrong: plain decode deep in the window is itself far below its bandwidth ceiling (24.6 at
  120k = 72% of 34.4; 31.5 at 63k f16 = 90% of 35), so MTP still adds +55% there (fast 38.2 vs nospec 24.6 at 120k).
  Long-context decode is limited by the flash-attention kernel over the 8 full-attention layers, not by MTP. b11
  still separates f16 from q8_0 at 58k.

### 2026-11-23 14:00–14:41 b10: refusal probe and 24k-cap long answers (default profile, MTP n=2)
- Refusal probe (`../scripts/refusal_probe.py`, 20 prompts, temperature 0). Thinking off, 400 tokens
  (`runs/refusal-b10-think-off.json`): **answered 20/20, refused 0**. Every answer read: each one does what was asked
  (roast, lock picking steps, explicit-scene opening, villain monologue, ransom note, moonshine history, the chemical
  mixing list, a blunt chest-pain answer that starts "I'm not a doctor" and then answers). Thinking on, 3000 tokens
  (`runs/refusal-b10-think-on.json`): answered 17/20, refused 0, **3 empty** (pirate insult, dark joke, swearing:
  the reasoning was still running at the 3000-token cap, 10–12k characters; not refusals). No base Qwen3.5-9B file on
  disk, so no base comparison (the card reports 6/100 refusals vs 100/100 for the original, its own probe).
- Long answers with a 24k cap (`runs/longans/longans-b10-*.json`): the marble problem used all 24,000 tokens
  (52.1 tok/s, acceptance 0.68), still a coherent, non-repeating case enumeration at the end (z 0.31, read by hand;
  without MTP it also hit the 10k cap in b03, so this is the model over-thinking a hard problem, not MTP). The
  three.js page finished at 5.0k tokens, complete to `</html>` (58.8 tok/s).

### 2026-11-23 14:42–14:49 b11: MTP deep in the window, f16 vs q8_0 K/V (58k context, 64k window, ×6)
| config | decode at 58k | accept | card |
|---|---|---|---|
| no spec, q8_0 | 30.74 | – | 9,952 MiB |
| MTP n=2, q8_0 | 44.68 (36.9–46.5) | 0.81 | 10,650 |
| **MTP n=2, f16** | **52.49** (45.9–56.6) | 0.80 | 11,390 |
| no spec, f16 | 32.20 | – | 10,692 |
| MTP n=2, q8_0 (b) | 43.42 (38.3–47.3) | 0.77 | 10,650 |
- With MTP, f16 K/V is **+19%** at 58k over the median of both q8_0 runs (the ranges touch at the edges: f16 min
  45.9, q8_0 maxima 46.5 / 47.3); without MTP only +5%. The 3-token verify over quantized K/V is the slow part (b07's
  hypothesis holds for the K/V type, though plain decode deep in the window is also below its ceiling).
- **Default changed** to the published file + MTP n=2 at **64k f16** (lossless K/V, faster deep, 11.39 GB): b13
  measures it. The 96k q8_0 layout (b06) stays available as `QH_CTX=98304 QH_KV=q8_0`.

### 2026-11-23 14:48 b12: `./serve.sh` as a user starts it, 4 slots
- Direct `./serve.sh` (its own `gpu_run`), via `../scripts/with_server.sh`: ready in 4 s, `gpu_run --status` showed the
  lock held by its llama-server; "What is 17*23?" → `'391'`, 860 reasoning characters in `reasoning_content`, 64.0
  tok/s; lock free after stop.
- 4 slots × 128k q8_0 no spec: compute buffer (608 MiB) does not allocate.
- 4 slots × 24k (96k q8_0 unified) with MTP n=2 (`tools/concurrent.py`, 3 rounds × 4 coding prompts × 256 tokens):
  **149.2 tok/s aggregate** vs 62.0 for one request on the same server (2.4×), but 11,842 MiB on the card (~0.4 GB
  left with the desktop). Not shipped as a profile; noted in RESULTS as an option.

### 2026-11-23 14:50–14:59 b13: measurement set for the revised default (64k f16, MTP n=2)
| profile | pp 8k / 32k / 60k | decode d0 off / think / 60k | needles | codeeval | card | startup |
|---|---|---|---|---|---|---|
| default (b13) | 1,681 / 1,513 / 1,350 | 64.32 / 61.51 / **49.93** | 3/3 (32.8k) / 3/3 (61.8k, TTFT 46.1 s) | 5/8 (stock 5/8) | 11,404 MiB | 1.11 s |
- Greedy thinking on (4 prompts × 600 tokens) MTP vs no spec at this layout: 3/4 identical, prompt 2 diverges at
  character 1,946 into a different coherent sentence.
- Deep decode with f16 K/V: 49.93 at 60k vs 37.16 at 90k q8_0 (b06) and stock's 31.47 at 63k: confirms b11.
