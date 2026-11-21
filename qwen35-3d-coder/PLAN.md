# Experiment log: Qwen3.5-4B-3D-Coder on the 3060

Timestamped, newest last. Every run's raw output is under `runs/`. Ledger of server runs: `runs/ledger.jsonl`.

## Targets and constraints

- Main target: single-user decode tok/s for the real task (reasoning then a ~10k-token three.js page).
- Also: prefill and TTFT, quality on the task (render eval + KL divergence), stability at the context the task needs.
- Context needed: references run 17-45k tokens per answer (median reasoning 46k chars, HTML 38k chars), so 64k.
- GPU shared through `gpu_run`; sessions < 30 min. Lossless changes need a greedy-identity check; quants are a labelled quality trade.

## 2026-11-19

- 10:50 Local `Qwen3.5-4B-3D-Coder-Q8_0.gguf` was the Oct 25 preview (sha256 666ebe…), not the current Oct 27 checkpoint
  (c30b02…). Moved aside to `stale-oct25/`, fetched the current file. Everything below uses the Oct 27 checkpoint.
- 10:55 MTP: config declares `mtp_num_hidden_layers: 1` but the release has no `mtp.*` tensors (723 tensors vs 738 in
  base Qwen3.5-4B); the official GGUFs have `nextn_predict_layers = 0`. b12242 supports `--spec-type draft-mtp` for
  qwen35. Grafted the base model's 15 MTP tensors (HTTP range requests, 241 MB) into the official FP16 safetensors and
  converted with llama.cpp's own converter, so the norm +1 shift is applied (enorm mean 0.59, hnorm 0.75: positive).
- 11:07 Our Q8_0 trunk is byte-identical to the official Q8_0 on all 249 quantized tensors; 177 small F32 tensors
  differ by ~3e-5 (official GGUF was made from pre-FP16 weights). Quantized Q6_K / Q5_K_M / Q4_K_M from our F16.
- 11:10 DFlash: z-lab/Qwen3.5-4B-DFlash converts with the b12242 converter (`--target-model-dir`), 6 layers, 634M.
- 11:12 Harness check: the dataset's own reference pages score 40/40 on the render eval (no false failures).
- 11:20 VRAM bandwidth (cuBLAS SGEMV, 1 GiB fp32): **342 GB/s** read; D2D copy 333 GB/s; 8 MiB matvec 303 GB/s.
- 11:21-11:29 Quant sweep (llama-bench, -fa on, f16 KV, 6 reps, two passes in reverse order; sd < 0.5%):

  | GGUF | tg128 d0 | tg128 d16k | pp2048 | ms/token d0 | ceiling d0 (342 GB/s) | % of ceiling |
  |---|---:|---:|---:|---:|---:|---:|
  | F16 (ours) | 37.2 | | 3,247 | 26.9 | 40.2 | 93% |
  | Q8_0 official (baseline) | 63.1-63.6 | 57.3 | 3,532 | 15.8 | 74.8 | 85% |
  | Q8_0 ours (+MTP tensors) | 63.6-63.7 | 57.7-57.8 | 3,519 | 15.7 | 74.8 | 85% |
  | Q6_K | 76.0 | 67.7 | 3,087 | 13.2 | 96.2 | 79% |
  | Q5_K_M | 82.5-82.6 | 73.0 | 3,181 | 12.1 | 108.1 | 76% |
  | Q4_K_M ours | 90.9-91.0 | 79.5 | 3,278 | 11.0 | 122.2 | 74% |
  | Q4_K_M official | 90.8-90.9 | 79.1-79.4 | 3,270 | 11.0 | 122.2 | 74% |

  Verdict: decode scales with bytes as expected; the extra MTP tensors cost nothing when unused. Smaller quants reach a
  lower share of the ceiling: a roughly fixed ~3 ms/token is not weight streaming (see RESULTS.md kernel section).
- 11:29 Spec smoke (64 tokens, 1 prompt, Q4_K_M): MTP n=2-4 gives ~128 tok/s while writing code (acceptance 75-83%)
  but loses while reasoning (acceptance ~16-30%: the fine-tune's terse reasoning style is not what the base MTP head
  learned). ngram-map-k: no drafts. DFlash: 6-10% acceptance (drafter trained on the base model). 0.8B draft: 50 tok/s.
- 11:31-11:38 Flag sweep on Q4_K_M ours (llama-bench, 6 reps; three interleaved controls agree within 0.1%):

  | change | tg128 d0 | tg d16k | tg d32k | pp2048 | pp16384 | verdict |
  |---|---:|---:|---:|---:|---:|---|
  | control (fa on, f16 KV, ub 512, graphs on) | 91.3 | 80.0 | 71.0 | 3,234 | 2,920 | |
  | `-fa off` | 90.1 | 57.1 | | | | reject: -29% at 16k |
  | KV q8_0 | 90.8 | 77.0 | 67.0 | | | reject: slower (dequant), KV is small anyway |
  | `GGML_CUDA_DISABLE_GRAPHS=1` | 85.9 | 75.7 | | | | graphs worth +6.3% (0.70 ms/token) |
  | `GGML_CUDA_DISABLE_FUSION=1` | 88.9 | 78.4 | | | | fusion worth +2.7% |
  | `GGML_CUDA_GRAPH_OPT=1` | 91.2 | 79.8 | | | | no effect |
  | ub 256 | | | | 2,970 | 2,705 | reject |
  | ub 1024 | | | | 3,327 | 2,997 | |
  | **ub 2048** | | | | **3,343** | **3,047** | accept: +3.4% / +4.3% prefill |
  | ub 4096 | | | | 3,341 | | same as 2048, more VRAM |
- 11:39-11:54 Spec session spec1 (Q4_K_M ours, 3 prompts x 768 tokens x 2 phases, 5 interleaved controls: R 88.7-88.9,
  C 80.7-80.9). Task rate = 1/(0.55/R + 0.45/C), 0.55 = reasoning share of reference answers.

  | config | R tok/s | C tok/s | accept R | accept C | task tok/s |
  |---|---:|---:|---:|---:|---:|
  | none | 88.7 | 80.8 | | | 85.0 |
  | MTP n=2 | 87.7 | 131.6 | 0.35 | 0.85 | **103.2** |
  | MTP n=3 | 77.1 | 132.0 | 0.26 | 0.76 | 94.9 |
  | MTP n=2 p-min 0.5 | 84.7 | 127.9 | 0.54 | 0.91 | 99.9 |
  | MTP n=3 p-min 0.5 | 82.1 | 129.3 | 0.51 | 0.86 | 98.2 |
  | MTP n=4 p-min 0.5 | 86.7 | 133.4 | 0.50 | 0.83 | **102.9** |
  | MTP n=3 p-min 0.75 | 85.9 | 126.7 | 0.75 | 0.95 | 100.5 |
  | MTP n=4 p-min 0.75 | 84.9 | 130.6 | 0.74 | 0.93 | 100.8 |
  | MTP n=6 p-min 0.75 | 83.2 | 126.9 | 0.75 | 0.90 | 98.4 |
  | ngram-map-k | 89.7 | 80.9 | | | 85.5 (noise) |

  Verdict: MTP n=2 and n=4/p-min 0.5 tie (+21% task rate, +63-65% while writing code); a confirmation run decides.
  p-min stops a draft at the first token below the threshold (common/speculative.cpp), which saves verify work in
  prose but loses accepted tokens in code.
- 11:54-11:56 DFlash control (2 prompts x 512 tokens): base Qwen3.5-4B Q4_K_M (ggml-org) + the z-lab drafter goes
  78.3 -> 96.7 task tok/s (R 81.4 -> 95.4, C 74.8 -> 98.4), so the drafter and our conversion work. On the fine-tune
  the same drafter gets 4% acceptance while reasoning (R 59.3, a 27% loss) but 138 tok/s while coding on these two
  prompts. Added to the spec2 confirmation run against MTP on 5 prompts.
- 11:57-12:00 KL divergence vs our F16 (llama-perplexity, 12 held-out validation answers, 8 x 4096 tokens):

  | GGUF | mean KLD | 99% KLD | same top token | PPL ratio |
  |---|---:|---:|---:|---:|
  | Q8_0 official | 0.00107 | 0.0061 | 98.1% | 1.000 |
  | Q8_0 ours | 0.00107 | 0.0062 | 98.2% | 1.000 |
  | Q6_K | 0.00303 | 0.0185 | 97.0% | 1.001 |
  | Q5_K_M | 0.00732 | 0.0485 | 95.8% | 1.006 |
  | Q4_K_M ours | 0.02565 | 0.1796 | 92.2% | 1.019 |
  | Q4_K_M official | 0.02572 | 0.1788 | 92.1% | 1.019 |

  Q4_K_M is a real step down (3.5x the KLD of Q5_K_M). The render eval decides whether it shows on the task.
- 11:59-12:01 Greedy check (temperature 0, 3 prompts x 2 phases x 512 tokens): the two no-spec runs are identical;
  MTP n=2 matches no-spec on 4 of 6, and diverges after 677 and 1612 characters on the other 2 (n=4/p0.5: 1 of 6).
  The verify step runs the target on a 3-token batch, which takes different kernels than single-token decode, so
  near-tied argmaxes can flip. A logprob probe of the divergence points is queued. Not bit-identical; same model.
- 12:02-12:23 spec2 confirmation (5 prompts x 1024 tokens x 2 phases, 3 controls R 88.5-88.6 / C 80.5-80.8):

  | config | R | C | accept R | accept C | task tok/s |
  |---|---:|---:|---:|---:|---:|
  | Q4_K_M none | 88.5 | 80.6 | | | 84.8 |
  | **Q4_K_M MTP n=2** (x2, R 92.8/92.8, C 132.2/132.1) | 92.8 | 132.2 | 0.37 | 0.86 | **107.1** (+26%) |
  | Q4_K_M MTP n=4 p-min 0.5 (x2) | 83.1 | 133.8 | 0.48 | 0.83 | 100.2 |
  | Q4_K_M DFlash n=15 | 71.5 | **158.4** | 0.07 | 0.25 | 95.0 |
  | Q5_K_M MTP n=2 | 86.9 | 128.7 | 0.35 | 0.88 | 101.7 |
  | Q6_K MTP n=2 | 85.3 | 121.5 | 0.37 | 0.86 | 98.5 |

  Verdict: MTP n=2 accepted (beats both neighbouring controls in both phases, repeated). DFlash is the fastest code
  writer by far but loses 19% while reasoning; spec3 tests whether p-min truncation keeps the code win without the
  reasoning loss. With MTP the Q4->Q5 gap shrinks to 5% (verify batches are less bandwidth bound).
- 12:23-12:50 spec3 (same 5 prompts x 1024 tokens; 3 controls R 88.5-88.6 / C 80.6-80.7):

  | config | R | C | accept R | accept C | task tok/s |
  |---|---:|---:|---:|---:|---:|
  | Q8_0 official, none (baseline) | 62.5 | 58.3 | | | 60.6 |
  | Q8_0 ours + MTP n=2 | 77.8 | 107.7 | 0.43 | 0.86 | 88.9 (+47% over baseline, no quant change) |
  | Q4_K_M MTP n=2 (third repeat) | 92.6 | 132.5 | 0.37 | 0.86 | **107.1** |
  | DFlash n=15 (repeat) | 71.5 | 157.6 | 0.07 | 0.25 | 94.8 |
  | DFlash n=15 p-min 0.5 | 74.5 | 152.2 | 0.43 | 0.55 | 96.7 |
  | DFlash n=15 p-min 0.8 | 71.7 | 141.0 | 0.77 | 0.81 | 92.1 |
  | DFlash n=15 p-min 0.8 n-min 3 | 64.0 | 119.8 | 0.86 | 0.78 | 81.0 |
  | DFlash n=8 | 72.9 | **163.2** | 0.10 | 0.43 | 97.0 |

  Verdict: p-min does not rescue DFlash while reasoning: the cost is the drafter's own forward pass each step, not
  the rejected verify tokens. DFlash n=8 is the fastest code writer measured (163 tok/s, 2.0x no-spec) but MTP n=2
  stays the best for the whole task. A per-phase switch (MTP while reasoning, DFlash n=8 after `</think>`) would
  give ~1/(0.55/92.8+0.45/163.2) = 116 tok/s (+8%); llama.cpp cannot do that today.
- 12:48 Greedy probe (no-spec run with top-2 logprobs): every MTP divergence point is a near-tie, top-1 minus top-2
  logprob 0.002-0.10 nats (8 divergences in 12 comparisons, `tools/greedy_check.py`). Verdict: the differences come
  from batched-verify numerics, not from the speculation logic. MTP is lossless in distribution, not bit-identical.
- 12:49-12:50 Verify cost (llama-bench pp1..pp16 = one target pass over N tokens, 8 reps, Q4 measured twice):

  | tokens in the batch | 1 | 2 | 3 | 4 | 5 | 8 | 16 |
  |---|---:|---:|---:|---:|---:|---:|---:|
  | Q4_K_M, ms per batch, d0 | 11.2 | 11.9 | 13.2 | 15.0 | 16.1 | 21.9 | 17.3 |
  | Q4_K_M, ms per batch, d10k | 12.3 | 13.0 | 13.8 | 15.5 | 16.6 | 22.0 | 18.5 |
  | Q5_K_M, d0 | 12.4 | 13.0 | 14.0 | 15.7 | 17.3 | 23.0 | 18.3 |
  | Q8_0, d0 | 16.2 | 16.6 | 16.8 | 17.0 | 17.7 | 20.9 | 23.2 |

  Q8_0 batches almost free up to 5 tokens (bandwidth bound: 3 tokens cost 1.04x one token). Q4_K/Q5_K small batches
  are compute bound in the dequantizing matvec kernels (3 tokens cost 1.13-1.17x, 8 tokens 1.8-1.95x), and an
  8-token batch is slower than a 16-token one: the kernel switch to MMQ happens too late for K-quants on this card.
- 12:50-13:44 Render eval, first sessions (4 slots x 32k context, no speculation, card sampling, 32k-token cap).
  40 prompts x ~20k tokens at ~43 tok/s per slot is ~2.5 h per model, so the eval was cut to the first 20 subset
  prompts (2 per level). Partial: Q8_0 official 6/9 pass, 0 throws among finished pages (3 hit the 32k cap);
  Q4_K_M ours 3/10 pass, **5 of 8 finished pages throw** (`THREE.Object33D`, a duplicate `const`, a missing
  initializer: token-level slips). Added Q5_K_M to the eval before finishing Q4_K_M.
- 13:44-15:48 Render eval finished (first 20 subset prompts, 4 slots x 32k, no speculation, 32k cap, one sample):
  pass Q8_0 official 10/20, Q5_K_M 9/20, Q4_K_M 5/20; finished pages that throw 33% / 29% / 62%. Most 32k-cap hits are
  reasoning loops at every quant (`tools/loop_check.py`: 4 / 4 / 6). Verdict: Q4_K_M rejected on quality, Q5_K_M kept.
  Full table: `runs/eval-table.md`.
- 15:48 spec4-q5 (controls on both sides): Q5 none R 80.7 C 74.0 task 77.5; Q5 MTP n=2 R 86.8 C 128.8 task 101.7
  (repeat of 101.7); MTP n=3 92.2. serve.sh default moved to Q5_K_M.
- 16:05 qualify.sh on serve.sh (Q5 + MTP): chat ok; needles 3/3 at 32,070 tokens (prefill 12.9 s) and 3/3 at 62,073
  (29.9 s). Scene gate FAILED: scene-000048 hit the 24k cap in a reasoning loop (97% draft acceptance = repetition).
- 16:10-16:55 Same 8 subset prompts via serve.sh, MTP n=2 vs QC_SPEC=none (renders on the CPU, after the GPU runs):
  MTP 1/8 pages work, 4 loops, 3 of 4 finished pages throw; none 6/8 work, 0 loops. MTP loops 5/9 incl. the gate
  run vs 0/8 (Fisher p ~0.03). llama.cpp's acceptance is sample-and-compare (exact in distribution), so the suspect is
  Gated DeltaNet state rollback after rejected drafts. Verdict: MTP rejected on quality, opt-in only; serve.sh default
  is Q5_K_M without speculation (77.5 tok/s, 1.28x). Fixing the rollback is the top lever (+31%, measured endpoints).
- 16:58 GPU work done. Flint restarted on 8081 with its own serve.sh (health ok).

## 2026-11-20: MTP correctness

- 15:50 Upstream check (master 29b52d398 = b12597+3, 358 commits after b12242): no commit or issue fixes recurrent
  rollback for speculation. Related only: PR #31669 (open) replaces GDN snapshot rollback with replay for speed/memory;
  issue #31472 (open) is batch-shape numerics breaking temp-0 identity, rollback exonerated there. Rollback design read
  in b12242: `n_rs_seq = n_max` snapshot groups per recurrent cell, GDN kernel writes the state after each of the last
  K tokens (slot 0 newest), conv state stored as K overlapping windows, `seq_rm` sets a single-use `rs_idx` that
  `s_copy()` consumes on the next graph. On paper the slot mapping is right for n=2.
- 15:55 New tools: `tools/mtp_repro.py` (gen with per-token top-N logprobs; force = no-spec server re-scores a run's
  own prefix [:k] by full prefill; compare), `tools/with_server.sh` (serve.sh on :8090 around a command).
- 15:59-16:09 Session A, b12242 Q5_K_M, greedy, 3 prompts that looped under MTP (048/334/335), 6000 tokens
  (`runs/mtprepro/A-b12242/`):

  | run | first divergence from no-spec (gap there) | own logprob vs forced re-score: median / max abs diff | argmax disagrees |
  |---|---|---|---|
  | none 048 / 334 / 335 | (reference) | 0.0071/0.056, 0.0004/0.085, 0.0092/0.100 | 0/31 each |
  | MTP n=2 048 / 334 / 335 | token 473 (0.002), 906 (0.104), 441 (0.043) | 0.0006/0.037, 0.0000/0.092, 0.0000/0.048 | 0/31 each |

  Verdict: within 6k greedy tokens the MTP target state is exact to numerics: its logits match a clean prefill of
  the same prefix as closely as no-spec decode does. Divergences are near-ties. No looping in any of the 6 runs.
- 16:10-16:38 Session B, same 3 prompts, card sampling (T 0.6, top-p 0.95, top-k 20, min-p 0, seed 42), 12,000 tokens,
  top-20 logprobs (`runs/mtprepro/B-b12242-T06/`). Two checks: sampler calibration (observed top-1 picks vs the count
  T/top-k/top-p predict from the logged distribution) and the forced re-score every 500 tokens.

  | run | top-1 picks obs/exp (z) | own logprob vs forced: median / max abs diff | loops (`loop_check`) |
  |---|---|---|---|
  | none 048 / 334 / 335 | 10091/10178 (-2.2), 10595/10660 (-1.9), 10287/10396 (-2.9) | 0.0013/0.047, 0.0004/0.222, 0.0007/0.046 | 0/3 |
  | MTP n=2 048 / 334 / 335 | 10404/10464 (-1.6), 10089/10164 (-1.9), 9983/10082 (-2.5) | 0.0001/0.106, 0.0021/0.047, 0.0021/0.063 | 0/3 |

  Verdict: through 12k sampled tokens (past the ~9k where the qualify loops began) MTP's target state still matches a
  clean prefill, and the verifier samples exactly as calibrated as no-spec (same small negative z in both, a property
  of the check). No state corruption and no sampler bias. MTP decode with logprobs: 75.7-81.0 vs 64.3-69.2 tok/s;
  sampled acceptance 42-49% (greedy 46-73%). The GPU lock went to the other agent between the two servers once
  (server gave up after the 120 s wait): serve.sh now takes `QC_GPU_WAIT` (default 120).
- 16:39-17:14 Session C, qualify conditions (qualify.py `--scene-only`, chat endpoint, prompt cache on, server
  default min-p 0.05, no seed, 24k cap), MTP n=2, the 4 prompts that looped before (`runs/mtprepro/C-qualify-mtp/`;
  waited 24 min for the GPU lock first). 048: finished, 19,256 tokens, 102.8 tok/s, no loop (looped last time).
  238: 24k cap, reasoning LOOP (zlib 0.023), 98.7 tok/s. 334: finished, 14,875 tokens, 107.2 tok/s, no loop (looped
  last time). 335: interrupted mid-generation (pause, below). So far 1/3 loops vs 4/4 on the same prompts last time;
  238 also loops without speculation (the Q5 render eval). Reading: the earlier 5/9 vs 0/8 split looks like
  per-prompt loop variance more than an MTP defect, but the sample is small and this is not yet shown.

### PAUSED 2026-11-20 17:14 (Inkling-2-Mini has GPU priority)
- Stopped at a boundary: session C's client was stopped during scene 335 (that answer is lost; 048/238/334 files are
  complete). Its server got SIGINT through `with_server.sh` and exited. The empty `qualify.json` moved aside to
  `qualify.json.empty-interrupted`. All of my waiter loops are stopped. `gpu_run --status` showed the lock free at 17:14.
- Done: upstream check (no fix on master 29b52d398; see 15:50). Master is built at
  `/mnt/scratch/llama.cpp/mtpfix-29b52d398/bin` (llama-server and llama-bench, sm_86, not tested yet; run it with
  `QC_BIN=/mnt/scratch/llama.cpp/mtpfix-29b52d398/bin QC_CUDA_LIB=/mnt/scratch/envs/llama-build-cuda/lib`). Session A
  (greedy, 6k tokens) and session B (T 0.6, 12k tokens): MTP target state matches a clean prefill to numerics, and the
  verifier is calibrated. No rollback corruption was found, so there is no patch and `patches/` doesn't exist.
- Code read (b12242): the RS snapshot rollback, conv windows, `s_copy`, server accept/rollback, and
  `sample_and_accept_n` all look correct for n=2. There are no checkpoints when draft <= n_rs_seq.
- Mid-run: session C (above). Not done: the multi-seed loop-rate test that decides the question, the master build
  test, the render and spec4 validation, and any default change. The defaults are unchanged: serve.sh still defaults
  to QC_SPEC=none.
- serve.sh: the only change is `--wait "${QC_GPU_WAIT:-120}"`, same default behaviour. It's kept because it's harmless
  and lets long queued runs wait for the lock.
- Resume (next command): the loop-rate test, MTP vs none on the hardest prompts with several seeds each. `--max 16000`
  is enough, since loops start around 9k tokens. Server default min-p (-1) matches serve.sh/qualify. Split into batches
  under 30 min:
  ```
  cd ~/Projects/3060-recipes/qwen35-3d-coder && S=runs/mtprepro/D-looprate && export QC_GPU_WAIT=1800
  QC_SPEC=draft-mtp tools/with_server.sh $S/mtp-server.log -- python3 -I tools/mtp_repro.py gen --temp 0.6 --min-p -1 \
    --n-probs 0 --max 16000 --ids scene-000238,scene-000335 --seeds 1,2,3 --out $S/mtp
  tools/with_server.sh $S/none-server.log -- python3 -I tools/mtp_repro.py gen --temp 0.6 --min-p -1 \
    --n-probs 0 --max 16000 --ids scene-000238,scene-000335 --seeds 1,2,3 --out $S/none
  ```
  Each run prints zlib, a LOOP flag and tok/s. (The `--seeds`/`--min-p` options were added just before the pause and
  haven't run yet: smoke-test with `--max 64` first.) If the loop rates match, MTP goes back to the default after the
  8-prompt render comparison and spec4 controls. If MTP loops clearly more, test master next.
