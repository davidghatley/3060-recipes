---
title: "Resolve the model path before benchmarking, because a symlink can hide a slow disk"
date: 2026-11-22
group: box-and-harness
recipes: [deepseek-v41-strata]
provenance: ours
provenance_note: "Our own mistake, recorded as a check."
credit: []
evidence: ["deepseek-v41-strata/RESULTS.md:47-48", "deepseek-v41-strata/RESULTS.md:60", "AGENTS.md:17"]
applies_to: "Any box where model folders get moved between drives to free space."
---

A model folder that was moved to another drive and left behind as a symlink still opens at its old path. Nothing in the engine's output says the weights now come from a different disk.

Here a DeepSeek control run decoded at 0.39–0.48 tok/s where the same case had measured 4.98. The folder had been a symlink to a 7200 rpm hard disk for three days. The hardware sampler made it harder to see: it sampled the drive the path appeared to be on and reported 0 MB/s of reads.

Before a benchmark run:

```
readlink -f /path/to/model/dir
df --output=source,target "$(readlink -f /path/to/model/dir)"
```

The recipe's run script now resolves the real path, logs which device it is on, and samples that device.
