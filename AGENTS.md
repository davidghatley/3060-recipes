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

## Site rules
- A recipe is not done until its `recipe.json` validates (`.venv/bin/python scripts/validate_recipe.py`). Every number in it cites a `RESULTS.md:line` that states it.
- A new person or project used by a recipe gets an entry in `site/data/credits.json` in the same change.
- Run `.venv/bin/python site/build.py --check` before pushing; it fails on broken links and on private paths (`/home/`, `/mnt/`, hostnames, e-mail).
- Pages styling comes from Secret Sauce (`~/Projects/secret-sauce`); lint pages with `sauce-lint --surface docs --theme both`.

## Layout
- `deepseek-v41-strata/`: DeepSeek-V4.1-Flash 763B MoE (ISTA GSQ-RCO IQ2_XXS) on the Strata engine
- `flint/`: Flint 40B-A2.5B MoE (Q4_K_M, 128k) on llama.cpp, experts in RAM with the MoE cache keeping hot ones in VRAM; `promo/` holds the Remotion video
- `qwen35-3d-coder/`: Qwen3.5-4B-3D-Coder (three.js scene writer) in VRAM, Q5_K_M on llama.cpp (restored MTP head is opt-in, 1.41x: no rollback bug and same pass rate, but 5/19 MTP pages fail on syntax errors vs 0/35 without, cause unknown: its tokens are ones plain decoding could pick)
- `inkling-2-mini/`: Inkling-2-Mini 26.4B looped MoE (IQ4_NL, 64k) on llama.cpp master 225a5345b + two F16-mask patches (branch `r2-inkfix` in `/mnt/scratch/llama.cpp/src-r2`), loop-core experts on GPU, rest in RAM. Stock master gives NaN prompts when a core layer's experts are in RAM with op offload on
- `kintsugi-27b/`: Kintsugi-27B (Qwen3.8-27B dense, EXL3 trellis 2.47 bpw GGUF, 262k window) on the author's llama.cpp fork bundle v1.1.1; tiered K/V cache (VRAM cells + rest in RAM), DFlash2 drafter. `serve.sh` holds the GPU lock while serving (the bundle's launcher detaches)
- `qwen38-27b-family/`: four Qwen3.8-27B finetunes (pi-adapted, Huihui abliterated, DaisyRose, DavidAU Heretic) on llama.cpp master 225a5345b; one tuned config (q4_0 K/V, ub 256, FFN of layers 0–2 in RAM), `VARIANT=` and `Q38_PROFILE=fast|long` switches. MTP rejected
- `inkling-2-mini-uncensored/`: AtomicChat's baked AD-Q4_K (default) and nokeepai's Unbound LoRA (merged by `tools/merge_lora.py`) on the base Inkling build and layout at ub 96; refusal probe, KLD and LoRA-cost comparison
- `sensenova-loop-9b/`: SenseNova-Loop-9B (official Q5_K_M with MTP head, satellitedown abliterated Q6_K) on llama.cpp `pr32588-0ba8e4adf`; 128k q8_0 KV with MTP n=2 (default variant only), `SNL_PROFILE=long` 256k q4_0 no MTP, mmproj on both. Nothing above 256k fits (flash-attention compute buffer)
- `maxwell-v1-flash/`: Maxwell-V1-Flash 35B-A3B MoE (AtomicChat AD-Q4_K-IQ4_XS, 64k) on llama.cpp `maxwell-4f969ad24` (d3c3e242c + AtomicChat port patch); all routed experts in RAM with a 1900 MiB MoE cache, `--load-mode none`, f16 KV, ub 1024, `GPU_RUN_MEM=44G`. Uncensored LoRA at runtime halves speed
- `nemotron-bolt-e4b/`: NVIDIA Nemotron-3.5-Bolt-E4B (Q4_K_M, 64k) all in VRAM on master 225a5345b with NVIDIA's DFlash drafter (n=7, `-bs`); `nospec` profile for long prompts, `multi` for 4 × 32k slots. Drafter carries an NVIDIA evaluation licence
- `qwen35-9b-heretic/`: DavidAU Qwen3.5-9B Defiant Fable Heretic (uncensored, MTP-Q6_K) all in VRAM on master 225a5345b; own MTP head n=2 with f16 K/V at 64k. `fast` profile uses a local copy with the BF16 output head requantized to Q8_0 (KLD 0.0001), `long` 192k q4_0
- `community/`: recipes from other 3060 owners, same layout
- `findings/`: one Markdown file per finding, frontmatter says whose it is (`provenance`) and cites evidence paths
- `schema/`: JSON schemas for `recipe.json`, credits, the site indexes and skills
- `skills/`: public agent skills (MIT), served by the site; never put `local-*` skills or machine paths here
- `site/`: the GitHub Pages generator (`build.py`, `components.py`), its assets and `data/` (credits, resources)
- `scripts/`: shared helpers (benchmark client, `validate_recipe.py`, `new_recipe.py` etc.)
- `notes/`, `docs/`: research notes
