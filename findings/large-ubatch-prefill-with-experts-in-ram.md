---
title: "With experts in RAM, a 4096-token micro-batch gives 4.1x prefill and 8192 adds almost nothing"
date: 2026-11-22
group: experts-in-ram
recipes: [flint]
provenance: ours
provenance_note: "Raising the batch size is common community practice; the numbers and the round-2 result that contradicts our own transfer model are ours."
credit: ["llama.cpp"]
evidence: ["flint/RESULTS.md:15-16", "flint/RESULTS.md:32", "flint/PLAN.md:15-16", "flint/experiments/RESULTS.md:84-86"]
applies_to: "llama.cpp with host-resident experts and op offload, on prompts around 10k tokens."
---

During prefill llama.cpp copies the RAM-resident experts to the GPU once per micro-batch, so a larger micro-batch amortizes the copy.

Measured here on Flint Q4_K_M: llama-bench prefill at 4096 tokens goes from 375 tok/s at `-ub 512` to 1,546 at `-ub 4096`. On the server, a cold 11k-token prompt goes from 329 to 1,708 tok/s with the full tuned flag set, and time to first token from 33.4 s to 6.4 s.

Going further did not pay. `-ub 8192` saved 0.1 s of a 6.2 s wait on the 11k prompt and cost 3–6% decode, because its larger compute buffer takes VRAM from the MoE cache. The transfer model in the recipe's THEORY.md predicted 1.4 s saved, so at `-ub 4096` the expert copy is no longer the limit at this length. What is, was not profiled.

Use `-b 4096 -ub 4096`.
