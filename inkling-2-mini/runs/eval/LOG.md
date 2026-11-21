# Eval run log

Every run, one entry. Suite rows and per-row results stay in `/mnt/work/jev-index/` (licences: the suite is never
redistributed); this folder keeps aggregates, configs and server logs only.

## 2026-11-21 · suite rebuild 0.3 (CPU)
- `suite rebuild --edition 0.1` minus HLE (45, gated): 131,909 rows (lab 132,422; HLE = 513). Hash differs, as expected.
- `eval/tools/rebuild_no_hle.py`: 0.2 cut 124,458 rows; added 30,419 rows, **sha256 = lab**; 0.3 GSM8K 2,638 rows, **sha256 = lab**.
- Staged with `suite import --no-verify` at `/mnt/work/jev-index/suite-0.3`.

## 2026-11-21 · splits
- `make_splits.py --k 40 --m 15` → control test: 1,721 requests, 16,186 questions, 3.28M proxy tokens.
- `--k-override {38:8, 36:8, 2:8, 3:12, 11:15, 22:20}` → Inkling test 1,447 requests / 5,613 questions / 1.28M tokens
  (a prefix of the control test), calib 559 requests, 0 overlap with Inkling test.

## 2026-11-21 · control, Decider 2B v10, k = 40 sample
- Server: `control-decider-2b-v10/serve-decider.sh` (decider @ f01b58d, bf16, compile on, CUDA graphs off via
  `decider-serve-graphs-off.patch`: graph warm-up to B = 32 ran out of memory on 12 GB), batch 1.
- Kit `http` engine, sequential. 1,721 / 1,721 ok, 1,025 s.
- Index 29.65 (bootstrap 95% 27.36–32.57) vs board 29.75. 29 / 36 benchmarks inside their CI.
- Calibration, base 27: acc 0.577, conf 0.659, ECE 0.085 (95% 0.068–0.109), Brier 0.525, over95 0.012
  vs board 0.586 / 0.663 / 0.077 / 0.520 / 0.0097. All 34: ECE 0.110 (PhishNChips conf 0.985, acc 0.45).
- Aggregates: `control-decider-2b-v10/k40/`.

## 2026-11-21 · control, six outlier benchmarks in full
- 9, 29, 36, 40, 41, 43 in full (18,526 requests, 1,833 s). Request counts equal the board's.
- Full vs board: HellaSwag 0.8587 / 0.8581, BRIGHT 0.3728 / 0.3711, iSarcasmEval 0.2207 / 0.2243, VAST 0.5151 / 0.5104,
  Home appliances 0.0455 / 0.0341 (1 case in 88), CRUXEval 0.3526 / 0.3298 (13 in 570).
- One BRIGHT chunk (23,179 tokens) runs out of memory in eager bf16 on 12 GB on every retry; it counts as wrong.
- **Verdict: control passes.** The k = 40 outliers were small-sample effects of macro-F1 / case-exact metrics.
  Per-benchmark numbers on 40 cases are noisy; the index and its CI are what to read.
- Aggregates: `control-decider-2b-v10/full6/`.

## 2026-11-21 · Inkling readout checks (`readout/`, 40 calib-split prompts ≤ 1,500 tokens)
- Codes: A–Z, a–z, "1"–"255" are single, distinct tokens.
- Plain logprobs: all codes in top 20 for 37 / 40 prompts, top 200 for 39 / 40, so the readout uses a +100 bias.
- **Bias readout is exact**: vs plain top-200 renormalised over the codes, max |Δp| 9.6e-7 (39 prompts).
- **Patched build (73e22d20a) at 3 passes = default build, bit for bit** (20 prompts, max |Δp| 0.0).
- 2 and 1 passes run, no NaN; top-1 agreement with 3 passes 40% and 30% (10 prompts each). Out of distribution.
- **Cached vs cold differ**: mean max-|Δp| 0.039, max 0.46. Cold is bit-deterministic across restarts.
- Cold vs micro-batch size: ub512 = ub2048 bit for bit; **ub128 differs from both** (mean 0.039, max 0.27, top-1 97.5%).
- Hypothesis: RAM experts (layers 0–5, 18–23) run on the CPU for micro-batches < 32 tokens (op-offload threshold),
  on the GPU otherwise. The answer logits come from the last micro-batch: often < 32 at ub 128, always for cached reads.
  Test: `GGML_OP_OFFLOAD_MIN_BATCH=1` (`sessions/offload_probe.sh`).
- Process note: a `pgrep -f` pattern matched my own shell once and killed a session script mid-run; scripts now
  match `pgrep -x llama-server` plus the port in /proc/PID/cmdline.
- `GGML_OP_OFFLOAD_MIN_BATCH=1` (RAM experts always on the GPU): cold moves 0.010 from ub128 and stays 0.045 from ub512,
  so the CPU/GPU path is a small part. Cached vs cold with it: mean 0.052, max 0.68.
- **Which split is right? None is wrong.** `tools/ubsplit_kld.sh`, wiki 12 × 512 vs the Q8_0 logits, serve placement:
  mean KLD ub512 0.00863, ub128 0.00851, ub32 0.00865, ub16 0.00862 (± 0.00027), ub128 q8_0 KV 0.00882; same-top 95.5–95.8%.
  All equal the IQ4_NL weights' own KLD (0.0085, `runs/kld/`). Micro-batch size changes the float summation order, and
  that changes near-tied answers by quantisation-noise amounts; it is not a bug in the split or the cache.
- **Decision:** Phase 2 runs the serve.sh defaults with the cached prefix (as the brief asks). The ±0.04 per-answer
  jitter is reported as a noise floor: it is the size of the IQ4_NL quantisation error, and the readout cannot be
  more precise than that on this build.

## 2026-11-21 · Phase 2 · Inkling 2 Mini, 3 passes (serve.sh defaults, cached prefix, effort none)
- `sessions/phase2.sh`: calib 559 / 559 ok (3 batches, 06:34–07:42), test 1,447 / 1,447 ok (7 batches, 07:42–10:48). 0 errors.
- Temperature, calib only (`fit_temperature.py`, 1,940 fields, 0 test overlap): **T = 4.3135**, NLL 2.141 → 1.012.
- **Test index 40.13 (bootstrap 95% 37.55–43.36)**, raw index 54.76. Control on the same 1,447 rows: 29.34 (26.15–32.25).
- Calibration, test, base 27: raw acc 0.631 / conf 0.894 / ECE 0.263 / Brier 0.597 / over95 0.157;
  at T: conf 0.659 / **ECE 0.058** / Brier 0.469 / **over95 0.0046**. All 34 at T: ECE 0.069, over95 0.0093.
- Modal agreement with the control (top-1, same fields): 0.737 pooled, 0.582 benchmark-weighted, 4,936 fields.
- Latency (3060, RAM experts): median 2.24 s / request, 0.89 s / question; mean 7.5 s / request.
- Prefix reuse: 2.7× fewer prefill tokens than re-reading the state per question (token count; timed cold run pending).
- Leakage check: payload = {state, questions} only. Index sits at board rank ~229 / 326 (median 52.7), in the
  band of fine-tuned 4B entries; gains are broad (API-Bank, ToolRet, MMLU-Pro, BBH, RAGTruth), HellaSwag and CLINC are
  lower than the control. Not a too-good result. Pretraining exposure to public sets can't be ruled out from here.
- Aggregates: `inkling-3pass/` (test-score/, metrics, temperature), `control-decider-2b-v10/on-inktest/`.
