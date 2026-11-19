# Flint tuning log

Hill-climb of Flint Q4_K_M serving speed on one RTX 3060 12 GB + i5-12500 + 62 GB DDR5, llama.cpp b12242 (3b4d6ab3f).
Method: [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill) by 0xSero / Sybil Solutions. Compute the ceiling first, change one thing per run, run a control on both sides, accept only if the candidate beats both controls, gate on long-context retrieval.
Ceilings: `THEORY.md`. Raw data: `runs/bench-*.jsonl` (llama-bench, with `-dmon.txt` telemetry) and `runs/server-ledger.jsonl` (server tests).

Goals: lower opencode time-to-first-token (prefill of its ~11k-token system prompt), then decode tok/s, keeping 128k context stable. Lossless changes only.

## Experiments (2026-11-18)

llama-bench numbers are mean ± sd of 3–4 repetitions; server numbers are medians of 4–6 requests using llama-server's own timings.

| # | Change | Test | Control(s) | Candidate | Verdict |
|---|---|---|---|---|---|
| 1 | `-ub` 512 → 1024/2048/4096 (`-b 4096`) | bench pp4096 | 375.4, 375.6 | 635 / 1,048 / **1,546** | **Accept 4096.** Prefill is PCIe-transfer bound; bigger chunks amortize the expert copy. |
| 2 | `-ub` 4096 → 8192 | bench pp16384 | 1,423 | 1,648 (+16%) | **Reject for now.** Needs ~3 GB more VRAM; does not fit next to 128k f16 KV. |
| 3 | KV q8_0 → f16 | bench tg128 @ depth 0 / 32k | 50.2/34.0, 50.5/34.1 | 51.5 / **43.9** | **Accept.** +29% decode at 32k. Matches the skill's llama.cpp gotcha: quantized KV is slow on models with few KV layers (Flint: 14 of 49). |
| 4 | `-ncmoe` 47 → 43/39/35 | bench pp4096 / tg128 | 1,570/51.4, 1,569/51.3 | 43: 1,639/53.4 · 39: 1,722/55.4 · 35: 1,816/57.8 | **Accept 43 (server).** ~+4% decode and +5% prefill per 4 layers, ~1.7 GB VRAM each; 128k f16 KV leaves room for 4 layers. |
| 5 | threads `-t` 4/5/8/12 vs 6 | bench tg128 | 51.5, 51.2 | 48.1 / 50.1 / 51.4 / 48.4 | **Keep 6.** Matches RAM bandwidth saturating at 6 threads (57 GB/s). |
| 6 | `--poll` 0 / 100 vs 50 | bench tg128 | 51.5 | 51.0 / 51.3 | **Reject.** Noise. |
| 7 | `--load-mode none` (read into RAM, no mmap) | bench pp4096 | 1,571.5 (and 1,574 earlier) | **1,948** (+24%) | **Accept.** Decode unchanged. llama.cpp also warns about mmap with CPU tensor overrides. |
| 8 | Server, old config → #1+#3+#7 at `-ncmoe 47`, 128k | cold 11k prefill / decode code / prose | 329 tok/s (33.4 s TTFT) / 46.7 / 48.2 | **1,687 (6.5 s)** / 48.9 / 50.1 | **Accept.** 5.1× prefill. |
| 9 | Server, `-ncmoe 47 → 43` | same + needles | 1,687 / 48.9 / 50.1 | **1,742 (6.3 s)** / 50.6 / 52.0 | **Accept.** VRAM 10.8 GB of 12.3 after load and after a 121k-token request. Needles 3/3 at 60k and 120k. |
| 10 | `--spec-type ngram-mod` | decode code / prose | 50.6 / 52.1 | 52.1 (accept 56%) / 51.9 (22%) | **Reject.** Inside noise. |
| 11 | `--spec-type ngram-map-k` | decode code / prose | 50.6 / 52.1 | 61.4 (accept 75%) / 52.1 | First result looked like +21%, but per-request data was bimodal: 72 tok/s when the model was copying the file, 48–51 otherwise. |
| 11b | Repeat of 11 (final config, 6 reps) | decode code / prose | 50.6 / 52.1 | 50.0 (accept 30%) / 51.9 | The win did not repeat with 1500-token limits (output was mostly fresh reasoning). |
| 11c | ngram-map-k vs none, 4000-token limit | decode code | 49.8 ×4 (sd 0) | 50.0 / 52.9 / 61.3 / 50.2, median 51.5 | **Accept, labelled modest.** Never below the control in this test; +23% on the request that copied the most text; 48.1 worst single request in 11b (−5%). Expect gains only when output repeats context (file rewrites, edit tool calls). Set `FLINT_SPEC=none` to turn off. |

Not tried, and why:
- Draft-model / MTP / EAGLE speculation: no Flint draft model or MTP head in this GGUF.
- `--swa-full`: costs VRAM, no speed reason.
- JIT/graph caches (skill lever 1): not applicable; llama.cpp already reuses CUDA graphs and loads in ~15 s.

## Status

Best config is now the default in `serve.sh` (2026-11-19, `FLINT_PROFILE=128k`):
`-ncmoe 49 --moe-cache-mib 2944 --moe-cache-cpu-share 0.95 -c 131072 -b 4096 -ub 4096 -ctk f16 -ctv f16 --load-mode none --spec-type ngram-map-k -t 6 -fa on`.
It decodes 58.8 tok/s (prose), vs 51.9 for the first tuned config, which remains as `FLINT_PROFILE=nocache` (`-ncmoe 43`, no cache). `FLINT_PROFILE=64k` gives 63.4. Evidence: `experiments/RESULTS.md` exp 5 and `experiments/runs/phaseF*.log`.

What limits further gains:
- Prefill: PCIe transfer of 19.5 GB of experts per 4096-token chunk. Bigger chunks need VRAM held by the 128k KV cache. Gains would need overlapping copy with compute inside llama.cpp, or a smaller quant.
- Decode: ~75% of the ~69 tok/s ceiling. RAM bandwidth is saturated at 6 threads.

Remaining levers, ranked:
1. Trade context for speed: at 64k context the freed ~1.6 GB fits `-ub 8192` (+16% prefill at 16k prompts) or 4 more expert layers (+4% decode). A per-session choice, not a default.
2. Tune ngram-map-k sizes (`--spec-ngram-map-k-size-n/-m`, `--spec-ngram-map-k-min-hits`) on real opencode traces.
3. A smaller expert quant (Q3_K / IQ3) would cut bytes in both RAM and PCIe paths, but it is lossy and needs a quality check.
