# 3060-recipes

Recipes for running models that are far too big for the GPU on this box: one RTX 3060 (12 GB), 62 GB RAM, i5-12500 and NVMe drives.
Each recipe lives in its own folder with a README, its scripts and a RESULTS.md that holds the measured numbers.

## Owner's rules
- Ask before downloads over 10 GB (unless an approved plan covers them), before sudo, and before touching other projects' envs.
- Never delete anything. Move it aside instead.
- GPU jobs always go through `~/anime-pipeline/tools/gpu_run` (see the gpu-share skill). Never kill processes you didn't start.
- Model weights live in `/mnt/models/llm/<name>/` and never go in this repo. `/` has almost no free space.

## Traps
- `gpu_run` caps RAM at 20 GB via `memcap` (cgroup MemoryMax), and that cap **counts page cache**.
  Engines that mmap experts (Strata, llama.cpp with `-ot exps=CPU`) need `GPU_RUN_MEM=44G`.
  The DeepSeek runs peaked at 31–35 GB, so 20 GB would bind. The effect of a low cap was not measured.
- `/mnt/models` is on the fast Micron NVMe. `/mnt/scratch` is a slower SK hynix BC501, so don't stream weights from it.
- Since 2026-11-19 `/mnt/models/llm/deepseek-v41-flash` is a symlink to `/mnt/archive` (a Seagate 7200 rpm HDD). DeepSeek on Strata decodes at ~0.46 tok/s from there, not ~5. Check `readlink -f` before benchmarking anything under `/mnt/models`.
- Run Python that reads downloaded files with `python -I`, from scripts kept outside the download dir.

## Layout
- `deepseek-v41-strata/`: DeepSeek-V4.1-Flash 763B MoE (ISTA GSQ-RCO IQ2_XXS) on the Strata engine
- `flint/`: Flint 40B-A2.5B MoE (Q4_K_M, 128k) on llama.cpp, experts in RAM with the MoE cache keeping hot ones in VRAM; `promo/` holds the Remotion video
- `qwen35-3d-coder/`: Qwen3.5-4B-3D-Coder (three.js scene writer) in VRAM, Q5_K_M on llama.cpp (restored MTP head is opt-in, 1.41x: no rollback bug and same pass rate, but 5/19 MTP pages have token-slip syntax errors vs 0/35 without)
- `inkling-2-mini/`: Inkling-2-Mini 26.4B looped MoE (IQ4_NL, 64k) on llama.cpp master + the inkfix branch (`/mnt/scratch/llama.cpp/src-inkfix`), loop-core experts on GPU, rest in RAM. Stock master gives NaN prompts when a core layer's experts are in RAM with op offload on
- `scripts/`: shared helpers (benchmark client etc.)
- `notes/`, `docs/`: research notes
