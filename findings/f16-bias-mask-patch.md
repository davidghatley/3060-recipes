---
title: "Casting Inkling's relative-bias mask to F16 cuts the compute buffer by 24%"
date: 2026-11-20
group: looped-moe
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "The two-patch change is ours; open upstream PRs #32740 and #32752 by other authors shrink the same buffer further and would replace it."
credit: ["llama.cpp PR #32740", "llama.cpp PR #32752"]
evidence: ["inkling-2-mini/RESULTS.md:271", "inkling-2-mini/RESULTS.md:280-282", "inkling-2-mini/RESULTS.md:54-66", "inkling-2-mini/patches"]
applies_to: "Inkling-2-Mini on llama.cpp until one of the upstream PRs merges."
---

Inkling has no RoPE. Every head gets an additive bias gathered from a table, so the attention mask is context × batch × 24 heads. Master builds it in F32, adds the causal mask in F32, then copies it to F16. Casting the gathered bias to F16 and adding the F16 mask directly cuts the compute buffer at 64k from 1632 to 1248 MiB at `-ub 128`, with bit-identical perplexity, because the mask only adds 0 or −inf.

That difference is what lets 64k with IQ4_NL survive its first request on a 12 GB card. Stock master loads at 11.9 GB and then fails.

One trap: a first version built the F16 tensor with `ggml_cpy` and the buffer grew to 4198 MiB, because the destination is a graph leaf and every layer's mask stayed allocated. `ggml_cast` does not have that problem.
