---
title: "Smaller expert quants do not speed up CPU-side decode unless their kernel is cheap per byte"
date: 2026-11-22
group: quants
recipes: [flint]
provenance: ours
provenance_note: "The requant experiment is ours; the UD-Q3_K_XL file is Unsloth's and the imatrix came from another quantizer's repo, and the suggested cause was not profiled."
credit: ["Unsloth (UD-Q3_K_XL)", "ggml-org (Q4_K_M)"]
evidence: ["flint/experiments/RESULTS.md:41-63", "flint/experiments/RESULTS.md:237-258"]
applies_to: "MoE models whose experts are computed on an AVX2 CPU."
---

With every expert in RAM, fewer bytes per expert did not mean faster decode on this CPU.

Measured here on Flint in the shipped 128k cache profile: unsloth's UD-Q3_K_XL, whose routed experts are I-quants and 22% smaller than Q4_K, decodes prose at 54.8 tok/s against 58.5 for Q4_K_M (−6%). Prefill is 8% faster, because prefill runs the experts on the GPU. KLD against Q4_K_M is 0.393 with 77.5% top-1 agreement.

Requantizing only the RAM experts gave the same pattern: plain Q3_K was +7% decode at KLD 0.342, and IQ4_XS was no faster. The likely cause is that I-quant dot products do more work per byte on AVX2. That was not profiled.

Both were rejected. The MoE cache gives +14% at no quality cost. A Q3_K made from full-precision weights is the one untested candidate.
