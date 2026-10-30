# Test DeepSeek-V4.1-Flash GSQ-RCO GGUF on the RTX 3060 (Strata)

## Context
The ISTA-DASLab card claims "With Strata, every build runs on a single GPU with 12 GB of VRAM." The model has 763B total parameters, with 384 routed experts per layer and 6 active per token. The card means:

- the dense weights plus a cache of hot experts sit in VRAM;
- the remaining experts are computed on the CPU, read in place (mmap) from the GGUFs;
- the 203 GB Engram n-gram table is read from the SSD, a few rows per token.

So the claim is plausible, but it relies on lots of system RAM and a fast NVMe. Strata's own measurement on almost the same rig: **RTX 3060 12 GB with 46 GB RAM, IQ2_XXS (2.00 bpw): 8–11 tok/s decode, about 150 tok/s prefill at 4–8K.** For comparison, an RTX 5070 12 GB with 64 GB RAM and a 3.6 GB/s NVMe got only about 4.7 tok/s. Disk and CPU-side speed matter more than the GPU.

Goal: check the claim on this box and measure real tok/s.

## This machine (checked)
- RTX 3060 12 GB, PCIe 4.0 x16, driver 610.57. Strata ships CUDA 13 builds, which need driver ≥580, plus sm_86. Supported.
- i5-12500 (6 cores / 12 threads) and 62 GB RAM. About 36 GB is available right now: 25 GB is in use, and zram swap is 15 GB used.
- Disk: `/` has only 17 GB free, so the model can't go there. **`/mnt/models` (Micron NVMe, 359 GB free)** holds the full IQ2_XXS set (about 257 GB with the drafter) and leaves about 100 GB. `/mnt/scratch` is a slower SK hynix BC501, so don't use it for the Engram.
- GPU is idle (ComfyUI has 318 MB cached, nothing queued, lock is free).
- **Trap:** `gpu_run` wraps jobs in `memcap`, a systemd scope with MemoryMax=20G. That cap counts page cache, so with the default it would starve the expert cache and turn the run into SSD paging. Run with `GPU_RUN_MEM=44G`, which matches Strata's 46 GB test rig and stays inside the gpu-share "≤ ~48 GB RAM" rule.

## Prediction (before running)
| Scenario | Decode | Prefill (4K) |
|---|---|---|
| Strata, IQ2_XXS, 44 GB cap, Faster mode (5 experts, the default on ≤16 GB GPUs) | ~7–10 tok/s | ~120–150 tok/s |
| Same, Full quality (6 experts) | ~5–8 tok/s | similar |
| Cap at 20 GB (wrong) | ~1–3 tok/s | — |
| Stock llama.cpp b11870+, `-ot exps=CPU` (optional baseline) | ~1–4 tok/s | low |

Risk to check first: Strata's dense pack is 16.8 GB, but that is for Unsloth's Q8 pack. The ISTA dense tensors are Q5_K–Q8_0, and the docs don't state their dense size. Strata measured a 3060 on this exact set, so it should fit. If it doesn't, the engine fails at start with out-of-memory, and Step 3 catches that within minutes.

## Steps
1. **Project home:** use the empty `~/Projects/3060-recipes/`, set up per the new-project skill (git, CLAUDE.md, PLAN.md). Put `.gitignore` entries for model files there. Results go in `3060-recipes/deepseek-v41-strata/RESULTS.md`, and models live at `/mnt/models/llm/deepseek-v41-flash/`.
2. **Install Strata without piping it to sh:** download `Strata-0.2.8-linux-x86_64.AppImage` (or `install.sh`) into an empty dir and read the install script before running it. Prefer `strata launch --family deepseek41 --model ist-das-2.00bpw --plan` first: it prints what it will download and where, and it lets us point the model dir at `/mnt/models/llm/deepseek-v41-flash`. If Strata insists on its own download path, use `hf download ISTA-DASLab/DeepSeek-V4.1-Flash-1017-GSQ-RCO-GGUF --include "*IQ2_XXS*" "*Engram*"` into `/mnt/models` and pack it with Strata's `tools/dsv41/pack_gguf.py`. Don't use `--skip-tensors` or `--dense-override`, which give garbage output.
3. **Download about 257 GB** in the background (rate unknown, so measure it). Log to `run.log` and check on it with the job-status skill.
4. **First boot smoke test** through the queue:
   `GPU_RUN_MEM=44G ~/anime-pipeline/tools/gpu_run --free --need 11000 strata launch --family deepseek41 --model ist-das-2.00bpw --context 8192`
   Record VRAM use, how many experts land on the GPU vs CPU (from the startup log), and RSS. Send one short prompt and check the output makes sense.
5. **Benchmark script** (`bench.py`, run with `python -I`), pointed at Strata's OpenAI endpoint `127.0.0.1:8080`:
   - Prompts: short chat; a code task; a 4K-token prompt; an 8K-token prompt. Use reasoning effort `low`, `max_tokens` 256, 3 runs each, and throw away the first (cold cache).
   - Measure prefill tok/s (prompt tokens ÷ time to first token) and decode tok/s (output tokens ÷ generation time), from streaming timestamps and the usage field.
   - Variants: Faster (5 experts) vs Full quality (6), and `--dspark auto` drafter on/off.
   - Sample `nvidia-smi` (VRAM, util, temperature), RAM and `iostat` on nvme0n1 during the runs to show where the bottleneck is.
   - Keep each batch under 30 min, per gpu-share.
6. **Optional baseline:** llama.cpp ≥ b11870 with `-ngl 99 -ot "exps=CPU"` on the same files, short prompt only. This shows what Strata adds.
7. **Write-up:** put a table of measured vs Strata-published vs predicted in `RESULTS.md`, with a verdict on the 12 GB claim (true / true-with-caveats). Commit.

## Verification
- The model loads with VRAM ≤ 12 GB and no OOM. Peak RAM stays under the 44 GB cap with no memcap kill.
- Coherent answers on a sanity set: an arithmetic question, a short code function, a factual question.
- Numbers repeat across runs 2–3 within about 15%. Decode in the 7–10 tok/s range means the claim holds as Strata advertises it. If decode falls below ~3 tok/s, check `iostat`. Heavy NVMe reads mean the RAM cap or the page cache is the limit.

## Not doing
IQ1_M or IQ2_XS builds (disk), contexts beyond 32K, vision (mmproj).
