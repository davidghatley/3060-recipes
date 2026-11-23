---
title: "An adaptive expert cache matches the oracle hot set and a fixed one does not"
date: 2026-11-19
group: experts-in-ram
recipes: [flint]
provenance: ours
provenance_note: "Routing measurement and the static-versus-adaptive comparison are ours; the cache is llama.cpp's."
credit: ["llama.cpp (MoE cache, llama-imatrix)"]
evidence: ["flint/experiments/RESULTS.md:158-163", "flint/experiments/RESULTS.md:274-301"]
applies_to: "MoE models with skewed routing; the skew itself should be measured per model."
---

Expert routing on code is concentrated, but the hot set moves, which is why a cache that adapts beats pinning experts chosen in advance.

Measured here on Flint with per-expert counts from three 130 KB code corpora: the top 25% of experts take 57–59% of selections and the top 50% take 79–81%. A uniform router would give 25% and 50%. General calibration text is flatter, at 44% for the top quarter. Every expert is used, so pruning would hurt.

The cache's hit rates at 2944, 4096 and 5248 MiB are 44.7%, 51.6% and 58.4%, matching the oracle hot set for the same text (44%, 53%, 60%). A hot set fixed from a different code sample would get 38%, 46% and 53%. One fixed from general calibration text would get 22%, 29% and 35%.

Do not hand-pin hot experts with `-ot`. Use the cache.
