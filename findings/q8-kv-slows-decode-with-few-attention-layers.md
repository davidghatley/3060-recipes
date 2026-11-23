---
title: "q8_0 KV costs 29% decode at 32k on a model with few full-attention layers"
date: 2026-11-18
group: experts-in-ram
recipes: [flint, qwen35-3d-coder]
provenance: confirms
provenance_note: "This is a gotcha listed in 0xSero's inference-optimisation skill; measured here to confirm it and to size it on two models."
credit: ["0xSero / Sybil Solutions (inference-optimisation skill, references/gotchas.md)"]
evidence: ["flint/RESULTS.md:34", "flint/PLAN.md:17", "qwen35-3d-coder/RESULTS.md:62"]
applies_to: "llama.cpp models where only a minority of layers use full attention."
---

Quantized KV cache is slow on llama.cpp for models with few full-attention layers. Flint has 14 of 49.

Measured here on Flint Q4_K_M with llama-bench at 32k depth: 34.0 tok/s with q8_0 KV against 43.9 with f16, a 29% gain from switching back. At empty context the two are nearly equal (50.2 against 51.5). The f16 cache costs about 1.5 GB more VRAM at 128k. On the 3D coder, which has 8 full-attention layers of 32 and a KV cache of only 32 KB per token, q8_0 costs 0.6% at empty context and 4% at 16k.

Use `-ctk f16 -ctv f16` when the VRAM is there, and measure decode at depth, not only at empty context, before accepting a KV type. Inkling at 64k is the exception here: it needs q8_0 KV to fit.
