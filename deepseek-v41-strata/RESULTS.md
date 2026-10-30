# DeepSeek-V4.1-Flash (IST-DAS 2.00 bpw) on Strata: RTX 3060 12 GB results

Claim checked: the ISTA-DASLab card says "With Strata, every build runs on a single GPU with 12 GB of VRAM."

## What "runs on 12 GB" means (from Strata's own install plan for this machine)
- About 841 of 15,360 routed experts (7 GB) sit on the card, along with the dense weights.
- The other 14,519 experts (125 GB) are computed on the CPU from RAM. Experts that don't fit in RAM are read from the SSD when a token needs them.
- The 111 GB Engram n-gram table stays on the SSD, a few rows per token.

## Published expectations (they disagree with each other)
| Source | 3060 12 GB, 46 GB RAM | 12 GB card, 64 GB RAM |
|---|---|---|
| Strata README table | 9–11 tok/s, ~155 tok/s prefill @4K | 4–6 tok/s (RTX 5070) |
| docs/DEEPSEEK41.md | 8–10 (code 9.9, agent 7.8), 149 tok/s @8K | ~4.7 |
| `strata launch --plan` (v0.1.54 terminal) | ~7.2 | ~4.7 |
| installer summary | — | "about 5–7 tokens a second" |

My prediction before running: 5–8 tok/s decode, 100–150 tok/s prefill at 4K, with gpu_run capped at 44 GB.

## Machine
RTX 3060 12 GB (PCIe 4.0 x16, driver 610.57) · i5-12500 6C/12T · 62 GB RAM · models on Micron MTFDKBA512TFK NVMe (`/mnt/models`)

## Setup notes
- Installed Strata Terminal 0.1.54 (release v0.2.8) with `STRATA_DATA_DIR=/mnt/models/llm/strata`. I read install.sh before running it; it verifies a SHA-256 checksum plus a signed feed and doesn't use sudo.
- The plan step says "tight: needs more disk space" even with 823 GB free on the target drive. It isn't checking the `--data-dir` disk, so the warning can be ignored as long as `HF_HOME` and `TMPDIR` also point at `/mnt/models`.
- Download: `strata install -- --family deepseek41 --model IST-DAS-2.00bpw --data-dir /mnt/models/llm/deepseek-v41-flash --yes --no-start`

## Measured
_pending_

## Log
- 2026-10-29 21:30: download started at about 14 MB/s, so roughly 5 h for 257 GB. The DeepSeek engine (strata-dsv41 0.1.54, CUDA 13, 445 MB) installed to `~/.local/share/strata/install/engine-dsv41/`, ignoring STRATA_DATA_DIR.
