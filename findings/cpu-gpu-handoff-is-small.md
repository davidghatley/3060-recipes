---
title: "The CPU-GPU hand-off is 1.1 ms of an 18.9 ms token, not the bottleneck"
date: 2026-11-19
group: experts-in-ram
recipes: [flint]
provenance: ours
provenance_note: "Profile, prototype patch and measurement are ours; nothing was filed upstream."
credit: ["llama.cpp (ggml backend scheduler)"]
evidence: ["flint/experiments/RESULTS.md:182-235", "flint/README.md:60"]
applies_to: "llama.cpp decode with experts split between CPU and GPU."
---

With Flint's experts in RAM, each token alternates 42 GPU splits and 42 CPU splits. An earlier estimate here put the copies between them at 3–4 ms per token. A profile says otherwise.

Measured here with a build that synchronizes after every split: copies take 1.10 ms and compute 17.79 ms of an 18.9 ms token. The CPU part reads about 415 MiB of experts in 9.5 ms, which is 46 GB/s or 80% of the measured RAM peak. Decode is bandwidth bound, and the GPU and CPU halves of each layer run one after the other.

A 44-line prototype that queues the copies asynchronously and synchronizes once cuts copy time to 0.54 ms and gives +3.0% decode (54.1 against 52.5 tok/s, ABAB). Building the shared expert before the routed ones could hide up to about 1 ms more; that was not prototyped.

The patch is `flint/experiments/runs/flint-async.patch`. It bypasses multi-GPU and pipeline-parallel setups.
