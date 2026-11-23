---
title: "On Kintsugi the drafter is worth more VRAM than keeping the K/V cache on the card"
date: 2026-11-22
group: drafting
recipes: [kintsugi-27b]
provenance: ours-measuring-others-work
provenance_note: "The model, the engine bundle, the tiered K/V cache and the DFlash2 drafter are the Kintsugi author's; the measurements on this card are ours."
credit: ["CaryPalmer (Kintsugi-27B and its engine bundle)"]
evidence: ["kintsugi-27b/RESULTS.md:11-32", "kintsugi-27b/RESULTS.md:34-38"]
applies_to: "Kintsugi-27B on a 12 GB card up to 26k tokens; deeper contexts are unmeasured."
---

The DFlash2 drafter costs about 0.9 GB of VRAM, which pushes most of Kintsugi's K/V cache out to system RAM: 7,168 cells stay on the card where 61,952 fit without it. It is still much faster.

Measured here with the author's bundle v1.1.1 at the 262k window: decode with the drafter on against off is 39.4 against 16.2 tok/s on chat, 60.2 against 16.1 on code, and 34.2 against 15.2 after a 26k-token prompt. That is 2.2–3.8×. Prefill is about 600–660 tok/s either way.

Without drafting, decode is a flat 16 tok/s. The 10.5 GB of weights read per token at 342 GB/s would allow about 33, so the decode kernels for this format reach about half the card's bandwidth.

Depths past 26k were not measured. `KINTSUGI_DRAFT=off` keeps about 62k tokens in VRAM and may win somewhere beyond that.
