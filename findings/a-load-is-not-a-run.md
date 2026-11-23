---
title: "A layout that loads within 0.4 GB of the card's limit dies on its first request"
date: 2026-11-22
group: method
recipes: [inkling-2-mini]
provenance: ours
provenance_note: "Measured here across several builds, including two unmerged upstream PRs by other authors."
credit: ["llama.cpp"]
evidence: ["inkling-2-mini/RESULTS.md:27", "inkling-2-mini/RESULTS.md:158-169", "inkling-2-mini/RESULTS.md:39"]
applies_to: "Any llama.cpp CUDA setup that fills the card; the exact margin will differ by model and build."
---

Loading without an error does not show that a configuration works. Instantiating the CUDA graph on the first request needs memory on top of the buffers llama.cpp prints at load.

Measured here at 128k context on Inkling-2-Mini: four layouts that loaded at 11.86–11.9 GB failed their first request with a `cudaGraphInstantiate` out-of-memory error. Layouts that loaded at 11.35 GB or less ran a 104k or 124k-token prompt and found 3 of 3 needles. Stock master at 64k behaves the same way: it loads at 11.9 GB and fails on the first request.

Treat a load-time table as an upper bound. Count a configuration as working only after a real request near the full window, and leave about 0.4 GB of the card free after load.
