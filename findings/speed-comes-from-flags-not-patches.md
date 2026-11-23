---
title: "Inkling's speed-up comes from flags alone and the patches only make 64k fit"
date: 2026-11-20
group: looped-moe
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "Measured here after a reader asked whether the patches were needed for the speed."
credit: ["llama.cpp"]
evidence: ["inkling-2-mini/RESULTS.md:319-331", "inkling-2-mini/RESULTS.md:52"]
applies_to: "Inkling-2-Mini on llama.cpp master."
---

The tuned Inkling-2-Mini flags give the same speed on unpatched llama.cpp master as on the patched build. The recipe's patches matter only for fitting 64k of context on a 12 GB card.

Measured here on master 29b52d398 with IQ4_NL: llama-bench decodes at 29.40 tok/s unpatched against 29.07–29.45 patched. A 32k server on unpatched master decodes at 29.0 tok/s, and at 23.68 tok/s after a 29.6k-token prompt. At 64k, unpatched master loads and then runs out of memory on the first request, with about 0.95 GB of the card held by the desktop. Round 2 on master 225a5345b gave the same outcome.

If 32k of context is enough, use stock master with the recipe's flags and skip the patches.
