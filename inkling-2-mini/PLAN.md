# Inkling-2-Mini tuning log

Hill-climb of thinkingmachines/Inkling-2-Mini serving speed on one RTX 3060 12 GB + i5-12500 + 62 GB DDR5, llama.cpp master.
Method: [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill) by 0xSero / Sybil Solutions. Compute the ceiling first, change one thing per run, run a control on both sides, accept only if the candidate beats both controls, gate on long-context retrieval.
Ceilings: `THEORY.md`. Raw data: `runs/ledger.jsonl` (server tests), `runs/bench-*.jsonl` (llama-bench), `runs/server-*.log`. Configs: `configs/`.

## Targets and constraints

- Single user, coding and chat. Metrics: c1 decode tok/s, prefill tok/s on coding prompts (8k / 32k), at 0 and 32k depth.
- Context: 64k must be stable (needles at ~50% and ~95%); 128k is a stretch goal.
- Memory: 12 GB VRAM shared with other projects (every job through `gpu_run`); RAM cap `GPU_RUN_MEM=44G` (page cache counts).
- Quality: lossless relative to the IQ4_NL baseline, or a labelled trade with KLD vs Q8_0 measured.
- Every request caps output tokens (the model card warns of long reasoning loops).

## Machine and software

- RTX 3060 12 GB (sm_86, driver 615.78.08), 342 GB/s measured VRAM bandwidth; i5-12500 6P/12T; 62 GB RAM.
- RAM read bandwidth 2026-11-20: 25.3 GB/s (1 thread), 48.3 (4), **54.2 (6)**, 53.5 (8), 52.4 (12) (`runs/membw.txt`, `../flint/tools/membw.c`; a download was running).
- llama.cpp master at 29b52d398 (the Inkling 2 Mini merge, #32694), built in `/mnt/scratch/llama.cpp/master-29b52d398/` with CUDA 12.9, sm_86, from the conda env `/mnt/scratch/envs/llama-build-cuda` (`/mnt/scratch/llama.cpp/build-master.sh`).
- Weights (`/mnt/models/llm/inkling-2-mini/`): ggml-org/Inkling-2-Mini-GGUF @ db61c5b4 (IQ4_NL, Q8_0, mmproj Q8_0, imatrix).

## Experiments (2026-11-20)

| # | Change | Test | Control(s) | Candidate | Verdict |
|---|---|---|---|---|---|
| 0 | Smoke: IQ4_NL, `-ot exps=CPU`, ctx 16k, + mmproj Q8_0 | chat / math / code / one image (`tools/smoke.py`) | | text OK ("ok", 391, correct `is_palindrome`); **image answer is all "????"** (image encodes to 49 tokens in 376 ms) | text pass, image open (see notes) |
| 1 | Where the VRAM goes (`tools/bufprobe.sh`, `runs/membuf/`) | CUDA0 compute buffer at load, `-ot exps=CPU` | | 7172 MiB at ctx 4k ub 512; 8364 at 16k/512; 7148 at 16k/128; 8345 at 32k/256. With `--no-op-offload`: **587** at 4k/512, 444 at 16k/128, 1632 at 64k/128, 6527 at 64k/512 | two causes, see notes |

### Notes

- **#1 compute buffer.** Two parts.
  - ~6.7 GB fixed: op-offload staging. llama.cpp copies the RAM-resident expert tensors to the GPU for batches ≥ 32 tokens (fast prefill), and the scheduler reserves room for those copies in the compute buffer. `--no-op-offload` removes it (prefill of RAM experts then runs on the CPU).
  - ~190 B × n_kv × ubatch: the relative-position bias. Inkling has no RoPE; each head gets its own additive bias, so the attention mask is materialised as n_kv × n_tokens × 24 heads (F32 gather, F32 add, F16 copy for flash attention). At 64k and ub 512 that alone is ~6.4 GB.
  - So the brief's baseline (64k, ub 512, op offload on) cannot load on 12 GB. 64k needs `--no-op-offload` or a small ubatch, and the core-on-GPU placement (6.4 GiB of experts) needs both.
  - Engine patch (`inkfix-4c836a8eb`, branch `inkling-loop-scale-fix` in `/mnt/scratch/llama.cpp/src-inkfix`): write the permuted bias straight to F16 and add the F16 mask without F32 intermediates. Expected peak 8 → 6 B per element.
- **NVFP4 repack** (`tools/repack_nvfp4.py`): `own/Inkling-2-Mini-NVFP4.gguf`, 17.6 GB. The checkpoint's own NVFP4 experts of layers 0–19 (bit-exact nibbles and E4M3 sub-scales, per-expert `.scale` = amax / outer denominator); everything else copied from the IQ4_NL file. Dequantised check against the Q8_0 GGUF: worst relative L2 0.0064 over all 40 tensors (Q8_0's own rounding of the same values), `runs/repack-nvfp4.log`. Needs the inkfix build (stock master drops the per-expert scales of loop passes 2–3).
| 2 | Baseline (`configs/00-baseline.json`): stock master, `-ot exps=CPU`, op offload on | llama-bench tg64 ×6, pp2048 | | **tg 17.67 ± 0.06**, pp2048 333 (ub 512) / 363 (ub 2048) | baseline: 68% of the ~26 tok/s ceiling |
| 3 | Loop-core experts (layers 6–17) on GPU, `--no-op-offload` (needed to fit) | llama-bench tg64 ×6, pp512 | `exps=CPU` + nopo: tg 17.61 / 17.60, pp 41.7 / 41.0 | **tg 29.67 ± 0.04**, pp512 151; peak 9.9 GB VRAM incl. desktop | **accept** (+68% decode). Without op offload, prefill of RAM experts runs on the CPU: 42 tok/s all-RAM |
| 4 | Fit 64k with the core on GPU (`runs/membuf/summary5-core.txt`, `summary6-core-opoff.txt`, inkfix build) | VRAM at load | | 64k f16 KV ub 128: OOM. **64k q8_0 KV ub 128: model 7826 + KV 1088 + SWA 106 + compute 1391 MiB (op offload on) = 10.4 GB**, fits. ub 256: OOM. 128k q8_0 ub 128: OOM | 64k needs q8_0 KV and ub 128 with this placement; 128k does not fit with all 12 core layers on GPU |
| 5 | Op offload back on with the core on GPU (staging is only for the 12 RAM layers now) | llama-bench, core, q8_0 KV, ub 128 | nopo: pp2048 131.6, tg 29.40 | **op offload on: pp2048 175.3**, tg 29.40 | **accept** (+33% prefill, decode same) |
| 6 | Threads 4/5/8/10/12 (control 6 at both ends) | llama-bench tg64 ×6 | t6: 29.33 / 29.18 | t4 27.56, t5 28.68, t8 29.49, t10 29.10, t12 27.88 | reject: t8 is +0.8%, inside noise; keep 6 |
| 7 | **Correctness check of prefill** (llama-perplexity, wiki 3×512, IQ4_NL, `runs/nanprobe/summary.txt`) | PPL finite? | | `exps=CPU` + op offload: **NaN** (stock and inkfix, ub 512 and 64). `exps=CPU` + nopo: 6.007. Core on GPU + op offload: 6.030. Core + nopo: 6.013. Layers 18–19 on GPU, core in RAM, op offload: **NaN** | **bug**: op offload of loop-core experts held in RAM gives NaN. Voids #2's prefill numbers (333/363 measured garbage) and explains #0's "????" image answer (the 49-token image batch takes the offload path). The tuned placement (core on GPU) is unaffected |

- **#7 op-offload NaN.** Any batch of ≥ 32 tokens (the CUDA op-offload threshold) that runs a loop-core layer (6–17) whose experts sit in RAM comes out NaN. Only the core layers are affected: with layers 0–5 and 18–23 in RAM the result is fine. Those layers are aliased across the three passes (`layers[il] = layers[layer_phys(il)]`), so the scheduler stages the same host weight for several splits. The likely cause is a staged copy being reused after its compute-buffer slot was recycled; not fixed here. Workarounds: keep the core experts on the GPU (the tuned config does), or pass `--no-op-offload`. Decode (batch 1) never offloads, so every tg number stands. The honest baseline prefill is the nopo figure, **41.7 tok/s** (#3 control).
| 8 | KLD vs Q8_0 (`tools/kld.sh`, wiki 24×512 + CPython-stdlib code 24×512, all `-ot exps=CPU --no-op-offload`, inkfix build; `runs/kld/summary.txt`) | mean KLD / same top token | IQ4_NL: wiki **0.0085** / 95.5%, code **0.0088** / 97.5% | **NVFP4 repack: wiki 0.0029 / 97.7%, code 0.0044 / 98.2%** | NVFP4 is ~2–3× closer to Q8_0 (ggml-org's Q8_0 is itself 0.0030 from BF16) |
| 9 | unsloth UD-IQ3_XXS / UD-Q3_K_XL (@29eac40c) | load | | `llama_model_load: error loading model: check_tensor_dims: tensor 'blk.24.attn_q.weight' not found`. They are a pre-merge conversion: arch `inkling2`, `block_count 48` (loop unrolled), vs master's `inkling2_loop` with 24 | **fail to load on master 29b52d398**; recorded, moved on |
| 10 | NVFP4 repack instead of IQ4_NL (same bytes), core on GPU, q8_0 KV, ub 128 | llama-bench tg64 ×6, pp2048 | IQ4_NL: tg 29.07 / 29.02, pp 174.6 / 174.3 | tg **27.13**, pp 162.8 | −6.6% decode, −7% prefill for ~3× lower KLD: a labelled trade, not a speed win |

- **#9 unsloth layout.** Their experts are mixed: NVFP4 `down_exps` with per-expert `.scale` in layers 0–19 and IQ2_XXS…IQ3_XXS `gate_up` (UD-IQ3_XXS: core experts 4.88 GiB, all experts 9.59 GiB, `runs/gguf-layers-unsloth-nvfp4.txt`). Even with a converter fix, stock master would drop the `.scale` of loop passes 2–3 (the bug fixed on the inkfix branch).
| 11 | **Tuned server** (`serve.sh` defaults: inkfix build, IQ4_NL, core on GPU, q8_0 KV, ub 128, b 2048, 64k, op offload on) | `tools/srvtest.py` ×3: pp 8k / 32k, coding decode at depth 0 / 32k, needles at 32k and 62k | | decode **29.0** (0k), 23.7 (32k); prefill **144.6** (8k), 123.3 (32k), 103 (62k); **needles 3/3 at 32k and 3/3 at 62k**; llama-server 10.6 GB VRAM (11.6 GB on the card incl. desktop) | passes the 64k gate |
| 12 | Baseline server (stock master, `exps=CPU`, f16 KV, ub 512, 64k, `--no-op-offload` because of #7) | `srvtest.py` ×3: pp 8k, coding decode at depth 0 | | decode **17.5**, prefill **39.1** (8k), 11.2 GB on the card | baseline for RESULTS.md |
| 13 | Smoke + image on the tuned config (32k, mmproj Q8_0), IQ4_NL and NVFP4 | `tools/smoke.py --image` | #0 ("????") | both: "ok", 391, correct `is_palindrome`, image described correctly ("A vertical red and blue split background with a white square centered across the dividing line.") | image fixed by keeping the core on GPU (#7) |
| 14 | Capped coding eval (`tools/codeeval.py`: 8 Python tasks run against asserts, T 0, effort low, max 2048) | pass count | | IQ4_NL **8/8**, NVFP4 **8/8**, every answer `finish=stop` | no visible quality gap at this size; KLD (#8) is the finer measure |
| 15 | 128k (`INK_PROFILE=128k`): core layers 16–17 to RAM, ub 64, `--no-op-offload`, q8_0 KV (`runs/membuf/summary7-128k.txt`) | srvtest: pp 8k ×2, decode 0k ×2, needles 64k and 124k | 64k config (#11) | fits (model 6.7 + KV 2.2 + compute 1.2 GB). Decode 26.1 (0k), 18.7 (64k), 14.6 (124k); prefill 85.2 (8k), 56.2 (124k); **needles 3/3 at 64k and 3/3 at 124k** | **passes the 128k stretch gate**; opt-in profile |

## STATUS (2026-11-20)

- **Best: `serve.sh` defaults.** Decode 29.0 tok/s (baseline 17.5, 1.66×), prefill 145 tok/s at 8k (baseline 39.1, 3.7×). 64k with needles 3/3 at 32k and 62k. 10.6 GB VRAM. KLD vs Q8_0 0.0085 (IQ4_NL); the opt-in `INK_QUANT=nvfp4` gives 0.0029 at −7%.
- **Ceiling.** ~50 tok/s for this placement: 0.56 GB of RAM reads + 3.45 GB of VRAM reads per token. 29.0 is 58% of it.
- **What limits further gains.** VRAM: the last ~0.4 GB of the card is all that is free at 64k, so no more experts move to the GPU. The remaining time per token splits between the CPU part (12 RAM layer applications, ~10 ms at bandwidth) and 48 GPU layer applications with small kernels.
- **Open levers, ranked:**
  1. Fix the op-offload NaN in ggml-backend's scheduler. It would put the 128k profile back on op offload (+~40% prefill there) and make the all-RAM baseline usable.
  2. Key the MoE cache by physical layer rather than by slot. Each core expert is otherwise cached up to 3×; it needs VRAM, which only a smaller quant frees.
  3. Re-convert unsloth's UD-IQ3_XXS for the merged `inkling2_loop` layout. Its core experts are 1.5 GB smaller, so 64k would fit without q8_0 KV, or more layers would fit on the GPU. Its quality needs KLD.
  4. DSpark (#32218): merge onto the loop code, re-index the taps per layer application, download the DSpark GGUF.
  5. Make the CUDA NVFP4 MMVQ on sm_86 as fast as IQ4_NL. That would make the lossless experts free.
