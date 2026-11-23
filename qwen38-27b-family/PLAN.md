# Qwen3.8-27B family tuning log

Hill-climb of four finetunes of the dense hybrid Qwen3.8-27B (64 layers, 3 Gated DeltaNet : 1 full attention, 262k
window) on one RTX 3060 12 GB + i5-12500 + 62 GB RAM, stock llama.cpp master 225a5345b. Tune on one member
(pi-adapted), then confirm the winning config on the other three with control/candidate/control A/Bs.
Method: [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill) by 0xSero /
Sybil Solutions: ceiling first, one change per config, a control on both sides, accept only if the candidate beats
both, gate on long-context retrieval and output quality.
Ceilings: `THEORY.md`. Raw data: `runs/ledger.jsonl` (server tests), `runs/server-*.log`, `runs/cmd-*.txt`
(exact command line of every server run). Configs: `configs/`.

## Targets and constraints

- Single user, coding and chat (pi-adapted is a coding-agent model). Metrics: c1 decode tok/s at empty context and
  deep in the window, prefill tok/s at ~8k / ~32k / near the served window, TTFT, startup.
- Context: a sensible default plus a long-context profile; find the largest stable window (needles 3/3 at ~50% and
  ~95%). The model's native window is 262,144.
- Memory: 12 GB VRAM with ~1 GB held by the desktop; every job through `gpu_run`; `GPU_RUN_MEM=44G` (layers kept in
  RAM are mmap'd and memcap counts page cache).
- Quality: lossless relative to the shipped GGUFs (no requantising); speculative decoding must stay correct on long
  answers (the qwen35-3d-coder recipe saw MTP loops on b12242 on a hybrid model; that question is open there).
- Every request caps `max_tokens`.

## Machine and software

- RTX 3060 12 GB (sm_86, driver 615.78.08), 342 GB/s measured VRAM bandwidth (`../qwen35-3d-coder/RESULTS.md`).
  i5-12500 (6 P-cores, 12 threads), 62 GB RAM, 57.1 GB/s RAM read at 6 threads (`../inkling-2-mini/THEORY.md`).
- llama.cpp master 225a5345b (build 12627), CUDA build in `/mnt/scratch/llama.cpp/master-225a5345b/bin`.
- Weights: `/mnt/models/llm/qwen38-27b-family/` (pinned revisions in `../notes/trending-batch-1-weights.tsv`).

## Experiments

### 2026-11-22

| # | Time | Change | Test | Result | Verdict |
|---|---|---|---|---|---|
| 0 | 22:36 | pi IQ3_XXS downloaded, sha256 matches the manifest (e48e3f68…) | | 11,425 MB; HF returned 502s for ~30 min mid-download, the shared downloader resumed | |
| 1 | 22:40 | What `--fit` picks (`runs/b01-fitparams.txt`, default 1 GiB margin) | llama-fit-params | f16 KV: 32k → `-ngl 49`, 128k → `-ngl 30`; q8_0 KV: 32k → `-ngl 53`, 128k → `-ngl 38` | fit keeps 12–16 whole layers in RAM at 32k |
| 2 | 22:41 | **Baseline: stock flags** (`-c 32768`, fit on → ngl 49, f16 KV, ub 512) | `tools/srvtest.py` pp 8k ×2, code decode ×6 × 256 | prefill **475** tok/s at 8k (TTFT 17.0 s), decode **7.93** tok/s (7.12–7.97); VRAM 10.8 GB | baseline |
| 3 | 22:47 | Placement sweep, llama-bench tg64 ×4 / pp512 ×2 (`runs/b02-*`) | what a GB in RAM costs | all on GPU: does not even allocate a 576-token context. FFN of layers 0–3 in RAM (0.41 GB): **16.47** tok/s, pp 610; layers 0–7 (0.82 GB): 13.80; `-ngl 57` (8 whole layers, 1.22 GB): 11.26; `output.weight` in RAM (0.87 GB, Q5_K): 13.52; ffn_down 0–7: 17.14; ffn_up 0–7: 17.53; `-t 12`: no change | **~29 ms per GB in RAM** (theory 14.6 at 57 GB/s: the CPU IQ3_XXS kernels run at ~31 GB/s). Same cost per byte for FFN, whole layers and the LM head, so the only lever is fewer bytes in RAM. Extrapolated all-GPU decode ≈ 20.5 tok/s (65% of the 31.7 ceiling) |
| 4 | 23:20 | Fit probes (`runs/b03-*`, load + one 2.3k-token request) | what loads | 32k q8_0 K/V: FFN 0–7 in RAM still fails (compute buffer, 269 MiB, does not fit after 9,356 + 1,088 + 150 MiB). **32k q4_0, FFN 0–3 in RAM: runs** (VRAM 11,923 of 12,288 MiB; 15.7 tok/s). 32k q4_0 FFN 0–1: fails. 64k q4_0 FFN 0–5: fails. 128k q4_0 FFN 0–13: fails (needs ~21). 262k q4_0 FFN 0–29: fails (K/V alone is 4.6 GB) | ~10.75–10.85 GB is usable for weights + K/V + state + compute; each 32k of q4_0 K/V costs ~6 FFN layers in RAM |
| 5 | 23:12 | Stretch: pi LoRA (`lora-hf/`, PEFT r32) converted with master's `convert_lora_to_gguf.py` (F16, 319 MB, 256 modules) and passed to the Kintsugi bundle's own server with `--lora` on its EXL3 weights (`tools/kintsugi_lora_serve.sh`, `runs/b04-*`) | load + 8 greedy prompts | without the LoRA: loads, 15.7–15.9 tok/s, sane output. With it: **does not load**: `LoRA tensor 'blk.0.ffn_down.weight' does not exist in base model`. The fork stores trellis tensors as `blk.N.ffn_*.escha_code` with no `.weight`, so llama.cpp's adapter loader finds nothing to attach to | **fails**; would need a fork change (LoRA matching escha tensors plus a matmul path that adds B·A on top of the trellis decode). Not attempted: the brief forbids modifying the bundle |
| 6 | 23:25 | Speculation on pi, 32k q4_0, with the fewest FFN layers in RAM that load (`runs/b05-*`) | load | control ffn4: 15.65 / 15.68 tok/s. MTP n=2 at FFN 0–5…0–9 and n=3 at 0–5…0–9: all OOM at load. DFlash2 (Kintsugi drafter, n 8) drafter on CPU at FFN 0–3…0–5 and on GPU at 0–13…0–17: all OOM | master **does** load the MTP head (`creating MTP draft context`) and accepts the Kintsugi DFlash2 drafter (arch `dflash`). What costs VRAM: speculation multiplies the DeltaNet state by n+1 (RS 150 → 449 MiB at n=2, 599 at n=3, 1,347 at n=8) and MTP adds its own K/V (128 MiB) and compute (130 MiB). Retry with more layers in RAM (b06) |
| 7 | 23:47 | Speculation again, with room (`runs/b06-*`): control / MTP n=1 / n=2 / control / MTP n=3 / DFlash2 n=3 / control, 32k q4_0, decode ×6 × 256 at empty context | decode median | controls (FFN 0–3 in RAM): **15.82, 15.81, 15.51**. MTP n=1 (needs FFN 0–9 in RAM): **15.36**, acceptance 97.7%, mean accepted length 1.98. MTP n=2 (FFN 0–11): **14.68**, 94.3%. MTP n=3 (FFN 0–13): **12.95**, 87.1%. MTP n=2 at FFN 0–10 and n=3 at 0–12 load, then crash on the first request (`h_nextn` buffer OOM → CUDA error). DFlash2 drafter on CPU at FFN 0–13: loads, every request fails (layer-input buffers OOM); drafter on GPU at FFN 0–23: does not load | **reject all speculation on this card.** The MTP head is excellent (≈2 tokens per step at n=1) but the step costs ~2× a single-token pass and the extra VRAM pushes 6–10 more FFN layers to RAM. Why the verify is so expensive: b08 |
| 8 | 00:12 | Context, K/V type and ubatch (`runs/b07-*`), each with the fewest FFN layers in RAM that load; pp 8k ×2, decode ×6 | medians | control 32k q4_0 ub512 FFN 0–3: 15.24 / 15.17 tok/s, pp 555 / 559. **ub 256** (compute buffer 268 → ~134 MiB, so FFN 0–2 fits): **16.43** (16.11–16.54), pp 541. 16k q8_0 ub512 FFN 0–2: 16.34, pp 563. 32k K q8_0 / V q4_0 FFN 0–6: 12.85. 64k q4_0 ub512 FFN 0–10: 11.81, pp 529. 128k q4_0 ub512: does not load even at FFN 0–23: the FA compute buffer grows with the window (827 MiB at 128k) | **accept ub 256** (+8% decode, −3% prefill; candidate min above both controls' max). Reject mixed K/V. 128k needs a smaller ubatch: b09 |
| 9 | 00:35 | Why the MTP step is expensive: llama-bench forward pass over 1–4 tokens, 32k q4_0 (`runs/b08-*`) | ms per pass | FFN 0–3 in RAM: 60.4 / 81.1 / 99.7 / 120.8 ms for 1/2/3/4 tokens. FFN 0–9 in RAM: 85.3 / 118.1 / 158.2 / 200.9 ms | each extra token in a verify costs ~20 ms with 0.4 GB in RAM and ~35–40 ms with 1.0 GB: the CPU IQ3_XXS matmuls are compute-bound, so the RAM part scales with the batch instead of being read once. Predicted MTP n=1 at FFN 0–9: (118 + 3.6 draft) / 1.98 ≈ 61 ms → 16.3 tok/s, measured 15.4. MTP only pays if it fits with few layers in RAM: retry at ub 256 (b10) |
| 10 | 00:55 | ub 256 at other windows (`runs/b09-*`) | medians | 32k ub256 FFN 0–2: **16.69 / 16.51** (repeat of #8's 16.43), pp 547. ub 128: does not load at FFN 0–1 (not tried further). 64k ub256: needs FFN 0–10 (FFN 0–9 loads, then fails on the first request): **11.93**, pp 483. 128k ub256: needs FFN 0–25: **7.46**, pp 401 | 128k fits only with ub 256; long profile = 128k q4_0 ub 256, FFN 0–25 in RAM |
| 11 | 01:14 | MTP with the ub-256 savings (`runs/b10-*`), control / MTP / control | medians | 32k: control 16.45 / 16.66, MTP n=1 (FFN 0–8) 16.03, accept 91%, pp −11%. **16k q4_0 ub256: everything fits on the GPU: 19.70 / 19.71 tok/s, pp 570.** 16k MTP n=1 (FFN 0–5): 19.64; MTP n=2 (FFN 0–6): 20.06 (16.77–20.64), accept 93%, pp 499 | **reject MTP**: at best +1.8% with a wider spread and −12% prefill. New `fast` profile: 16k, all on the GPU, 62% of the 31.7 tok/s ceiling |
| 12 | 01:20 | serve.sh profiles: default 32k q4_0 ub256 FFN 0–2 in RAM; fast 16k all on GPU; long 128k FFN 0–25. `Q38_FFN_CPU` sets the count per variant | | | |
| 13 | 01:54 | Measurement set, pi, tuned default (32k) and fast (16k) (`runs/b11-*`) | | default: pp 8k 543, pp 30k 487 (TTFT 62 s), decode 16.62 at empty, **13.76 at 30k**; needles 16k 3/3, 30k 3/3; codeeval 7/8 (lru: KeyError); refusal probe 17/20 "answered" by the script, 16/20 on reading (#12 is a refusal the regex missed). fast: pp 8k 570, 15k 549; decode 19.72 / 17.57 at 15k; needles 8k, 14k 3/3. RAM: VmHWM 11.6 GB (mmap'd file pages), cgroup peak 16.7–17.1 GB incl. page cache | qualifies |
| 14 | 02:35 | Measurement set, pi, long profile 128k (`runs/b12-*`) | | pp 8k 403, 32k 363, 120k 278 (TTFT 446 s at 124k); decode 7.48 at empty, **5.63 at 120k**; needles 65k 3/3, 123k 3/3; compute buffer 652 MiB at ub 256 | qualifies (slow: 2.6 GB of FFN in RAM) |
| 15 | 03:03 | MTP output check: greedy, 8 prompts × up to 1000 tokens, fast profile, no spec vs MTP n=2 (`runs/b13-*`, `runs/greedy/`) | token match | identical on 1/8; the other 7 diverge after 90–280 chars into equally coherent wording ("to control" → "to regulate"), and prompt 3 ends its tool call earlier. Longest answers 583 / 638 tokens, no loops or garbage. Speed 20.1–20.4 without MTP vs 15.9–21.5 with | MTP is not output-identical on master (the 3-token verify batch takes different kernels from single-token decode, so greedy ties flip); no correctness failure seen on long answers. Rejected on speed anyway (#7, #11) |
| 16 | 03:26 | heretic (`runs/b14-*`) | | fits loaded (3k probe) at FFN 0–7 default, 0–3 fast, 0–35 long. Tuned default: 12.42 / 12.43 tok/s, pp 449 / 450; **died at 30k** (`cudaGraphInstantiate` OOM). Control did not load: serve.sh passes `-ngl 99`, which stops `--fit` from moving layers (`n_gpu_layers already set by user`). fast 14.74, long 6.15 | invalid; fixed `tools/member.sh` (control uses `-ngl auto` like pi's baseline; fit search now needs a decode at 30k / 15k / 32k depth to pass) and re-queued as b17. heretic is slower than pi: its `output.weight` is BF16 (2.54 GB, read every token) |
| 17 | 04:19 | huihui on the tuned config (`runs/b15-*`), control (stock `--fit on`, f16, ub 512, 32k) / tuned / control | medians | its 10.4 GB file fits whole at 32k q4_0 ub256 (VRAM 11.2 GB): **20.85** vs controls **9.89 / 9.89** (2.1×), pp 8k 534 vs 468/471. Default: decode 16.57 at 30k, pp 30k 478, needles 16k/30k 3/3, codeeval 8/8, refusal 20/20 answered (read: all real answers, coherent). fast (16k) = same placement: 20.78. long 128k: FFN 0–21 in RAM, 9.42, deep decode at 32k checked | confirmed; huihui default and fast both all-on-GPU |
| 18 | 04:58 | daisyrose on the tuned config (`runs/b16-*`) | medians | fewest FFN layers in RAM that pass a deep request: default 0–6, fast 0–3, long 0–27 (its early layers are larger, Q5_K/IQ4_XS mixes). Control 8.19 / 7.87 vs **tuned 14.35** (1.8×), pp 8k 511 vs 464/461. Default: 12.23 at 30k, pp 30k 462, needles 16k/30k 3/3, codeeval 8/8. fast 16.54, long 7.41 | confirmed |
| 19 | 05:39 | heretic again (`runs/b17-*`) | medians | control (`-ngl auto --fit on`, f16) 6.96 / 6.97 vs **tuned (FFN 0–7) 12.44** (1.8×), pp 8k 453 vs 409. The measurement run at FFN 0–7 died again after the 30k prefill (`cudaGraphInstantiate` OOM) although the fit probe had passed one 30k request. fast (0–3) 14.80, long (0–35) 6.14 | speed confirmed; placement needs margin: b18 with FFN 0–9 / fast 0–4 / long 0–36. heretic's BF16 `output.weight` (2.54 GB) is why it is slowest |
| 20 | 06:19 | heretic with margin (`runs/b18-*`): default FFN 0–9, fast 0–4, long 0–36 | full set | default: 11.62 tok/s, 10.21 at 30k, pp 442 / 406, needles 16k/30k 3/3, codeeval 6/8, refusal 20/20 answered (read). fast: 14.23, 13.04 at 15k, needles 8k/15k 3/3. long: 6.18, 5.72 at 32k, needle 64k 3/3. No crash | confirmed; serve.sh uses these counts |

## STATUS (2026-11-23 06:30)

Plateau reached on pi: the last accepted change was ub 256 (#8); everything after it (MTP at three windows, DFlash2,
ub 128, mixed K/V) was rejected or did not fit, and the remaining gap to the ceiling is bytes in RAM at ~29 ms/GB,
which no flag removes. Tuned: q4_0 K/V, ub 256, the fewest FFN layers in RAM that survive a deep request.

Qualification gates (tuned default of each member; pi also fast and long):
- [x] Decode/prefill vs stock control, control / tuned / control: pi 2.10×, huihui 2.10×, daisyrose 1.79×, heretic 1.67×
- [x] Needles 3/3 at ~50% and ~95% of the window: all four at 32k; pi also 16k and 128k (123k); heretic also 16k and 64k
- [x] Stable through the whole measurement set (pp 8k/30k, 12 decodes, 2 needles, 8 codeeval, 8 greedy, 20 refusal prompts)
- [x] No garbage/NaN; zlib ratios 0.39–0.62 on all 106 decode samples of the final runs
- [x] codeeval: pi 7/8, huihui 8/8, daisyrose 8/8, heretic 6/8
- [x] Refusal probe read by hand: huihui 20/20 answered, heretic 20/20, pi (reference) 16/20
- [ ] KLD: not measured (no higher-precision file of these finetunes on disk; Kintsugi is the base model at 2.47 bpw)
- [ ] daisyrose and huihui `fast`/`long`: one deep decode + 6 empty-context decodes only, no needles
