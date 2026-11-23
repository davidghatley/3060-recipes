---
title: "Greedy-output identity is the wrong quality gate when placement changes"
date: 2026-11-19
group: method
recipes: [flint, qwen35-3d-coder]
provenance: ours
provenance_note: "Measured here; the general idea of gating on output is from 0xSero's skill, and this narrows when a hash comparison is valid."
credit: ["0xSero / Sybil Solutions (inference-optimisation skill)"]
evidence: ["flint/experiments/RESULTS.md:137-148", "qwen35-3d-coder/RESULTS.md:223-230"]
applies_to: "Any engine where a change moves a matmul between CPU and GPU or between batch sizes."
---

Comparing greedy output hashes before and after a change flags valid configurations as broken whenever the change moves computation between CPU and GPU.

Measured here on Flint: turning on the MoE cache changes the greedy text on 2 of 3 prompts. So does changing only how many layers' experts sit in RAM, with no cache at all: three placements gave three different hashes, while three runs of one placement hashed the same. CPU and GPU round differently and near-tied tokens flip. On the 3D coder, speculative decoding at temperature 0 matched on 4 of 6 outputs, and at every divergence the top two tokens were 0.002–0.10 nats apart.

Use KL divergence against a fixed reference instead. On Flint the cache measured 0.070 against 0.076 for the plain CPU-expert path, so it adds no error. Keep the hash check for runs where placement is unchanged.
