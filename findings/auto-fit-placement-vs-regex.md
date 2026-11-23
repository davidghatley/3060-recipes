---
title: "Automatic --fit placement loses 40-63% against the hand-written expert regex"
date: 2026-11-22
group: looped-moe
recipes: [inkling-2-mini]
provenance: ours-measuring-others-work
provenance_note: "Our measurement of llama.cpp's fit logic and of the unmerged PR #32777 by another author."
credit: ["llama.cpp PR #32777"]
evidence: ["inkling-2-mini/RESULTS.md:85-97"]
applies_to: "Looped or MoE models on llama.cpp where only some tensors are worth the VRAM."
---

llama.cpp's automatic placement does not find the fast Inkling-2-Mini layout on its own. Measured here with `llama-fit-params` at 64k, q8_0 KV and `-ub 128`, then llama-bench with what it chose, against regex controls at 29.3 tok/s in the same session.

Stock master with the default margin picks whole layers and decodes at 10.84 tok/s. With `--fit-target 256` it puts some core experts in RAM and reaches 16.96 tok/s. PR #32777 with margins of 512, 256 or 128 MiB gives 16.4–17.0 tok/s. Only PR #32777 with `--fit-target 0` chooses the recipe's placement, at 29.40 tok/s.

Every setting that puts a core layer in RAM also lands on the NaN placement. The zero-margin case was benchmarked but not run with a real 64k request. Keep the regex.
