---
title: "On a looped MoE, put the loop core's experts on the GPU before anything else"
date: 2026-11-20
group: looped-moe
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "Placement and measurement are ours; the byte-count ceiling method used to predict it is from 0xSero's inference-optimisation skill."
credit: ["0xSero / Sybil Solutions (inference-optimisation skill)", "llama.cpp (Inkling support, PR #32694)"]
evidence: ["inkling-2-mini/RESULTS.md:11-12", "inkling-2-mini/RESULTS.md:262", "inkling-2-mini/THEORY.md:16-17", "inkling-2-mini/THEORY.md:28", "inkling-2-mini/THEORY.md:42"]
applies_to: "Any model whose weights are reused several times per token (looped or shared layers) with more experts than VRAM."
---

Inkling-2-Mini runs layers 6–17 three times per token, so the experts of those 12 layers are read three times while the other 12 layers' experts are read once. The core experts are 6.4 GiB of the 14.7 GiB expert total but carry 70% of the expert bytes read per token.

Measured here with IQ4_NL at 64k context: all experts in RAM decodes at 17.5 tok/s. Moving only the core experts to the GPU gives 29.0 tok/s (1.66×), and 8k prefill goes from 39 to 145 tok/s. In llama-bench the placement alone is 29.67 against 17.6 tok/s (+68%). Needles are 3/3 at 32k and 62k, with 10.6 GB of VRAM in use.

The placement is a tensor-override regex that keeps the experts of layers 0–5 and 18–23 on the CPU and leaves layers 6–17 on the GPU. `serve.sh` in the recipe carries the exact pattern.
