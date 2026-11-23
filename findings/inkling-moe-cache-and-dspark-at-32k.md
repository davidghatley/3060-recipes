---
title: "With spare VRAM at 32k, the MoE cache adds 10-12% and the DSpark drafter a median 14-20%"
date: 2026-11-22
group: drafting
recipes: [inkling-2-mini]
provenance: ours-measuring-others-work
provenance_note: "The MoE cache is llama.cpp's, the DSpark drafter is Unsloth's and runs through unmerged PRs #32218 and #32773 by other authors; the measurements are ours."
credit: ["llama.cpp (MoE cache)", "Unsloth (DSpark drafter)", "llama.cpp PRs #32218 and #32773"]
evidence: ["inkling-2-mini/RESULTS.md:196-209"]
applies_to: "Inkling-2-Mini at 32k or less on a 12 GB card."
---

Both levers need VRAM that the 64k default does not have, so both were measured at 32k, as the median of 6 capped coding answers with controls in the same GPU session.

A 768 MiB MoE cache takes IQ4_NL from 29.1 to 32.0 tok/s (+10%) and UD-IQ3_XXS from 31.3 to 35.1 (+12%). It passed the 32k gate with 3 of 3 needles and is a supported option: `INK_CONTEXT=32768 INK_MOE_CACHE_MIB=768 ./serve.sh`.

The DSpark drafter with 3 draft tokens gives a median 33.0 against 29.0 tok/s on IQ4_NL, but the range is 25.7–36.4. The two answers with under 50% acceptance came out slower than the control. On UD-IQ2_XXS it gives 49.4 against 41.2 with one control. DSpark was not run through the needle gate and is not in `serve.sh`.
