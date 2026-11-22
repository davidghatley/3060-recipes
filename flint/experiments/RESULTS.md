# Flint experiments: context profiles, hand-off, RAM-expert requant, routing skew, MoE cache

Box: RTX 3060 12 GB, i5-12500 (6P/12T), 62 GB DDR (57 GB/s read measured, `../runs/membw.txt`).
Model: `/mnt/models/llm/flint/Flint-Q4_K_M.gguf` (49 blocks, 47 MoE layers × 256 experts top-6 plus a shared expert; routed experts Q4_K 19.83 GiB).
Engine: stock llama.cpp b12242 (`/mnt/scratch/llama.cpp/b12242`, commit 3b4d6ab3f), the same binary `serve.sh` ships.
For profiling and the engine prototype, a self-built clone of the same commit lives at `/mnt/scratch/src/llama.cpp-flint`:
- branch `flint-prof`, commit d92b92422, adds `[FLINT-PROF]`
- branch `flint-async`, uncommitted on top of it, adds `[FLINT-ASYNC]`
- patches: `runs/flint-prof.patch` and `runs/flint-async.patch`
- build: `tools/build-main.sh` (RelWithDebInfo, sm_86, CUDA 12.9 / GCC 14 conda env)

Method:
- Every run goes through `gpu_run` with `GPU_RUN_MEM=44G` and waits for an idle CPU first (`tools/quiet.sh`, ≥ 90% idle).
- A/B runs go back to back against a fresh control.
- Server numbers use llama-server's own `timings` with `FLINT_SPEC=none`, so speculative decoding doesn't mix in.
- The server runs `serve.sh` unchanged with env overrides (`tools/srv.sh`). Server tests:
  - warm-up: 4 × 1024 forced tokens, with 128-token window rates
  - prose and cold 11k: `../tools/servertest.py`
  - tg @32k: one 32.5k-token prompt plus 256 tokens
  - greedy: 3 prompts × 128 tokens at temp 0, compared by hash
  - needles: 3 codes at 10/50/90% depth, all must come back
- Ledgers: `runs/server-ledger.jsonl`, `runs/exp5-ledger.jsonl`. Server logs: `runs/server-<label>.log`. Bench logs: `runs/bench-<name>.*`.
- Tables: `tools/exp5table.py`, `tools/summarize.py`, `tools/profsum.py`.

Reference: the shipped profile (128k, -ncmoe 43, f16 KV, ub 4096) measured
- server decode 51.6–52.1 t/s across three controls through the night
- llama-bench tg128 52.5, pp4096 2026, tg @32k 44.8

## Summary

| Exp | Result | Recommendation |
|---|---|---|
| 5 MoE cache | +14% decode at 128k, +23% at 64k (63.4 t/s), +8–11% at 32k depth, prefill −2…−5%. Needles 3/3 up to 120k. KLD no worse than the no-cache CPU path. | **Ship as recipe profiles** |
| 1 64k f16 | -ncmoe 37 fits, 55.1 t/s (+7%), cold 11k prefill +6%; -ncmoe 35 does not load | Ship, but the 64k cache profile beats it |
| 2 hand-off | Hand-off is ~1.1 ms of an 18.9 ms token, not 3–4 ms. CPU experts run at 80% of DRAM bandwidth. The mainline knobs are noise. Async copy prototype: +3.0% decode. | Needs engine patch (small); see sketch |
| 3 RAM-expert requant | Q3_K: +7% tg/pp, but top-1 agreement 78.8% and KLD 0.34. IQ4_XS: +3% pp, tg noise, KLD 0.17. | Drop. A clean requant needs a BF16/Q8_0 source download that doesn't fit on disk now. |
| 6 cache size, cpu-share, `-ub 8192` (2026-11-22) | 128k: 3200 / 3328 MiB and cpu-share 0.90 all within noise of 2944 / 0.95 (57.7–59.3 vs 59.2). `-ub 8192`: cold 11k prefill +1.7% at 64k and 32k, decode −3 to −6% (the bigger compute buffer takes cache VRAM). | **Keep the shipped profiles.** Reject `-ub 8192`. |
| 4 routing skew | On code the top 25% of experts take 57–59% of selections and the top 50% take 79–81%. Two Python samples agree well (top-25% overlap 0.76, ρ 0.81); Python vs C++ less so (0.62). | Explains exp 5 |

## Experiment 6: cache size, cpu-share and `-ub 8192` (2026-11-22)

Same harness as experiment 5 (`tools/srv.sh`, `FLINT_SPEC=none`, `-lv 4`), script `tools/phaseG2.sh`, log `runs/phaseG2.log`.
The first attempt (`tools/phaseG.sh`, `runs/phaseG.log`) is void. Other sessions held the GPU lock, so six servers gave up after `serve.sh`'s 120 s wait, and its first control decoded 18.7 t/s while another job was running. `serve.sh` now takes `FLINT_GPU_WAIT` (default 120, unchanged), and `srv.sh` flags runs that end with another compute process on the GPU.
In G2, control 1's prose test was lost: `srv.sh` was edited while it ran (the bash re-read trap again). Its warm-up requests 2–4 ran at 58.1 / 59.3 / 58.2.

| config (ctx, ub, cache MiB, cpu-share) | VRAM MiB | prose t/s | cold 11k prefill t/s (TTFT) | hit rate (ub≤8) |
|---|---:|---:|---:|---:|
| 128k, 4096, 2944, 0.95 (ctl1, warm-up only) | 11288 | (58.1–59.3) | | 47.6% |
| 128k, 4096, 3200, 0.95 | 11592 | 59.3 | | 45.7% |
| 128k, 4096, 3328, 0.95 | 11730 | 57.7 | | 49.2% |
| 128k, 4096, 2944, 0.90 | 11316 | 58.8 | | 47.6% |
| 128k, 4096, 2944, 0.95 (ctl2) | 11346 | **59.2** | | 46.0% |
| 64k, 4096, 5248, 0.95 (shipped 64k) | 11402 | **63.3** | **1746.6 (6.29 s)** | 58.8% |
| 64k, 8192, 3200, 0.95 | 11024 | 59.3 | 1776.0 (6.18 s) | 45.4% |
| 32k, 4096, 6144, 0.95 | 11146 | **64.8** | 1768.3 (6.21 s) | 63.0% |
| 32k, 8192, 5120, 0.95 | 11534 | 62.8 | 1798.9 (6.10 s) | 56.7% |

Findings:
- **The 128k cache is at its knee.** Past 2944 MiB the hit rate stops climbing (45.7–49.2% in all four runs), and decode stays at 57.7–59.3. 3328 MiB leaves ~550 MiB of VRAM, less than the 121k-token request needed in experiment 5. cpu-share 0.90 equals 0.95 again.
- **`-ub 8192` buys almost no prefill on an 11k prompt.** It saves 0.1 s of a 6.2 s TTFT (+1.7%). Its compute buffer costs ~1 GB of cache at the same VRAM, which costs 3–6% decode. That rules it out for opencode-style use, where TTFT is dominated by an 11k system prompt.
- This contradicts the transfer model in `../THEORY.md`. That model predicts 3 → 2 expert copies (−1.4 s) for an 11k prompt, but the measured saving is 0.1 s. So at ub 4096 the per-chunk expert copy is no longer what limits server prefill at this length. Either compute dominates or the copies overlap. This wasn't profiled. Experiment 2's +16% at pp16384 (llama-bench, no cache) still stands for longer prompts.
- A 32k context with a 6144 MiB cache decodes 64.8 t/s, only +2% over the 64k profile. Not shipped as a profile.

## Experiment 5: MoE expert cache (`--moe-cache-mib`, `--moe-cache-cpu-share`)

How it works, from `src/llama-moe-cache.cpp`:
- VRAM slots hold host-resident experts. Decode ubatches (≤ 8 tokens here) compute a hit on the GPU.
- Misses are split between the CPU and an upload, set by cpu-share (the share of misses computed on the CPU once the cache is full). Each upload replaces a slot under an LRFU/MQ policy.
- Large batches use cached experts as copies.
- One expert (gate+up+down, Q4_K) is 1.69 MiB, so 2944 MiB = 1737 slots = 14.4% of all host experts at -cmoe.

All server runs use `-lv 4` so the cache prints its hit stats at exit. Warm-up columns are the four 1024-token requests; the bracket is req 1's first → last 128-token window.

| config (ctx, experts on host, cache MiB, cpu-share) | VRAM MiB | warm-up t/s req1/2/3/4 (req1 first→last window) | prose t/s | cold 11k prefill t/s (TTFT) | tg @32k | hit rate (ub≤8) |
|---|---:|---|---:|---:|---:|---:|
| 128k, n43, no cache (ctl1) | 11327 | 51.7 / 51.6 / 51.6 / 51.7 | 51.5 | 1748.9 (6.28 s) | 43.3 | – |
| 128k, n43, no cache (ctl2 / ctl3) | 11257 | 51.7 / 51.7 / 51.6 / 51.6 ; 52.1 / 52.1 / 52.1 / 52.0 | | | | – |
| 128k, all 47, no cache | 8559 | 48.8 / 48.7 / 48.8 / 48.8 | | | | – |
| 128k, all, 1024, 0.95 | 9619 | 53.1 / 53.5 / 54.0 / 54.2 | | | | 25.1% |
| 128k, all, 1984, 0.95 | 10579 | 56.2 / 56.4 / 56.5 / 56.9 | | | | 34.8% |
| **128k, all, 2944, 0.95** | 11609 | 58.7 / 58.1 / 59.0 / 58.1 (58.0→65.9) | **58.8** | 1705.4 (6.44 s) | **46.8** | 44.7% |
| 128k, all, 2944, 0.80 | 11539 | 58.4 / 57.6 / 58.4 / 58.2 | | | | 46.7% |
| 128k, all, 2944, 1.00 | 11539 | 51.3 / 52.0 / 52.2 / 52.6 | | | | 19.1% |
| 128k, n47, 2100, 0.95 | 11609 | 57.5 / 57.5 / 58.2 / 61.7 | | | | 37.7% |
| 128k, n45, 1600, 0.95 | – | does not load (compute buffer OOM) | | | | |
| 128k, n43, 512, 0.95 | 11801 | 54.4 / 54.5 / 54.8 / 54.9 | | | | 17.7% |
| 96k, n41, no cache | 10967 | 53.1 / 53.2 / 53.2 / 53.1 | | | | – |
| 96k, all, 4096, 0.95 | 11539 | 61.5 / 61.8 / 61.5 / 62.1 (58.1→61.2) | | | | 51.6% |
| 64k, n39, no cache | 10747 | 54.1 / 54.3 / 54.3 / 54.2 | 54.1 | 1814.3 (6.05 s) | 45.0 | – |
| 64k, n37, no cache | 11609 | 54.8 / 55.3 / 55.4 / 55.2 | 55.1 | 1847.0 (5.94 s) | | – |
| 64k, n43, 2688, 0.95 | 11743 | 60.7 / 62.7 / 62.3 / 61.8 | 61.9 | 1785.4 (6.15 s) | 49.4 | 44.8% |
| **64k, all, 5248, 0.95** | 11609 | 63.4 / 63.1 / 64.2 / 63.3 (59.4→64.0) | **63.4** | 1748.7 (6.28 s) | **49.8** | 58.4% |
| 64k, all, 5248, 1.00 | 11539 | 57.1 / 55.0 / 54.6 / 54.5 | | | | 31.2% |

Findings:
- **The cache is the biggest win found tonight.**
  - At the shipped 128k context, moving all experts to the host and spending the freed VRAM on a 2944 MiB cache gives +14% decode (51.6 → 58.8), with +8% at 32k depth.
  - At 64k, a 5248 MiB cache gives 63.4 t/s: +23% vs the shipped profile and +15% vs the best 64k no-cache profile (n37, 55.1).
- **cpu-share matters most.**
  - 1.0 means that once the cache is full nothing new is ever uploaded, so it freezes with whatever filled it first. That is 19–31% hits and decode decays (64k: 57 → 54.5).
  - 0.8 and 0.95 are equal within noise. The tune script's short runs showed 0 and 0.5 well below 0.95 (1984 MiB: 39.6 / 49.1 / 51.4 t/s at 0 / 0.5 / 0.95).
  - Use 0.95.
- **Size trades against context smoothly.** At 128k: 1024 → 1984 → 2944 MiB gives 54.0 → 56.5 → 58.8.
- **Mixed placements are no better than all-on-host with a bigger cache at the same VRAM.** n43 + 2688 at 64k reached 61.9, vs 63.4 for all + 5248. n47 + 2100 at 128k reached ~58, about the same as all + 2944.
- **Warm-up:** the first 128-token window of the first request runs 5–10% below steady state. Steady state is reached within ~256 tokens. There's no further drift across requests, and the cache stays warm between requests.
- **Prefill:** large batches only copy cached experts, which doesn't help. cold 11k prefill drops 2.5% at 128k (1749 → 1705) and 5% at 64k vs n37 (1847 → 1749). TTFT at 11k rises by 0.15–0.35 s. pp4096 can't be measured with llama-bench (it has no cache flag), so cold 11k on the server is the prefill number here.
- **Long context:** needles 3/3 at every depth tried.
  - 64k all + 5248: 30k and 62k (prefill 1308 t/s at 62k).
  - 64k n43 + 2688: 30k and 62k.
  - 128k all + 2944: 60k and 120k. The 120k request prefilled at 989 t/s and decoded at 35.9 t/s, with no OOM and VRAM steady at 11585 MiB.

**Output check.** Greedy text with the cache is not byte-identical to the no-cache control: prompt 1 always matches, prompts 0 and 2 diverge after some tokens. This is not specific to the cache. Changing only -ncmoe (n39 / n41 / n43, no cache) also changes the greedy hash (`c187b204` / `ff5f5bf4` / `5b61b463`), while three n43 controls hash the same. A cache hit computes that expert on the GPU instead of the CPU, which is a different but equally valid rounding path.

KL divergence on wikitext-2 (20 × 512) against the Q4_K_M base logits (ub 2048: every expert matmul runs on the GPU) quantifies it:

| run (ub 8, so the decode path is used) | Mean KLD | same top-1 | PPL(Q) (base 21.84) |
|---|---:|---:|---:|
| no cache, -cmoe | 0.0761 ± 0.0064 | 91.61% | 22.46 |
| no cache, -ncmoe 43 | 0.0763 ± 0.0065 | 91.65% | |
| cache 2944, 0.95, -cmoe (34.7% hits) | 0.0700 ± 0.0057 | 91.86% | 22.77 |
| Q4_K_M vs its own base (same flags, ub 2048) | 0.000000 | 100.00% | (deterministic) |

The cache does not add error. It sits at or below the plain CPU decode path's distance from the GPU path, because hits run on the GPU. Logs: `runs/kld-ub8-*.log`, `runs/kldbase-q4km.log`.

**Tune script (`scripts/moe-cache-tune.py`) suggestion: none produced.**
- At 128k with -ncmoe 43, its fixed first probe (10% of experts = 1984 MiB) OOMed. Log moved to `runs/moetune-n43-128k-oom/`.
- With -cmoe at 128k it ended with "the runs do not determine the time model".
- At 64k it crashed on a truncated trace (`struct.error`).
- Cause: its servers are stopped through `gpu_run`'s signal forwarding, so exit stats and the trace are not flushed. Only 1 of 6 runs wrote stats.
- Its 6-point short runs still rank configs the same way as the sweep above (`runs/moetune-*.txt`).
- **Incident:** when the command changed, the script deleted files in its own `--out` dir (`runs/moetune-cmoe-64k/run-1984-0.{log,trace,json}` and `run-1984-0.5.log.failed-race`). They were regenerated by the rerun. Give it a fresh `--out` per command.

**Why it works (from experiment 4).**
- Code routing is concentrated: the top 14.4% / 20% / 25.8% of experts per layer take 44% / 53% / 60% of the selections in the same text. These are oracle static hot sets.
- The cache's measured hit rates at those sizes (2944 / 4096 / 5248 MiB, all experts on the host) are 44.7% / 51.6% / 58.4%, matching the oracle.
- A hot set chosen in advance from a different code sample would get only 38% / 46% / 53%. One chosen from general calibration text would get 22% / 29% / 35% (`runs/static-cache.txt`).
- So the adaptive cache gets the full benefit of the skew, which a static `-ot` pinning of hot experts can't.
- Each hit moves a 1.69 MiB expert read from DRAM (~46 GB/s effective) to VRAM (~360 GB/s). That is why decode tracks the hit rate.

Proposed profiles, as env overrides of `serve.sh`, nothing edited:
- **128k:** `FLINT_CPU_MOE=49 ./serve.sh --moe-cache-mib 2944 --moe-cache-cpu-share 0.95` gives 58.8 t/s.
- **64k:** `FLINT_CONTEXT=65536 FLINT_CPU_MOE=49 ./serve.sh --moe-cache-mib 5248 --moe-cache-cpu-share 0.95` gives 63.4 t/s.
- Both leave ~350–450 MiB VRAM headroom. They were not tested together with the ngram speculative decoding that `serve.sh` enables by default; that should be checked before shipping.

## Experiment 1: 64k context, f16 KV, lower -ncmoe

| profile | VRAM MiB | llama-bench pp4096 / tg128 / tg @32k | server decode | cold 11k prefill (TTFT) | server tg @32k | near-full needles |
|---|---:|---|---:|---:|---:|---|
| 128k n43 (shipped) | 11327 | 2026.0 / 52.5 / 44.8 | 51.6 | 1748.9 (6.28 s) | 43.3 | 60k, 120k 3/3 (earlier work) |
| 96k n41 | 10967 | 2056.5 / 53.3 / – | 53.1 | | | |
| 64k n39 | 10747 | 2097.8 / 54.6 / 46.2 | 54.2 | 1814.3 (6.05 s) | 45.0 | 30k 3/3, 62k 3/3 (VRAM steady 10.7 GB) |
| 64k n37 | 11609 | – | 55.1 | 1847.0 (5.94 s) | | run queued (`E-64k-n37-ndl` in `tools/phaseB3.sh`, results in `runs/phaseB3.log`) |
| 64k n35 | – | does not load: "failed to allocate compute pp buffers" | | | | |

The no-cache 64k profile gains about 7% decode and 6% prefill. The 64k + cache profile in experiment 5 is 15% faster again at the same VRAM, so 64k without the cache isn't worth shipping on its own.

## Experiment 2: CPU↔GPU hand-off in mainline decode

**Knobs, stock b12242, llama-bench tg128, r3:**

| run | tg128 |
|---|---:|
| control 1 / control 2 | 52.5 ± 0.2 / 52.4 ± 0.1 |
| `--cpu-mask 0x555 --cpu-strict 1` (one thread per P-core) | 52.3 ± 0.2 |
| `GGML_CUDA_GRAPH_OPT=1` | 52.4 ± 0.3 |
| `--prio 2` | not run: "failed to set process priority: Permission denied" (needs privileges; no sudo used) |

Op-offload is already on (the default). The cost of placement shows in -ncmoe: 41 → 53.3 and 39 → 54.6.

**Profile.** `[FLINT-PROF]`: `GGML_SCHED_PROF=1` synchronizes after every split and prints per-graph copy and compute times. Median per decode token at -ncmoe 43 (`runs/bench-B2-prof-on.err`, 129 tokens):

| | copy | compute |
|---|---:|---:|
| GPU splits (42 per token, 94 inputs, 2.0 MB) | 0.69 ms | 8.31 ms |
| CPU splits (42 per token, 82 inputs, 0.34 MB) | 0.41 ms | 9.48 ms |
| total | **1.10 ms** | 17.79 ms |

- The token takes 18.9 ms, which matches 52 t/s (the profiling syncs cost < 1%).
- The input hand-off is 1.1 ms, about 6% of the token, not 3–4 ms.
- The CPU part reads 6 experts × 41 layers × 1.69 MiB ≈ 415 MiB per token in 9.5 ms. That is ≈ 46 GB/s, 80% of the measured 57 GB/s DRAM peak.
- So decode with experts in RAM is bandwidth bound. The GPU and CPU phases serialize (each MoE layer waits for the previous attention, and the next attention waits for the experts). That serialization, not copy latency, is the remaining structural cost.

**Why the copies are slow** (`ggml_backend_sched_compute_splits`, ggml-backend.cpp):
- GPU→CPU: the CPU backend has no `cpy_tensor_async`. Each input falls back to `ggml_backend_synchronize(gpu)` plus a blocking `tensor_get`, which is a `cudaMemcpyAsync` followed by `cudaStreamSynchronize`. That is one or more full syncs per input.
- CPU→GPU: CUDA's `cpy_tensor_async` requires both buffers on CUDA, so it falls back to a sync plus a blocking `set_tensor`.

**Prototype `[FLINT-ASYNC]`** (`GGML_SCHED_ASYNC=1`, `runs/flint-async.patch`, +44 lines, off by default):
- For a CPU split, queue every device→host input read with `ggml_backend_tensor_get_async` on the device stream and synchronize once.
- For a device split, queue host→device uploads with `ggml_backend_tensor_set_async` and don't wait on the host. Before the next CPU split reuses host memory, synchronize that device once.
- Only plain, contiguous, non-graph-input tensors take this path, and only when no pipeline-parallel events or prefetch are involved. Everything else uses the old code.

| run (self-built 3b4d6ab3f, -ncmoe 43, ABAB) | tg128 |
|---|---:|
| ctl 1 (r5) | 52.5 ± 0.1 |
| async 1 (r5) | 54.1 ± 0.3 |
| ctl 2 (r5) | 52.5 ± 0.4 |
| async 2 (r5) | 54.1 ± 0.3 |
| ctl @32k (r3) | 44.7 ± 1.1 |
| async @32k (r3) | 45.7 ± 1.0 (+2.2%, within noise of the depth runs) |
| ctl pp4096 (r3) | 2004.7 ± 1.5 |
| async pp4096 (r3) | 2007.4 ± 4.8 (no change: prefill offloads expert matmuls to the GPU, so few hand-offs) |

+3.0% decode. The profile with async on shows copy time falling from 1.10 to 0.54 ms per token (`runs/bench-B2-prof-async.err`), which is exactly the 0.56 ms/token gain. A greedy-identity check of async vs control on the server, and async combined with the 64k cache, are queued (`tools/phaseB3.sh`, `tools/phaseB2b.sh`). See `runs/phaseB3.log` and `runs/phaseB2b.log`.

**Further patch sketch, not prototyped: overlap the shared expert.**
- In `flint.cpp`'s layer build, the shared-expert FFN is built after the routed MoE. It therefore runs in the GPU split *after* the CPU expert split, serialized with it.
- Building `ffn_*_shexp` before `build_moe_ffn`, or giving the scheduler a way to launch the next GPU split's independent nodes before waiting on the CPU split, would hide it behind the CPU's 0.23 ms per layer of expert compute.
- Upper bound: the shared-expert GPU time, ≤ ~1 ms per token (≈ 5%).

Recommendation: needs engine patch. The async-copy change is small, self-contained and measured (+3%). It's a reasonable upstream candidate once it's tested on multi-GPU and pipeline-parallel setups, which it currently bypasses. No issue or PR was opened.

## Experiment 3: requantize only the RAM-resident experts

`tools/requant.sh TYPE OUT`:
- stock `llama-quantize --allow-requantize` with the downloaded imatrix (`RecursiveSI_flint-imatrix.gguf`, 0.45 GB)
- per-tensor overrides change only `blk.2–42.ffn_{up,gate,down}_exps` (123 tensors, checked with a dry run). Everything else is copied verbatim.
- Outputs (`/mnt/scratch/models/flint-requant/`):
  - Q3_K: 18,117 MiB, built in 318 s
  - IQ4_XS: 21,315 MiB, built in 265 s

All runs below are stock b12242, -ncmoe 43, r3.

| model | pp4096 | tg128 | tg @32k | wikitext-2 PPL (80×512) | KLD vs Q4_K_M (20×512) | same top-1 |
|---|---:|---:|---:|---:|---:|---:|
| Q4_K_M (control) | 2026.0 ± 8.2 | 52.5 ± 0.2 | 44.8 ± 1.3 | 21.947 ± 0.612 | – | – |
| RAM experts → Q3_K | 2167.4 ± 3.5 (+7%) | 56.3 ± 0.0 (+7%) | 46.8 ± 1.4 | 22.559 ± 0.629 (+2.8%) | 0.342 ± 0.013 | 78.8% |
| RAM experts → IQ4_XS | 2095.1 ± 4.6 (+3%) | 52.9 ± 0.1 (noise) | 45.0 ± 1.0 | 21.999 ± 0.614 (+0.2%) | 0.175 ± 0.010 | 85.9% |

- KLD floor: the original Q4_K_M rerun against its own base with the same flags gives KLD 0.000000 and 100% top-1 (`runs/kld-q4km-self.log`), so the measurement is deterministic.
- The ub-8 runs in experiment 5 show that merely moving expert compute from GPU to CPU gives KLD 0.076 and 91.6% top-1. So part of each number above is path noise, but the Q3_K and IQ4_XS losses are 2–4× that floor.
- Requantizing from Q4_K_M compounds two quantizations, so these numbers overstate what a Q3_K or IQ4_XS made from BF16 would lose.
- Even so, Q3_K's +7% costs far more quality than the MoE cache's +14–23%, which costs none.
- A Q3_K server run at 128k with needles at 60k and 120k is queued (`tools/phaseB2b.sh`, label `E3-q3k-128k`). Its first attempt in phaseB2 exited at startup because of a script bug (missing `-lv 4`), not the model.

Sources on Hugging Face (checked, nothing over 10 GB downloaded):

| repo | sizes |
|---|---|
| ggml-org/Flint-GGUF | BF16 79.6 GB, Q8_0 42.4 GB, Q4_K_M 23.4 GB |
| unsloth | BF16 79.6 GB (3 shards), Q8_0 42.3 GB, UD-Q3_K_XL 18.5 GB, UD-Q4_K_XL 25.1 GB |
| bartowski | Q8_0 42.4 GB, bf16 79.6 GB, IQ4_XS 22.5 GB, Q3_K_M 19.5 GB, Q4_0 22.8 GB, imatrix 0.45 GB |

Disk: `/mnt/scratch` had 53 GB free at the start, enough for Q8_0, and has 9.4 GB free now (two requants plus the 3.5 GB KLD base file). `/mnt/models` has more free space than the brief stated, but the rule was no new files there. BF16 fits nowhere without moving things.

Recommendation: drop the requant-from-Q4 route. If lower-bit RAM experts are still wanted, it needs a download:
- either the Q8_0 source (42 GB) for a clean requant, with room freed or approved first,
- or bartowski's or unsloth's ready-made mixes, for testing as whole models.

## Experiment 4: expert routing skew on code (measurement only)

How it was measured:
- `llama-imatrix` per-expert `.counts` on three 130 KB code corpora (`tools/make_code_corpora.py`): Python stdlib set A, a disjoint Python set B, and C++ from llama.cpp.
- 24–33k tokens per layer each, `-c 4096`.
- The general calibration imatrix is included for reference.
- Analysis: `tools/routing_skew.py`, output in `runs/routing-skew.txt`.

| sample | top 10% share | top 25% share | top 50% share | unused experts | H/Hmax |
|---|---:|---:|---:|---:|---:|
| A Python 1 | 0.360 | 0.591 (layer range 0.49–0.70) | 0.814 | 0 | 0.924 |
| B Python 2 | 0.339 | 0.565 (0.46–0.68) | 0.794 | 0.1 | 0.933 |
| C C++ | 0.358 | 0.587 (0.47–0.72) | 0.813 | 0 | 0.922 |
| general calibration (reference) | 0.241 | 0.440 (0.39–0.52) | 0.688 | 0 | 0.972 |

A uniform router would give 0.10 / 0.25 / 0.50.

| stability | top-25% set overlap (random 0.25) | B's selections hit by A's top 25% | Spearman ρ |
|---|---:|---:|---:|
| Python 1 vs Python 2 | 0.756 (min layer 0.63) | 0.518 | 0.813 |
| Python 1 vs C++ | 0.620 (0.44) | 0.462 | 0.639 |
| Python 2 vs C++ | 0.649 (0.47) | 0.482 | 0.681 |
| code vs general calibration | 0.38–0.44 | 0.31–0.32 | 0.26–0.33 |

- Code is markedly more concentrated than general text: the top quarter of experts carries ~58% of the work.
- Every expert is still used, so pruning would hurt.
- The hot set is fairly stable within a language and drifts between languages. That's why an adaptive cache beats a fixed hot set (experiment 5).
- No pruned model was built.

## Skipped or blocked

- `--prio 2`: needs privileges, so it wasn't run.
- No download over 10 GB. BF16 and Q8_0 sources weren't fetched, and the disk couldn't hold them now (see experiment 3).
- The tune script never produced a recommendation (see experiment 5). It also deleted its own earlier run files once.
- Phase B (03:58) ran the profiling build before the patch was compiled in (the library was older than the source), so its PROF output was empty. Phase B2 rebuilt and reran it. `runs/bench-B-*` are plain controls only.
- `tools/sweepE.sh` was edited while it ran. Bash re-read it at a shifted offset, which reordered the 64k runs and ended in a syntax error after the last one. Every run listed above completed normally, and the one that was skipped was rerun from `tools/queue2.sh`.
- 64k -ncmoe 35 and 128k -ncmoe 45 + 1600 MiB don't fit (compute buffer allocation fails at load).

## Commands

- Sweeps: `tools/sweepE.sh`, `tools/queue2.sh`, `tools/phaseB2.sh`, `tools/phaseB3.sh`.
- Each server row is `FLINT_CONTEXT=… FLINT_CPU_MOE=… TESTS=… tools/srv.sh <label> -- -lv 4 [--moe-cache-mib N --moe-cache-cpu-share F]`.
- Bench rows: `[ENGINE=prof] [ENVS=…] tools/bench.sh <name> -ncmoe 43 -b 4096 -ub 4096 -ctk f16 -ctv f16 -lm none …`
- Quality: `tools/phaseCD2.sh`, using `llama-perplexity` with `-c 512 -b 2048 -ngl 99 -fa on -t 6 -ncmoe 43`.
- Routing: `llama-imatrix -c 4096 -b 4096 -ub 4096 -ncmoe 43`, then `tools/routing_skew.py` and `tools/static_cache.py`.
