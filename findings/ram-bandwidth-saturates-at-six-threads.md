---
title: "On an i5-12500 RAM read bandwidth peaks at 6 threads and so does decode"
date: 2026-11-18
group: box-and-harness
recipes: [flint, inkling-2-mini]
provenance: ours
provenance_note: "Measured here with a small AVX2 probe written for the recipe."
credit: []
evidence: ["flint/THEORY.md:9", "inkling-2-mini/THEORY.md:9", "flint/PLAN.md:19", "flint/experiments/RESULTS.md:182-193", "inkling-2-mini/RESULTS.md:265", "flint/tools/membw.c"]
applies_to: "Other 6-core dual-channel desktops; measure with the probe before assuming."
---

On this CPU, RAM read bandwidth stops growing at 6 threads, and expert-in-RAM decode follows it.

Measured here with a 2 GiB AVX2 sum, best of 5: 25.6 GB/s at 1 thread, 50.9 at 4, 57.0 at 6 and 56.4 at 12. Flint decode with llama-bench is 51.5 tok/s at `-t 6` against 48.1, 50.1, 51.4 and 48.4 at 4, 5, 8 and 12 threads. On Inkling, 8 threads is +0.8%, inside noise, and 4 and 12 are worse.

Pinning one thread per core, `GGML_CUDA_GRAPH_OPT=1` and `--poll` changes are all noise on Flint (52.3–52.4 against 52.4–52.5).

Use `-t 6`. The probe is `flint/tools/membw.c`. Use its number, not the DIMM rating, for decode ceilings.
