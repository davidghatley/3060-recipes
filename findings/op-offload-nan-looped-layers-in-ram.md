---
title: "Looped layers with experts in RAM give NaN prompts when op offload is on"
date: 2026-11-22
group: looped-moe
recipes: [inkling-2-mini]
provenance: independent-also-upstream
provenance_note: "Hit here on 2026-11-21 and reported upstream by someone else as llama.cpp #32710 the same day; who was first is unclear, and the scheduler root cause is that issue's, while the exact threshold, the one-layer case and the image symptom were measured here."
credit: ["llama.cpp issue #32710 (root cause)"]
evidence: ["inkling-2-mini/RESULTS.md:18", "inkling-2-mini/RESULTS.md:68-83", "inkling-2-mini/RESULTS.md:284-296", "inkling-2-mini/notes/upstream-drafts.md"]
applies_to: "llama.cpp with Inkling-2-Mini; likely any looped model where a shared layer's experts sit on the host."
---

On llama.cpp master, any batch of 32 or more tokens that runs a loop-core layer whose experts sit in RAM comes out NaN while op offload is on, which is the default. That includes the common `-ot exps=CPU` placement, and image prompts come back as "????".

Measured here with llama-perplexity on IQ4_NL, build 225a5345b: all experts in RAM gives NaN at `-ub 512` and `-ub 32`, and PPL 6.02 at `-ub 31`. One core layer in RAM is enough to trigger it. With the core on the GPU and only layers 0–5 and 18–23 in RAM, PPL is 6.03. Decode is batch 1 and never offloads, so decode numbers are not affected.

Workarounds: keep layers 6–17 on the GPU, or pass `--no-op-offload`. Check prefill output with a perplexity run, not only its speed.
