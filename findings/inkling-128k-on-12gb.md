---
title: "128k context on Inkling fits only with core layers 6-15 on the GPU and ub 64"
date: 2026-11-22
group: looped-moe
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "Measured here; a community report of larger batches on the same card was not reproduced, and the explanation that their card was otherwise empty is an inference from buffer sizes, not a measurement."
credit: ["llama.cpp PR #32740", "llama.cpp PR #32752", "the community reporter of the 128k layout"]
evidence: ["inkling-2-mini/RESULTS.md:143-193", "inkling-2-mini/RESULTS.md:234-254"]
applies_to: "Inkling-2-Mini IQ4_NL on a 12 GB card that also drives a desktop."
---

On the shipped build, the only layout that runs a 128k window on this card keeps the experts of core layers 6–15 on the GPU, layers 16–17 and the rest in RAM, with `--no-op-offload` and `-ub 64`.

Measured here: it loads at 11.35 GB, runs a 124k-token prompt with 3 of 3 needles, prefills at 56.0 tok/s and decodes at 14.6 tok/s after it. Empty-context decode is 26.4 tok/s. Adding layer 16 loads and then fails on the first request. With op offload on, nothing loads at 128k on any build. With the unmerged PR #32740 the same layout runs at `-ub 256`: 90.8 tok/s prefill and 18.9 decode at 124k.

Use `INK_PROFILE=128k ./serve.sh`. Up to 64k the default layout is faster.
