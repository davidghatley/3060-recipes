# flint

Serving [Flint](https://huggingface.co/RecursiveSI/flint) (40B-A2.5B MoE: 49 layers, 256 experts top-6 plus shared experts) on the RTX 3060 12 GB with stock llama.cpp, at 128k context, as the local model behind [opencode](https://opencode.ai).

The 23.4 GB Q4_K_M GGUF does not fit in 12 GB. This recipe puts every routed expert in RAM and spends the freed VRAM on llama.cpp's adaptive MoE cache, which keeps the hot experts on the GPU. On code, the top quarter of experts takes ~58% of routing picks, so a 2.9 GB cache serves ~45% of expert reads from VRAM.

Numbers are in [RESULTS.md](RESULTS.md). The tuning log is [PLAN.md](PLAN.md), the ceilings are in [THEORY.md](THEORY.md), the deeper experiments (context profiles, MoE cache, requant, routing skew, engine prototype) are in [experiments/RESULTS.md](experiments/RESULTS.md), and the raw data is in `runs/` and `experiments/runs/`.

## Result

| Single user, 128k context | Old `serve.sh` | **This recipe (default)** | Ceiling |
|---|---:|---:|---:|
| Prefill, cold 11k-token opencode system prompt | 329 tok/s (33.4 s) | **1,708 tok/s (6.4 s, 5.2×)** | ~2,600 |
| Prefill, 121k-token prompt | | 989 tok/s | |
| Decode, prose | 48.2 tok/s | **58.8 tok/s (+22%)** | ~69–76 |
| Decode, code task (mostly reasoning) | 46.7 | 55.0–55.8 | |
| Decode at 32k depth | 34.0 | 46.8–47.2 | |
| Needles, 3 codes at 60k / 120k | | 3/3, 3/3 | |
| KL divergence vs the all-GPU path (wikitext) | 0.076 (CPU experts, no cache) | 0.070 | |
| VRAM, after a 121k request | | 11.3 GiB of 12 | |

## Use it

```bash
# weights: ggml-org/Flint-GGUF, Flint-Q4_K_M.gguf (23.4 GB) -> /mnt/models/llm/flint/
# engine:  llama.cpp b12242 (3b4d6ab3f) release build, CUDA 12.8 -> /mnt/scratch/llama.cpp/b12242/
./serve.sh                       # 128k profile, OpenAI-compatible on 127.0.0.1:8081, through gpu_run
./opencode.sh                    # opencode with opencode.json pointed at it
FLINT_PROFILE=64k ./serve.sh     # faster decode, half the context
```

## Profiles

| `FLINT_PROFILE` | Context | Placement | Decode, prose / code | Cold 11k prefill | Use it when |
|---|---:|---|---:|---:|---|
| **`128k`** (default) | 131,072 | all experts in RAM, 2944 MiB cache, ngram-map-k spec | 58.8 / 55–56 | 1,708 | opencode and anything that might grow past 64k. Spec only helps when output repeats the context (file rewrites, edit calls) and never measured below the control. |
| `64k` | 65,536 | all experts in RAM, 5248 MiB cache, spec off | 63.4 / 60.9 | 1,749 | sessions that stay under 64k: +8% decode. Spec is off because it cost 4–8% with this cache size (58.2 / 58.4 with it on). |
| `nocache` | 131,072 | experts of 43 layers in RAM, 4 on the GPU, no cache | 51.9 / 50–51.5 | 1,751 | a reference point without the MoE cache: the first tuned config, and the comparison for any cache change. Prefill is ~2.5% faster; decode is 12% slower. |

All profiles use `-b 4096 -ub 4096`, f16 KV, `--load-mode none` (weights read into RAM, not mmap'd), `-fa on`, 6 threads and one slot. `GPU_RUN_MEM=44G` is set, because the RAM-resident experts take ~20 GB plus buffers and gpu_run's 20 GB default cap would bind.

Overrides: `FLINT_CONTEXT`, `FLINT_CPU_MOE`, `FLINT_MOE_CACHE_MIB`, `FLINT_MOE_CACHE_SHARE`, `FLINT_SPEC` (`none` to turn off ngram speculation), `FLINT_KV`, `FLINT_UBATCH`, `FLINT_THREADS`, `FLINT_MODEL`, `FLINT_PORT`, `FLINT_GPU_WAIT` (seconds to wait for the shared GPU lock, default 120). Extra llama-server flags go after `./serve.sh`.

## What was tried and didn't ship

| Idea | Result |
|---|---|
| Bigger 128k cache (3200 / 3328 MiB), cpu-share 0.80 / 0.90 | within noise of 2944 / 0.95; the hit rate stops climbing past 2944 MiB (exp 5, 6) |
| cpu-share 1.0 (freeze the cache once full) | loses most of the gain: 52 vs 58.8 tok/s (exp 5) |
| `-ub 8192` at 64k / 32k | +1.7% prefill on 11k prompts, −3 to −6% decode (exp 6) |
| Mixed placement (some expert layers on the GPU plus a smaller cache) | no better than all-in-RAM with a bigger cache at the same VRAM (exp 5) |
| q8_0 KV | −29% decode at 32k depth; f16 KV kept (PLAN #3) |
| Threads ≠ 6, `--poll`, CPU pinning, `GGML_CUDA_GRAPH_OPT` | noise or worse; RAM bandwidth saturates at 6 threads (PLAN #5–6, exp 2) |
| ngram-mod speculation | noise (PLAN #10) |
| RAM experts requantized Q4_K_M → Q3_K / IQ4_XS | Q3_K +7% speed, but KLD 0.34 and 78.8% top-1; IQ4_XS no speed gain (exp 3) |

## Where the remaining time goes

- **Decode** reaches ~77–85% of the bandwidth ceiling. With experts in RAM, the CPU expert matmuls run at ~80% of the 57 GB/s DRAM peak, and the GPU and CPU halves of each layer run one after the other. The next gains need engine work: an async-copy prototype in `experiments/` gives +3%, and overlapping the shared expert with the CPU split is worth up to ~5%.
- **Prefill** of the 11k opencode prompt takes ~6.2 s at ub 4096, and bigger micro-batches don't shorten it (exp 6).

## Tools

| Script | What it does |
|---|---|
| `serve.sh` | the server, with the profiles above |
| `opencode.sh`, `opencode.json` | opencode pointed at the local server (128k context, 4k output) |
| `tools/bench.sh`, `summarize.py` | one llama-bench run through gpu_run with `nvidia-smi dmon` telemetry |
| `tools/servertest.py` | server tests: cold 11k prefill, code rewrite, prose decode, needles; appends to a ledger |
| `tools/membw.c` | RAM read bandwidth probe (AVX2) |
| `experiments/tools/srv.sh` | start `serve.sh` with overrides, wait for health, run tests (`TESTS`, `EXTRA`), stop cleanly |
| `experiments/tools/exp5probe.py` | warm-up windows, greedy hashes, decode at 32k depth |
| `experiments/tools/phase*.sh` | the sweeps behind each experiment |
| `experiments/tools/requant.sh`, `routing_skew.py`, `static_cache.py` | requant of only the RAM experts; routing-skew analysis |
| `../scripts/codeeval.py` | 8 Python tasks against asserts, temperature 0 |

`promo/` holds the Remotion video for this recipe.

## Credits

- llama.cpp for the engine and its MoE cache (`--moe-cache-mib`); ggml-org for the GGUF.
- RecursiveSI for Flint; bartowski for the imatrix used in the requant experiment; unsloth for the UD-Q3_K_XL GGUF.
- The tuning method comes from 0xSero's [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill): ceilings first, one change at a time with controls, and output gated as well as speed.
