# Inkling-2-Mini launch copy

Tokens in `{{double braces}}` are filled from `../promo-data.json` by `./render.sh`, which writes
`out/copy-filled.md`. A token with no number yet stays as it is, so nothing goes out with a made-up value.

Tokens: `{{tuned_tps}}` `{{baseline_tps}}` `{{speedup}}` `{{prefill_tps}}` `{{ctx}}` `{{vram_gib}}` `{{quant}}` `{{kld}}` `{{flags}}`

Attach: `out/video/inkling-light-16x9-music.mp4` (X, LinkedIn), `out/stills/SocialLight.png` or `SquareLight.png` as the image.

---

## X thread

**1/**
Inkling-2-Mini on a 12 GB RTX 3060.

Thinking Machines' new 26.4B MoE (3.4B active) usually comes with "32 GB+ of VRAM" advice. On this box it runs at {{tuned_tps}} tok/s on llama.cpp, {{speedup}} over stock flags.

[video]

**2/**
The model has a loop in it. Layers 6–17 run three times for every token, so each token goes through 48 layers while only 24 layers of weights sit in memory.

llama.cpp runs it since PR #32694 by pcuenca.

**3/**
What fits in 12 GB:
- {{quant}} GGUF (ggml-org and Unsloth quants)
- {{ctx}} context, of the 1M it supports
- {{vram_gib}} GB of VRAM
- mean KLD {{kld}}

**4/**
The flags that did it, on stock llama.cpp:
{{flags}}

Stock was {{baseline_tps}} tok/s. Prefill is {{prefill_tps}} tok/s.

**5/**
Method: 0xSero's inference-optimisation loop. Work out the ceiling for the hardware first, then A/B one change at a time and keep a ledger of every run.

Recipe, scripts and raw numbers: github.com/davidghatley/3060-recipes

---

## LinkedIn

Inkling-2-Mini on a 12 GB RTX 3060.

Inkling-2-Mini is Thinking Machines' new 26.4B mixture-of-experts model, with 3.4B active parameters, 1M context, text and image input, Apache-2.0. The usual advice for a model this size is 32 GB of VRAM or more. I got it running on one RTX 3060 12 GB with 62 GB of RAM.

The interesting part of the architecture is the loop. Layers 6–17 run three times per token, so each token goes through 48 layers on 24 layers of weights. Attention is mostly sliding-window, with 4 global layers.

The numbers on this machine:
- Decode: {{tuned_tps}} tok/s, up from {{baseline_tps}} with stock flags ({{speedup}})
- Prefill: {{prefill_tps}} tok/s
- {{ctx}} context in {{vram_gib}} GB of VRAM
- {{quant}} GGUF, mean KLD {{kld}}

The flags:
{{flags}}

Built on Thinking Machines' model, llama.cpp (pcuenca's PR #32694 added the loop architecture), GGUF quants from ggml-org and Unsloth, and 0xSero's inference-optimisation method for the tuning.

The recipe, the scripts and every run are in the repo: github.com/davidghatley/3060-recipes

---

## README blurb

**Inkling-2-Mini on a 12 GB RTX 3060.** Thinking Machines' 26.4B MoE (3.4B active, 1M context, text and image input) runs on one RTX 3060 12 GB with llama.cpp at {{tuned_tps}} tok/s decode ({{speedup}} over stock flags) and {{prefill_tps}} tok/s prefill, with {{ctx}} context in {{vram_gib}} GB of VRAM ({{quant}}, mean KLD {{kld}}). Its looped core runs layers 6–17 three times per token (48 layer passes on 24 layers of weights), which llama.cpp supports since pcuenca's PR #32694. Quants from ggml-org and Unsloth; tuned with 0xSero's inference-optimisation method.
