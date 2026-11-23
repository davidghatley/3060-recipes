---
title: "Running Inkling's loop fewer than 3 times drops accuracy to near chance for little speed"
date: 2026-11-21
group: looped-moe
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "Measured here with a local loop-count override; the Decision Index kit and board used as the harness are other people's work, credited in the eval notes."
credit: ["the Decision Index kit and Space authors (see eval/INDEX_NOTES.md)"]
evidence: ["inkling-2-mini/runs/eval/LOG.md:71-81", "inkling-2-mini/runs/eval/loop-passes.png", "inkling-2-mini/eval/INDEX_NOTES.md"]
applies_to: "Looped models trained at a fixed pass count; likely relevant to other looped releases."
---

Cutting the number of loop passes is not a usable speed lever on Inkling-2-Mini. The model was trained at 3 passes and falls apart at 2 or 1.

Measured here on the test split of a decision benchmark, 1,447 rows per setting with no errors: the index is 40.13 at 3 passes (95% interval 37.55–43.36), 4.95 at 2 passes and 2.59 at 1 pass. Benchmark-weighted accuracy goes from 0.646 to 0.335 and 0.328. Top-1 agreement with the 3-pass answers is 0.27 for both.

The time saved is small, 17–29% per question, because prefill of the layers whose experts sit in RAM dominates.

The override used for the experiment is `--override-kv inkling2_loop.loop.count=int:N` on a patched build. Leave it at 3.
