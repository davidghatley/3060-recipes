---
title: "Put every expert in RAM and spend the freed VRAM on the MoE cache"
date: 2026-11-19
group: experts-in-ram
recipes: [flint]
provenance: ours
provenance_note: "The placement, sizing and cpu-share result are ours; the MoE cache feature is llama.cpp's."
credit: ["llama.cpp (--moe-cache-mib)"]
evidence: ["flint/experiments/RESULTS.md:89-135", "flint/experiments/RESULTS.md:65-87", "flint/RESULTS.md:11-22", "flint/RESULTS.md:35"]
applies_to: "Sparse MoE models on llama.cpp where the experts do not fit in VRAM."
---

On Flint at 128k, keeping all routed experts in RAM and giving the freed VRAM to llama.cpp's adaptive MoE cache beats placing some layers' experts on the GPU.

Measured here, Q4_K_M: 4 layers' experts on the GPU and no cache decodes at 51.6 tok/s. All experts in RAM plus a 2944 MiB cache decodes at 58.8 (+14%), and 46.8 against 43.3 at 32k depth. At 64k a 5248 MiB cache gives 63.4 tok/s. Mixed placements at the same VRAM were no better. Needles are 3 of 3 at 60k and 120k.

`--moe-cache-cpu-share 1.0` freezes the cache once full: hit rate 19–31% and decode back near 52. Use 0.95. Past 2944 MiB at 128k the hit rate stops climbing.

Flags: `-ncmoe 49 --moe-cache-mib 2944 --moe-cache-cpu-share 0.95`. Prefill drops about 2.5%.
