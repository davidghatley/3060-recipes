---
title: "Unmerged llama.cpp PR 32740 gives 2.5x prefill on Inkling at 64k on this card"
date: 2026-11-22
group: looped-moe
recipes: [inkling-2-mini]
provenance: ours-measuring-others-work
provenance_note: "The PR is another author's work; the build and measurements on a 12 GB card are ours."
credit: ["llama.cpp PR #32740 and its author"]
evidence: ["inkling-2-mini/RESULTS.md:26", "inkling-2-mini/RESULTS.md:54-66", "inkling-2-mini/RESULTS.md:180", "inkling-2-mini/notes/upstream-drafts.md"]
applies_to: "Inkling-2-Mini on llama.cpp; becomes the default build once the PR merges."
---

PR #32740, which stores the attention bias compactly, is the largest gain left for the default Inkling quant on a 12 GB card. It is not merged, so the recipe does not use it by default.

Measured here on master 225a5345b with the PR applied, IQ4_NL at 64k: the compute buffer at `-ub 512` is 1100 MiB where stock master and the recipe's F16 patches run out of memory. That allows `-ub 512`, which gives 362.5 tok/s prefill at 8k against 144.1 (2.5×), 297.1 at 62k against 102.9 (2.9×), and 24.1 tok/s decode at 62k against 20.2 (+20%). Needles are 3 of 3 at 62k.

At 128k the same PR runs the 6–15 layout at `-ub 256` with about 1 GB to spare.
