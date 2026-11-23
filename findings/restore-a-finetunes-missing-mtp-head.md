---
title: "A fine-tune that dropped its MTP head can take the base model's head back"
date: 2026-11-19
group: drafting
recipes: [qwen35-3d-coder]
provenance: ours
provenance_note: "The graft method and tools are ours; the MTP head is Qwen's and MTP decoding is llama.cpp's."
credit: ["Qwen (Qwen3.5-4B MTP head)", "ccore (Qwen3.5-4B-3D-Coder)", "llama.cpp (MTP support and converter)"]
evidence: ["qwen35-3d-coder/README.md:47-53", "qwen35-3d-coder/RESULTS.md:14", "qwen35-3d-coder/RESULTS.md:36", "qwen35-3d-coder/RESULTS.md:43", "qwen35-3d-coder/RESULTS.md:196", "qwen35-3d-coder/tools/fetch_mtp.py"]
applies_to: "Fine-tunes of base models that ship a multi-token-prediction head."
---

Qwen3.5-4B-3D-Coder's config declares one MTP layer, but the released weights and official GGUFs carry none. The base model's head can be put back.

The 15 `mtp.*` tensors of base Qwen3.5-4B are fetched with HTTP range requests, 241 MB in total without downloading the full checkpoint, added to the fine-tune's checkpoint, and converted with llama.cpp's converter.

The head was never trained on the fine-tune's hidden states. Measured here on Q5_K_M with 2 draft tokens, it is still accepted 86% of the time while the model writes code and 37% while it reasons. Task-weighted decode goes from 77.5 to 101.7 tok/s, and the median on real answers is 105.7 against 75.0.

It is opt-in, because more MTP pages failed on syntax errors in pooled runs and that is unexplained: `QC_SPEC=draft-mtp ./serve.sh`.
