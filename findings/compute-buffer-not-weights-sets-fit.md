---
title: "On Inkling the compute buffer, not the weights, decides what fits in 12 GB"
date: 2026-11-20
group: looped-moe
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "Measured and worked out here from llama.cpp's load-time buffer sizes."
credit: ["llama.cpp"]
evidence: ["inkling-2-mini/RESULTS.md:13-17", "inkling-2-mini/RESULTS.md:260", "inkling-2-mini/RESULTS.md:263"]
applies_to: "Models with a per-head attention bias or with many host-resident experts under op offload."
---

Two things in llama.cpp's compute buffer decide which Inkling-2-Mini layouts load on a 12 GB card, and neither is the model file. Op-offload staging takes about 6.7 GB when every expert is in RAM. The per-head relative-position bias mask grows as 190 bytes × context × ubatch.

Measured here: the compute buffer at load was 7.2–8.4 GB in the first layouts tried. A plain baseline of 64k context at `-ub 512` with experts in RAM cannot load at all. With the loop core on the GPU, 64k fits only with q8_0 KV and `-ub 128` (10.4 GB); f16 KV and `-ub 256` both run out of memory.

So when a layout fails to load, read the buffer sizes llama.cpp prints and lower `-ub` or the context before giving up on the quant.
