---
title: "Repacking Inkling's own NVFP4 experts into a GGUF is about 3x closer to Q8_0 than IQ4_NL"
date: 2026-11-20
group: quants
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "The repack tool and measurements are ours; the trained 4-bit experts are Thinking Machines' and the NVFP4 kernel is llama.cpp's."
credit: ["Thinking Machines (Inkling-2-Mini checkpoint)", "llama.cpp (NVFP4 support)", "ggml-org (Q8_0 reference GGUF)"]
evidence: ["inkling-2-mini/RESULTS.md:19", "inkling-2-mini/RESULTS.md:300-311", "inkling-2-mini/RESULTS.md:269-270", "inkling-2-mini/RESULTS.md:125", "inkling-2-mini/tools/repack_nvfp4.py"]
applies_to: "Checkpoints that ship natively quantized experts in a format the engine can read."
---

The Inkling-2-Mini checkpoint ships its experts already in 4-bit NVFP4. Copying those nibbles and block scales bit-for-bit into a GGUF, instead of requantizing to IQ4_NL, gives a file of the same 17.6 GB that is much closer to Q8_0.

Measured here against ggml-org's Q8_0: KLD 0.0029 on wikitext and 0.0044 on code for the repack, against 0.0085 and 0.0088 for IQ4_NL. Both pass 8 of 8 coding tasks. The cost is speed: 27.1 against 29.1 tok/s in llama-bench, and 5.5% slower decode on the 64k server. Putting NVFP4 only in the GPU layers loses the same amount, so the slowdown is in the CUDA NVFP4 kernel on this card generation, not the CPU path.

It ships as an option: `INK_QUANT=nvfp4 ./serve.sh`.
