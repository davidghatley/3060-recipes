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

## Measured (2026-10-30, bench.py: 3 runs per case, medians of runs 2–3, 256 output tokens, effort low)
| Mode | chat decode | code decode | 4K prompt: prefill / decode | 8K prompt: prefill / decode |
|---|---|---|---|---|
| Faster (5 experts, default), 01:26 | **4.98** | 4.78 | 91 / 4.57 | 126 / 4.59 |
| Full quality (6 experts), 09:07 | 4.10 | 3.69 | 89 / 3.48 | 113 / 1.99* |

\*Not representative: the first 8K run decoded at 3.37, the next two at 1.59 and 2.39. VRAM use was about 300 MiB higher during all three 8K runs, and NVMe reads fell to 510–1,000 MB/s in the two slow ones, so the SSD was not the limit. Cause not identified; other work on the machine is possible. The modes ran 7.5 h apart, so the comparison isn't controlled. Excluding that case, Full quality was about 18–24% slower.

- Short prompts read at only 3.5–4.7 tok/s, so a 60-token prompt still takes 12–19 s. Prefill speed only reaches the 90–125 tok/s range on long prompts.
- Server up and warm-up reply done about 35 s after start.
- VRAM: 11.3–11.8 GB used. Dense weights take 5.86 GB; 252–262 of the 15,360 experts fit in VRAM (Strata's plan said 841).
- RAM: the engine sized its expert store at 26–27 GB (from about 38–39 GB free). Scope memory peak was 34.9 GB (Faster) and 30.6 GB (Full), so the 44 GB cap never bound. About 10 GB stayed available during the runs.
- NVMe: median about 1.3–1.4 GB/s during decode, against peaks of 2.4 GB/s seen in the smoke run. CPU: about 4.8 cores busy on average over the Faster run.
- CPU lane share: about 72–78% on short prompts. It falls as long prompts run (29% down to 10%), so it looks like a running counter that includes prefill, not a decode-only figure.
- The DSpark drafter turned itself off ("gains nothing" when the experts are this far off the GPU).
- Skipped: the llama.cpp baseline. Strata downloaded the older 4-shard layout, which current llama.cpp can't load without converting it, and conversion needs about 138 GB more disk (118 GB free).

## The same run from a hard disk (2026-11-22, not a controlled comparison)

The CPU-vs-NVMe runs (`bottleneck.sh`) started with their control (`bn-ctl1`: Faster mode, `--ssd-cache 27`, chat, 3 runs) and decoded at **0.39–0.48 tok/s**, with a **200–210 s** wait for the first token of a 60-token question. In October the same case ran at 4.98 tok/s with a 12–19 s wait.
Cause: `/mnt/models/llm/deepseek-v41-flash` has been a symlink to `/mnt/archive` since 2026-11-19 03:22. That drive is a Seagate ST1000DM003, a 7200 rpm hard disk (`sdd`), so the ~100 GB of experts that are read in place came off the HDD. The run was stopped after the chat case so it wouldn't hold the shared GPU. Raw data: `runs/bn-ctl1.*`, `runs/20261122-121736-bn-ctl1-*`.

| chat, Faster mode | 2026-10-30, Micron NVMe | 2026-11-22, Seagate HDD |
|---|---:|---:|
| Decode (median of runs 2–3) | 4.98 tok/s | 0.46 tok/s (−91%) |
| Wait for the first token, 60-token prompt | 12–19 s | 201–210 s |
| RAM store | ~27 GB, sized from free RAM | 27 GB (`--ssd-cache 27`), 2,628 experts |
| Experts in VRAM | 252–262 | 244 |
| RAM available while running | ~11 GiB | ~22 GiB |
| CPU busy (whole box, median) | | 18% |
| System I/O pressure, "full" (avg60) | | 41–42%, 0 after the run stopped |

This is not the controlled comparison `bottleneck.sh` was written for: a different day, a different disk, and twice the free RAM. The sampler also read the wrong disk: it sampled `/mnt/models` (the NVMe, 0 MB/s) instead of the drive behind the symlink. `run_variant.sh` now resolves the pack's real path, logs which device it is on, and samples that one.
What it does show: storage is not a side detail of "runs on 12 GB". With the same GPU, RAM store and engine, the disk that holds the cold experts sets decode speed to within an order of magnitude. On the HDD the box sat waiting on I/O (pressure 42%) with the CPU 82% idle.

The planned runs (threads 3 / 6 / 12, RAM store 13.5 / 27 GB, controls on both sides) still need the pack back on an NVMe. `/mnt/models` has 9 GB free and the pack is 241 GB, so that is a disk-space decision, not a script change.

## Verdict
**True, with caveats.** A single 12 GB GPU does run the model. But "runs" means about **4.6–5 tok/s decode** and 90–125 tok/s prefill on long prompts on this box, because most of the 763B model lives in RAM and on the SSD. That's about half the README's 9–11 tok/s for a 3060, below `--plan`'s 7.2, and at the bottom of the installer's "5–7". This box has more RAM than that 46 GB test rig, so RAM alone doesn't explain the gap.

**Bottleneck: storage first, the rest not yet separated.** Decode is not GPU-memory-bound in any useful sense. Moving the cold experts from the NVMe to a hard disk cut decode from 4.98 to 0.46 tok/s (above, uncontrolled), so the disk dominates once it is slow. On the NVMe, CPU vs disk is still not separated. Untested ideas: more free RAM for the store, a faster NVMe. Use Faster mode: it is the default and was quicker in every case.

## Log
- 2026-10-29 21:30: download started at about 14 MB/s, so roughly 5 h for 257 GB. The DeepSeek engine (strata-dsv41 0.1.54, CUDA 13, 445 MB) installed to `~/.local/share/strata/install/engine-dsv41/`, ignoring STRATA_DATA_DIR.
