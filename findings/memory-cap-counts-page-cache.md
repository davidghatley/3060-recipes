---
title: "A cgroup memory cap counts page cache, so mmap'd weights hit it"
date: 2026-10-29
group: box-and-harness
recipes: [deepseek-v41-strata, flint]
provenance: ours
provenance_note: "Worked out here from how cgroup MemoryMax accounts memory; the effect of running with the low cap was reasoned, not measured."
credit: []
evidence: ["AGENTS.md:13-15", "deepseek-v41-strata/PLAN.md:19", "deepseek-v41-strata/README.md:49", "deepseek-v41-strata/RESULTS.md:39", "flint/README.md:40"]
applies_to: "Any shared box that wraps GPU jobs in a systemd scope or container with a memory limit."
---

On this box every GPU job runs through a flock-based GPU queue that also wraps the job in a cgroup with a memory cap, 20 GB by default. That cap counts page cache. An engine that reads or mmaps its experts in place keeps them in the page cache, so a cap sized for process memory starves it and turns decode into disk paging.

The DeepSeek runs were made with the cap raised to 44 GB. Their measured peak was 34.9 GB in Faster mode and 30.6 GB in full-quality mode, so a 20 GB cap would have bound. What the run looks like under the low cap was not measured.

If a job is wrapped in `systemd-run -p MemoryMax=...` or a container limit, size the limit for weights held in page cache plus process memory, and check the scope's peak afterwards.
