---
title: "On a small all-VRAM model decode is already at 74-93% of the bandwidth ceiling"
date: 2026-11-19
group: method
recipes: [qwen35-3d-coder]
provenance: ours
provenance_note: "Analysis from timing and byte counts measured here, with no profiler trace; the ceiling method is 0xSero's."
credit: ["0xSero / Sybil Solutions (inference-optimisation skill)", "llama.cpp (CUDA backend)"]
evidence: ["qwen35-3d-coder/RESULTS.md:16", "qwen35-3d-coder/RESULTS.md:232-260"]
applies_to: "Small models that fit in VRAM on llama.cpp CUDA."
---

Before writing a custom kernel for a model that fits in VRAM, compare measured time per token with bytes read per token divided by measured bandwidth. Here the gap is small.

Measured on the 3D coder at 342 GB/s: Q8_0 takes 15.8 ms against a 13.4 ms ceiling, Q5_K_M 12.1 against 9.3 and Q4_K_M 11.0 against 8.2. The gap is a roughly fixed 2–3 ms per token. Turning CUDA graphs off costs 6.3%, so launch overhead is already mostly hidden. Attention is at bandwidth.

With MTP on, the hot path changes. A 3-token verify costs 1.04× a single token on Q8_0 and 1.13–1.17× on Q4_K. An 8-token batch (21.9 ms) is slower than a 16-token one (17.3 ms), because the switch to the batched K-quant kernels comes late on this card.

Speculation was worth +31% with no new CUDA code. A fused single-token kernel is estimated at about +15%.
