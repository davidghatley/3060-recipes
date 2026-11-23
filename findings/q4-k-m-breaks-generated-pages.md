---
title: "Q4_K_M is the fastest 3D-coder quant and breaks twice as many pages"
date: 2026-11-19
group: quants
recipes: [qwen35-3d-coder]
provenance: ours
provenance_note: "Quants built and measured here; the model and its dataset are ccore's."
credit: ["ccore (Qwen3.5-4B-3D-Coder and its scene dataset)"]
evidence: ["qwen35-3d-coder/RESULTS.md:15", "qwen35-3d-coder/RESULTS.md:76-144"]
applies_to: "Small code models where a single wrong token breaks the output."
---

On a 4B model that writes about 10k tokens of JavaScript per answer, Q4_K_M's speed is not usable.

Measured here on 20 validation prompts, one sample each, pages rendered in headless Chromium on the CPU: 10 pages work at Q8_0, 9 at Q5_K_M and 5 at Q4_K_M. 62% of Q4_K_M's finished pages throw an error, against 29% and 33%. Its errors are token-level slips such as `THREE.Object33D` and a name declared twice. KLD against F16 predicts the split: 0.0011 for Q8_0, 0.0073 for Q5_K_M and 0.0256 for Q4_K_M.

Q4_K_M decodes at 84.8 tok/s task-weighted against 77.5 for Q5_K_M, 9% faster. Q5_K_M ships. Reasoning loops happen at every quant and come from the model, not the quantization.

A quant that is faster but fails the task eval is rejected.
