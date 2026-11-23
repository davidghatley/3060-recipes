---
title: "DeepSeek-V4.1-Flash 763B does run on a 12 GB card, at about 5 tok/s"
date: 2026-10-30
group: disk-bound
recipes: [deepseek-v41-strata]
provenance: ours-measuring-others-work
provenance_note: "The engine is Strata and the 2.00 bpw files are ISTA-DASLab's; this is our check of their published claim on our box."
credit: ["Strata", "ISTA-DASLab (GSQ-RCO GGUF)", "DeepSeek"]
evidence: ["deepseek-v41-strata/RESULTS.md:3-18", "deepseek-v41-strata/RESULTS.md:28-43", "deepseek-v41-strata/RESULTS.md:65-66"]
applies_to: "Strata with very large MoE models on a 12 GB card and about 64 GB of RAM."
---

The claim that every build of this model runs on a single 12 GB GPU with Strata is true with caveats. Most of the model lives in RAM and on the SSD.

Measured here from an NVMe drive, Faster mode, 256 output tokens: 4.98 tok/s on chat, 4.78 on code, and 4.57–4.59 after 4k and 8k prompts. Prefill is 91 tok/s at 4k and 126 at 8k. Short prompts are read at only 3.5–4.7 tok/s, so a 60-token question waits 12–19 s. Full-quality mode was about 18–24% slower.

That is about half the 9–11 tok/s in the engine's table for a 3060. Only 252–262 of 15,360 experts fit in VRAM where the install plan said 841. Peak memory was 34.9 GB, NVMe reads were about 1.3–1.4 GB/s, and the drafter turned itself off.

Whether CPU or disk limits decode on NVMe is not separated yet.
