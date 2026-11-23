---
title: "For a model that reads experts from disk, the drive sets decode speed by 10x"
date: 2026-11-22
group: disk-bound
recipes: [deepseek-v41-strata]
provenance: ours
provenance_note: "Found by accident here; it is not a controlled comparison (different day, twice the free RAM)."
credit: ["Strata"]
evidence: ["deepseek-v41-strata/RESULTS.md:45-63", "deepseek-v41-strata/RESULTS.md:68"]
applies_to: "Any engine that reads cold weights in place from storage."
---

When cold experts are read from storage on every token, the drive is part of the recipe.

Measured here on DeepSeek-V4.1-Flash with Strata, same GPU, same 27 GB RAM store and same engine: 4.98 tok/s from an NVMe drive, and 0.46 tok/s after the model folder had been moved to a 7200 rpm hard disk and left behind a symlink. The wait for the first token of a 60-token question went from 12–19 s to 201–210 s. On the hard disk the box sat in I/O wait, with pressure at 41–42% and the CPU 82% idle.

The two runs were three weeks apart with different free RAM, so the size of the gap is indicative, not exact.

Keep disk-bound models on the fastest NVMe available and state the drive in any published number. On NVMe, the split between CPU and disk limits is still unmeasured.
