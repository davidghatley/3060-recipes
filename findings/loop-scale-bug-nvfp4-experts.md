---
title: "Loop passes 2 and 3 dropped per-expert scales and broke NVFP4 GGUFs"
date: 2026-11-20
group: looped-moe
recipes: [inkling-2-mini]
provenance: independent-also-upstream
provenance_note: "Patched here on the old pin; llama.cpp fixed it separately in #32704 (commit 690b87d88) by another author, and which came first is unclear."
credit: ["llama.cpp PR #32704"]
evidence: ["inkling-2-mini/RESULTS.md:38", "inkling-2-mini/RESULTS.md:279"]
applies_to: "Only llama.cpp builds older than 690b87d88 with GGUFs that carry NVFP4 experts."
---

On llama.cpp builds before commit 690b87d88, the generic per-expert `.scale` pass ran after the loop aliasing, so passes 2 and 3 of Inkling's loop core lost the scales of NVFP4 experts. Any GGUF with NVFP4 experts was affected. IQ4_NL and Q8_0 files have no scales and were not.

Measured here with an NVFP4 repack: perplexity 138.5 on the old stock build, 5.9639 with a local patch that moves the aliasing after the scale pass, and 5.9639 on stock master once the upstream fix landed.

Nothing to do on current master. If an NVFP4 file gives nonsense on an older build, update past 690b87d88.
