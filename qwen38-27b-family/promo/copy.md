# Qwen3.8-27B family launch copy

Tokens in `{{double braces}}` are filled from `../promo-data.json` (checked against `../runs/ledger.jsonl`) by
`./render.sh` / `tools/prep.py`, which writes `out/copy-filled.md`. A token with no value stays as it is.
The final, counted thread with handles and alt text is `out/post.md`.

---

## X thread

**1/**
Qwen3.8-27B on a 12 GB RTX 3060, stock llama.cpp.

Stock flags: {{pi_stock}} tok/s. Tuned: {{pi_tuned}} tok/s at 32k context, {{pi_speedup}}. {{pi_fast}} tok/s at 16k with every weight on the GPU.

One config runs four finetunes: pi-adapted, Huihui abliterated, DaisyRose and Heretic.

**2/**
The files are 10.4–12.2 GB, so something has to sit in RAM, and every GB there costs ~{{ms_per_gb}} ms per token. So shrink everything else on the card:

-ctk q4_0 -ctv q4_0
-ub 256
-ot 'blk\.(0|1|2)\.ffn_(up|gate|down)=CPU'

Stock keeps {{stock_layers}} whole layers in RAM. This keeps {{ram_gb}} GB.

**3/**
Same flags on all four, decode at 32k, stock → tuned:

pi-adapted {{pi_stock}} → {{pi_tuned}}
Huihui abliterated {{huihui_stock}} → {{huihui_tuned}}
DaisyRose-27B {{daisyrose_stock}} → {{daisyrose_tuned}}
Heretic {{heretic_stock}} → {{heretic_tuned}}

128k works too: {{pi_long}} tok/s, {{pi_long_deep}} at 120k deep, needles 3/3 at 65k and 123k.

**4/**
MTP: tested, not kept. The head drafts well ({{mtp_accept}} accepted), but it needs ~{{mtp_vram}} MiB of VRAM, which pushes {{mtp_ffn}} more FFN layers to RAM. Best case {{mtp_best}}, inside the noise, with {{mtp_prefill}} slower prefill.

The Kintsugi DFlash2 drafter does not fit at all.

**5/** thanks, **6/** links: see `out/post.md` (handles verified there).

---

## LinkedIn

Qwen3.8-27B on a 12 GB RTX 3060.

Qwen3.8-27B is a dense 27B model, and its 3-bit GGUFs are 10.4–12.2 GB, so on a 12 GB card some of the weights have to live in system RAM. On this machine every GB left in RAM costs about {{ms_per_gb}} ms per token, so the recipe is mostly about shrinking everything else on the card: q4_0 K/V cache, a 256-token micro-batch, and only the FFN of the first three layers in RAM ({{ram_gb}} GB) instead of the {{stock_layers}} whole layers that stock `--fit on` picks.

The numbers, stock llama.cpp master, pi-adapted finetune:
- Decode at 32k: {{pi_stock}} → {{pi_tuned}} tok/s ({{pi_speedup}})
- 16k, every weight on the GPU: {{pi_fast}} tok/s ({{pi_fast_speedup}})
- 128k: {{pi_long}} tok/s, needles 3/3 at 65k and 123k

The same config runs four finetunes: harness-hub's pi-adapted ({{pi_tuned}}), huihui-ai's abliterated model ({{huihui_tuned}}), RadixArk's DaisyRose-27B ({{daisyrose_tuned}}) and DavidAU's Heretic ({{heretic_tuned}}).

MTP speculative decoding was tested and left out: it drafts well ({{mtp_accept}} accepted) but costs ~{{mtp_vram}} MiB of VRAM, which pushes more layers to RAM and cancels the gain on this card.

Built on Qwen's Qwen3.8-27B, the finetunes and GGUFs from harness-hub, netprojects, huihui-ai (GSQ-RCO quantizer by ISTA-DASLab), RadixArk, bartowski and DavidAU, llama.cpp, and 0xSero's inference-optimisation method for the tuning.

The recipe, scripts and every run: github.com/davidghatley/3060-recipes

---

## README blurb

**Qwen3.8-27B family on a 12 GB RTX 3060.** Four finetunes of the dense Qwen3.8-27B on stock llama.cpp with one config: q4_0 K/V, ubatch 256 and only {{ram_gb}} GB of FFN in RAM. pi-adapted decodes at {{pi_tuned}} tok/s at 32k ({{pi_speedup}} over stock flags), {{pi_fast}} at 16k all on the GPU and {{pi_long}} at 128k, needles 3/3 in every window; huihui {{huihui_tuned}}, DaisyRose {{daisyrose_tuned}}, Heretic {{heretic_tuned}}. Tuned with 0xSero's inference-optimisation method.
