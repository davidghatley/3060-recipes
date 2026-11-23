---
title: "Unsloth's smaller Inkling quants are faster, and only KLD shows what they cost"
date: 2026-11-22
group: quants
recipes: [inkling-2-mini]
provenance: ours-measuring-others-work
provenance_note: "The files are Unsloth's and ggml-org's; the speed, context and KLD measurements on this card are ours."
credit: ["Unsloth (UD quants)", "ggml-org (IQ4_NL, Q8_0)"]
evidence: ["inkling-2-mini/RESULTS.md:20", "inkling-2-mini/RESULTS.md:99-126", "inkling-2-mini/RESULTS.md:128-139", "inkling-2-mini/RESULTS.md:268"]
applies_to: "Inkling-2-Mini; the lesson about gates applies to any quant comparison."
---

The UD files in the root of unsloth/Inkling-2-Mini-GGUF do not load on llama.cpp master. They are a pre-merge conversion with the loop unrolled to 48 blocks. The files in the repo's `Mainline_Support/` folder, named `*.gguf_file`, do load.

Measured here at 64k on the shipped build: UD-IQ2_XXS fits on the GPU whole and decodes at 41.4 tok/s with 295 tok/s prefill at 8k, against 29.0 and 144 for IQ4_NL. UD-IQ3_XXS gives 31.0 and 205. KLD against Q8_0 on wikitext rises from 0.0085 (IQ4_NL) to 0.028, 0.072 (UD-Q2_K_XL) and 0.091. Every file finds 3 of 3 needles and passes 8 of 8 short coding tasks, so those two gates do not separate them.

The default stays IQ4_NL. The smaller files are options through `INK_QUANT=iq3xxs`, `q2kxl` or `iq2xxs`. The 2-bit files are untested on hard work.
