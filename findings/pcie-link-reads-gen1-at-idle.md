---
title: "nvidia-smi shows the PCIe link at Gen1 when idle and that is power saving"
date: 2026-11-18
group: box-and-harness
recipes: [flint]
provenance: ours
provenance_note: "Observed here while checking whether prefill was limited by the link."
credit: []
evidence: ["flint/THEORY.md:10", "inkling-2-mini/THEORY.md:11", "flint/RESULTS.md:3"]
applies_to: "Any NVIDIA card with PCIe link power management enabled."
---

Reading the PCIe link speed while the GPU is idle gives a misleading answer. On this box the link reports Gen1 at idle and Gen4 x16 under load.

It matters when prefill copies experts from RAM to the card on every micro-batch, because the link is then part of the prefill ceiling. During a 16k-token Flint prefill the link read Gen4 x16, and host-to-GPU copies ran at about 14 GB/s.

Query the link during a prefill, not before it:

```
nvidia-smi --query-gpu=pcie.link.gen.current,pcie.link.width.current --format=csv -l 1
```

If it still reads Gen1 or a narrow width under load, check the slot and the BIOS setting before tuning flags.
