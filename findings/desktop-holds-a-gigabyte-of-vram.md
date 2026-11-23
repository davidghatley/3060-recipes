---
title: "The desktop session holds about 0.95 GB of the card and that decides several fits"
date: 2026-11-22
group: box-and-harness
recipes: [inkling-2-mini, kintsugi-27b, qwen35-3d-coder]
provenance: ours
provenance_note: "Measured here; the explanation of another user's different result by an empty card is an inference from buffer sizes."
credit: []
evidence: ["inkling-2-mini/RESULTS.md:97", "inkling-2-mini/RESULTS.md:145", "inkling-2-mini/RESULTS.md:191", "inkling-2-mini/RESULTS.md:329", "kintsugi-27b/RESULTS.md:3-4", "qwen35-3d-coder/RESULTS.md:39"]
applies_to: "Any single-GPU desktop; headless boxes have about 1 GB more to work with."
---

A 12 GB card that also drives the desktop is an 11 GB card. On this box the compositor held 945–965 MiB during the Inkling runs, and about 1.4 GB together with an idle image-generation server during the 3D-coder runs.

That margin decides outcomes. Stock llama.cpp master loads Inkling at 64k and fails on its first request with about 0.95 GB taken by the desktop. Automatic placement only finds the fast layout with a zero margin. A community report of a 128k layout at `-ub 128` and `-ub 192` on the same card model did not reproduce here; the buffer sizes are consistent with their card having that 0.95 GB free, but that was not tested. Kintsugi's launcher keeps a 600 MiB margin for the same reason.

When publishing a fit, state what else was on the card. When reproducing one, check `nvidia-smi` before blaming the recipe.
