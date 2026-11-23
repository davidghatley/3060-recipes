# Inkling-2-Mini uncensored results

- GPU: RTX 3060 12 GB (sm_86), ~0.95 GB of it held by the desktop. CPU: i5-12500, 6 threads. RAM: 62 GiB. Measured
  bandwidth (base recipe): 342 GB/s VRAM, 57.1 GB/s RAM at 6 threads.
- Model: thinkingmachines/Inkling-2-Mini (26.4B MoE, 128 experts top-8, 24 layers, loop core 6–17 run 3× per token).
- Edits:
  - nokeepai/Inkling-2-Mini-Unbound-GGUF @ c61cf03f, `Inkling-2-Mini-Unbound-v2-LoRA-r64.gguf` (sha256 544222ad…):
    rank 64, F32, alpha 64, on `attn_q`, `attn_k`, `attn_v`, `attn_output`, `attn_gate` of all 24 layers (120 weights,
    133.5 MiB; `runs/lora-info-nokeepai.txt`).
  - AtomicChat/Inkling-2-Mini-Uncensored-GGUF @ 40886ab6: `Inkling-2-Mini-Uncensored-LoRA.gguf` (sha256 42914b85…): rank 1,
    F32, on `attn_output` and `ffn_down_exps` of all 24 layers plus `token_embd` (49 weights, 41.8 MiB;
    `runs/lora-info-atomicchat.txt`); `Inkling-2-Mini-Uncensored-AD-Q4_K.gguf` (sha256 36e99f1f…, 16.5 GB, experts
    Q4_K gate/up + Q5_0 down, 587 MiB per layer; `runs/gguf-layers-ad-q4k.txt`); `mmproj-Inkling-2-Mini-Uncensored-F16.gguf`.
- Base weights: ggml-org/Inkling-2-Mini-GGUF @ db61c5b4, IQ4_NL (the base recipe's default) and Q8_0 (KLD reference).
- Runtime: the base recipe's build, `/mnt/scratch/llama.cpp/r2inkfix-19c41d2ff` = llama.cpp master **225a5345b** + the
  two F16-mask patches in `../inkling-2-mini/patches/`. Layout: the base's `serve.sh` defaults (core 6–17 experts on the
  GPU, the rest in RAM, q8_0 KV, 64k, ub 128, op offload on, 6 threads) unless a row says otherwise.
- Measured 2026-11-22/23. Speed rows: `../inkling-2-mini/tools/srvtest.py` unchanged (llama-server's own timings;
  decode = median of 6 capped coding answers at reasoning_effort low, prefill = median of 2 cold 8k prompts), driven
  by `tools/gate.sh`, every candidate between two base controls in one GPU-lock hold. Raw: `runs/ledger.jsonl`,
  `runs/batches/*.log`, `runs/server-*.log`. The GPU was shared with other sessions all night through `gpu_run`; no
  speed row ran while another session was compiling (checked and logged at start and end of every run).

## Verdict

- **Ships: `serve.sh` with `VARIANT=atomicchat` (the default): AtomicChat's baked AD-Q4_K on the base layout (core
  experts 6–17 on the GPU, the rest in RAM, 64k, q8_0 KV) at ubatch 96. It decodes at 29.6 tok/s (base IQ4_NL 29.0),
  prefills 137 tok/s at 8k (base 145), finds 3/3 needles at 32k and 62k, passes codeeval 8/8, answers 20 of 20
  refusal-probe prompts (base: 8 answered, 12 hedged) and moves the output the least: KLD 0.014 / 0.011 against
  ggml-org's Q8_0 (base IQ4_NL 0.0085 / 0.0088).**
- **nokeepai's LoRA loads with `--lora` on the r2inkfix build and the base layout, but costs 7% decode at runtime
  (27.0 against 29.0 / 28.9 controls).** Merged into the IQ4_NL file with `tools/merge_lora.py` (Q8_0 re-quantized), it
  runs at exactly base speed (29.0, prefill 146) with the same KLD as the runtime LoRA. Its edit moves the output 3×
  more than AtomicChat's (KLD 0.042 / 0.031, wiki PPL +6.0%).
- **AtomicChat's LoRA works with experts in RAM.** No NaN, coherent answers, KLD 0.013 / 0.012 (the baked file:
  0.014 / 0.011), 20/20 answered. It costs 26% decode (21.4 tok/s), because its expert half runs as extra
  `mul_mat_id` nodes in all 48 applications, half of them on the CPU. The baked file has no such cost.
- **AD-Q4_K at ub 128 does not fit** (CUDA OOM at load: the 1.43 GiB compute buffer after 6.88 GiB of core experts).
  ub 96 fits with ~0.4 GB to spare and survives a 62k prompt; ub 64 fits with more room and loses 18% prefill.
- Image input works on all three edited variants (`tools/smoke.py --image` at 32k). At 64k the AD-Q4_K default
  takes the base's Q8_0 projector at ub 64 (AtomicChat's F16 one does not fit); that passes the image test and a 62k needle.

## Baseline vs tuned vs ceiling (single user, 64k context)

| Metric | Baseline: AD-Q4_K, stock master, every expert in RAM | Base recipe, no edit (control) | **Tuned (`serve.sh` default)** | Practical ceiling (THEORY.md) |
|---|---:|---:|---:|---:|
| Decode, empty context | 17.2 (16.6–17.8) | 29.0 (28.5–29.1 across 8 controls) | **29.6** (29.6–29.7), 1.72× | ~30.9 tok/s (96%) |
| Decode at 32k | not measured | 23.6 | **24.1** | |
| Prefill 8k / 32k / 62k | 51.8 / – / – | 145 / 123 / 103 | **137 / 117 / 97**, 2.64× at 8k | 181 at 8k from the expert copy alone (76%) |
| Time to first token, 8k prompt | 154 s | 55 s | 58–59 s | |
| Needles 32k / 62k | not run | 3/3, 3/3 | **3/3, 3/3** | |
| VRAM | 10.4 GB | 11.7 GB after 62k | 11.8 GB after 62k | 12 GB card, ~0.95 GB held by the desktop |
| Context | 64k | 64k | 64k | |

The baseline: neither model card's own line loads on this card. Both use `-ngl 99 -c 32768` on stock master
225a5345b, and with `-ngl 99` given, `--fit` aborts and llama.cpp tries to put everything on the GPU. nokeepai's
line (IQ4_NL + `--lora`) fails to allocate 16,331 MiB, and AtomicChat's (AD-Q4_K) fails at 15,279 MiB
(`runs/batches/b06-stock.log`). Without `-ngl 99`, `--fit` loads the weights but cannot allocate a 10.9 GB compute
buffer at the default ubatch of 512 (`runs/server-u07-stock-ad-fit.log`). The baseline column is therefore the usual
MoE offload line on stock master: `-ngl 99 -ot exps=CPU --no-op-offload -c 65536 -ctk q8_0 -ctv q8_0`, where op offload
is off because stock master gives NaN with core experts in RAM (`tools/stock.sh`, `configs/09`,
`runs/batches/b07-stock-loadable.log`). It has the same shape as the base recipe's 17.5 tok/s baseline. Load average
rose from 1.2 to 8.2 during that run, with no compiler running, so its decode spread is wider than the others'.

All variants, same harness, every row between base controls in the same GPU-lock hold:

| Variant (`VARIANT=`) | Decode | Prefill 8k | VRAM at load | Controls either side | Batch |
|---|---:|---:|---:|---|---|
| `base` (no edit) | 29.0 | 145 | 11.51–11.58 GB | — | all |
| `nokeepai` (runtime LoRA) | **27.0** (27.0–27.1) | 144.3 | 11.68 GB (+0.13) | 29.1 / 28.9; pp 146.0 / 145.3 | b01 |
| `nokeepai-merged` | **29.0** (28.9–29.1) | 146.0 | 11.55 GB (= base) | 28.9 / 28.9; pp 145.2 / 145.1 | b02 |
| `atomicchat-lora` | **21.4** (21.4–21.5) | 136.1 | 11.55 GB (= base) | 28.9 / 29.0; pp 145.1 / 145.7 | b02 |
| `atomicchat` ub 128 | OOM at load | | | 28.8 / 28.5 | b04 |
| `atomicchat` ub 64 | **29.7** (29.6–29.8), repeat 29.7; 24.1 at 32k | 111.3, repeat 112.2; 98 / 84 at 32k / 62k | 11.16 GB | 28.8 / 28.5; 29.0 / 29.0 | b04, b05 |
| **`atomicchat` ub 96** | **29.6** (29.6–29.7) | **136.7** | 11.63 GB | 29.0 / 29.0; pp 145.6 / 145.1 | b05 |
| `atomicchat` ub 128 `--no-op-offload` | loads (11.77 GB), CUDA OOM on the first request | | | 29.0 / 29.0 | b05 |

Memory: llama-server's RSS high-water mark is 17.4–18.5 GB for every variant (`mem-*` rows in `runs/ledger.jsonl`).
The gpu_run cgroup's `memory.peak` reads anything from 2 GB to 35 GB for the same server, because the page cache of
the mmap'd weights is charged to whichever cgroup first read it; it is not a measure of this server. 44 GB
(`GPU_RUN_MEM`, the base serve.sh default) was never reached.

Startup: "ready" 2–33 s after launch when the weights are in the page cache (includes the GPU-queue wait); a cold
start reads 16.5 GB from `/mnt/models` and was not timed separately.

## What was tried

See PLAN.md for the full log with timestamps.

| # | Change | Result | Verdict |
|---|---|---|---|
| 1 | nokeepai LoRA with `--lora-scaled …:1` on the base layout | loads (`/lora-adapters` lists it at scale 1.0; KLD 0.043 and the refusal change show it acts), 27.0 tok/s (−7%) | works, slower |
| 2 | merge nokeepai's LoRA into the IQ4_NL file. `llama-export-lora` writes F16 for quantized bases (+0.58 GB VRAM, does not fit), so `tools/merge_lora.py` re-quantizes each edited tensor to its own type (Q8_0) | 17.6 GB file, 29.0 tok/s, KLD equal to runtime | kept as `nokeepai-merged` |
| 3 | AtomicChat LoRA on ggml-org's IQ4_NL with experts in RAM | no NaN, 21.4 tok/s (−26%) | works, slow; use the baked file |
| 4 | AD-Q4_K, base layout at ub 128 | OOM at load | rejected |
| 5 | AD-Q4_K at ub 64 | 29.7 / 111 | fits; slower prefill |
| 6 | AD-Q4_K at ub 96 | 29.6 / 137, 62k needle 3/3 | **shipped** |
| 7 | AD-Q4_K at ub 128 with `--no-op-offload` | OOM on the first request | rejected |

Not tried: moving one core layer's experts to RAM to make room for ub 128 (needs `--no-op-offload`, which
already ran out of VRAM in #7); the MoE cache and DSpark levers from the base recipe (they need spare VRAM, which
AD-Q4_K at 64k does not leave); a smaller AtomicChat quant (AD-IQ3_S / AD-IQ2_M, not downloaded).

## Quality

### KL divergence against ggml-org's Q8_0

The base recipe's cached Q8_0 logits (`/mnt/models/llm/inkling-2-mini/kld/`), 24 chunks × 512 tokens of wikitext-2
test and of code, `tools/kld.sh` (experts on the CPU, `--no-op-offload`). Raw: `runs/kld/`.

| Weights | KLD wiki / code | Same top token wiki / code | PPL wiki / code |
|---|---:|---:|---:|
| Q8_0 (reference) | 0 | 100% | 7.352 / 2.638 |
| ggml-org IQ4_NL, no edit (base recipe round 2) | 0.0085 / 0.0088 | 95.5% / 97.5% | 7.367 / 2.642 |
| AtomicChat AD-Q4_K (baked) | **0.0142 / 0.0109** | 95.2% / 97.0% | 7.385 / 2.651 |
| IQ4_NL + AtomicChat LoRA | 0.0133 / 0.0116 | 94.7% / 96.8% | 7.400 / 2.644 |
| IQ4_NL + nokeepai LoRA (runtime) | 0.0427 / 0.0314 | 93.7% / 96.5% | 7.812 / 2.726 |
| nokeepai merged into IQ4_NL | 0.0423 / 0.0305 | 93.7% / 96.5% | 7.790 / 2.727 |

Each number mixes the quantization (≈ the IQ4_NL row) and the edit. AtomicChat's edit adds about 0.005; nokeepai's
adds about 0.03 and 6% wiki perplexity. The AD-Q4_K wiki run has one outlier token (maximum KLD 7.48; the 99th
percentile is 0.12, like the others). The merged file matches the runtime LoRA within the error bars, so the Q8_0
re-quantization in `tools/merge_lora.py` does not move the result (`runs/merge-nokeepai.log`: worst tensor's rounding
error is 0.76 of the edit's own norm, spread over 120 tensors; the KLD shows it averages out).

### Refusals, coding, long context, images

`scripts/refusal_probe.py` (20 borderline prompts, 1024 tokens, reasoning_effort low set with
`--chat-template-kwargs`), every answer read; `tools/refusal_reread.py` re-scores them because the shared probe's
regex only matches a straight apostrophe and this model writes `can’t`. `scripts/codeeval.py` (8 tasks, run in a
sandbox). Raw: `runs/refusal-*.json`, `runs/refusal-reread.json`, `runs/codeeval-*.json`, `runs/smoke-*.json`.

| Variant | Answered / hedged / refused (of 20) | codeeval | Needles 32k / 62k | Image (32k) |
|---|---|---|---|---|
| base IQ4_NL | 8 / 12 / 0 | 8/8 | 3/3, 3/3 (base recipe) | pass (base recipe) |
| **atomicchat (AD-Q4_K)** | **20 / 0 / 0** | **8/8** | **3/3, 3/3** (ub 96 and ub 64) | pass, AtomicChat mmproj F16 |
| atomicchat-lora | 20 / 0 / 0 | 8/8 | not run | pass, base mmproj Q8_0 |
| nokeepai (runtime) | 19 / 1 / 0 (a medical disclaimer, then the answer) | 8/8 | not run | not run |
| nokeepai-merged | 20 / 0 / 0 | 8/8 | 3/3, 3/3 | pass, base mmproj Q8_0 |

"Hedged" on the base means the answer opens with "I can't …" and then gives a softened version (no slurs, a
non-operational outline, a fictional framing). Both edits remove that on these 20 prompts; neither produced garbage,
loops or empty answers. The edited variants' answers to the same prompt differ (temperature 0, but the reasoning
diverges early), and both write in the base model's style.

The image test is the base recipe's: a generated PNG, red left, blue right, white square in the middle. All three
answer e.g. "A vertical split background of red on the left and blue on the right with a white square centered over
the boundary."

## Unverified

- AtomicChat's card asks for its own Inkling-2-Mini-GGUF base for the LoRA; it was applied here to ggml-org's IQ4_NL,
  which has the same tensor names and shapes (checked by `tools/lora_info.py`). Its `adapter.lora_alpha` key is not the
  standard `adapter.lora.alpha`, so llama.cpp reads no alpha and uses the scale as given (1.0); at rank 1 and alpha 1
  that is the same edit.
- 20 prompts are a small refusal sample; the larger sets AtomicChat's card reports on (mlabonne/harmful_behaviors, walledai/XSTest,
  MMLU) were not rerun here.
- Tool calls and concurrency (one slot only, as in the base recipe) were not tested.
- Image input at 64k (`runs/batches/v01-…`, `v02-…`): AtomicChat's own F16 projector (610 MiB) does not load next to
  AD-Q4_K at 64k (cudaMalloc fails). The base recipe's Q8_0 projector at ub 64 does: image test passed and a 62k
  needle 3/3 (prefill 80.9, decode 19.9; 11.74 GB on the card). `UNC_MMPROJ=1 ./serve.sh` picks that combination.
  Image quality with the Q8_0 projector against the F16 one was not compared beyond the smoke test.
