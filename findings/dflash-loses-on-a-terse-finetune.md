---
title: "A drafter trained on the base model loses on a fine-tune that reasons tersely"
date: 2026-11-19
group: drafting
recipes: [qwen35-3d-coder]
provenance: ours-measuring-others-work
provenance_note: "The DFlash drafter is z-lab's; the acceptance measurements and the estimate for a phase-aware switch are ours."
credit: ["z-lab (Qwen3.5-4B-DFlash)", "llama.cpp (DFlash support)"]
evidence: ["qwen35-3d-coder/RESULTS.md:56-58", "qwen35-3d-coder/RESULTS.md:66-72"]
applies_to: "Drafters paired with fine-tunes whose output style differs from the base model."
---

The z-lab DFlash drafter for Qwen3.5-4B is a clear win on the base model and a loss on the 3D-Coder fine-tune.

Measured here: on base Qwen3.5-4B the task rate goes from 78.3 to 96.7 tok/s, with 11% acceptance while reasoning and 13% while coding. On the fine-tune, acceptance while reasoning falls to 4–7% and reasoning decode is 71.5 tok/s, below the 80.7 without a drafter. The fine-tune reasons in a much terser style than the base.

While writing code DFlash is the fastest option measured, 163 tok/s at 8 draft tokens against 132 for MTP. llama.cpp tries speculation types in a fixed order and cannot switch per phase. A switch that used MTP for reasoning and DFlash for code would be worth about +8% on the task. That is an estimate from the two measured rates, not a measurement.
