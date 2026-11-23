---
title: "Reading weights into RAM instead of mmap gives 24% faster prefill with experts on the host"
date: 2026-11-18
group: experts-in-ram
recipes: [flint]
provenance: ours
provenance_note: "llama.cpp's own warning about mmap with CPU tensor overrides points at this flag; the measurement is ours."
credit: ["llama.cpp"]
evidence: ["flint/RESULTS.md:33", "flint/PLAN.md:21"]
applies_to: "llama.cpp with tensor overrides that keep weights on the CPU."
---

With experts kept in RAM, loading the weights with `--load-mode none` instead of the default mmap makes the host-to-GPU copies during prefill faster.

Measured here on Flint Q4_K_M with llama-bench at 4096 prompt tokens: 1,571.5 tok/s with mmap against 1,948 with `--load-mode none`, a 24% gain. Decode is unchanged.

The weights then count as ordinary process memory, not page cache. On a box with a memory cap, size the cap for the full expert set plus buffers. For Flint that is about 20 GB of experts.

Flag: `--load-mode none`.
