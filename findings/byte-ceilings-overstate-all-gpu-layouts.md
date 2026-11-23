---
title: "Byte-count ceilings overstate what an all-GPU layout can reach"
date: 2026-11-22
group: method
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "The ceiling method is 0xSero's; the finding that per-layer overhead, not bytes, bounds the all-GPU case on this model is ours and refines it."
credit: ["0xSero / Sybil Solutions (inference-optimisation skill)"]
evidence: ["inkling-2-mini/RESULTS.md:141", "inkling-2-mini/THEORY.md:36-42"]
applies_to: "Deep or looped models with many small layer applications per token."
---

A decode ceiling computed as bytes read per token divided by memory bandwidth can be far above what the GPU delivers when a token makes many layer applications.

Measured here on Inkling-2-Mini: UD-IQ2_XXS runs entirely on the GPU and reads about 2.7 GB per token, which at the card's 342 GB/s allows roughly 125 tok/s. It measures 43.4. That is 23 ms per token, or about 0.48 ms for each of the 48 layer applications. IQ4_NL with the core on the GPU takes 34.1 ms: the same 23 ms plus about 11 ms for the applications that read experts from RAM. UD-IQ3_XXS with the same layers in RAM is no faster than IQ4_NL (29.2 against 29.3 tok/s) although its RAM experts are 40% smaller.

Add a per-layer overhead term to the ceiling before promising a speed-up from a smaller quant.
