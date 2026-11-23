---
title: "A one-sample-per-prompt check wrongly blamed an engine bug for MTP failures"
date: 2026-11-22
group: method
recipes: [qwen35-3d-coder]
provenance: ours
provenance_note: "Both the wrong first reading and the follow-up that corrected it are ours."
credit: ["llama.cpp (MTP speculative decoding)"]
evidence: ["qwen35-3d-coder/RESULTS.md:14", "qwen35-3d-coder/RESULTS.md:154-221"]
applies_to: "Any pass/fail eval on sampled long answers from a small model."
---

The first quality check of the restored MTP head used one answer per prompt and looked decisive: 1 of 8 pages worked with MTP against 6 of 8 without, and 5 of 9 answers looped against 0 of 8. It was read as a state-rollback bug in the engine. That reading was wrong.

The follow-up measured here found the state exact through 12k tokens. On the prompts that looped, with 4 seeds each, MTP looped 0 of 16 times and plain decoding 2 of 16. With 2 seeds per arm, pages worked 10 of 16 against 9 of 16. The swing between seeds inside one arm, 3 against 6, was as large as the original gap.

One thing remains unexplained: 5 of 19 finished MTP pages failed on syntax errors against 0 of 35 without, pooled across runs with different settings. So MTP stays opt-in.

Run at least 2 seeds per prompt before calling a regression.
