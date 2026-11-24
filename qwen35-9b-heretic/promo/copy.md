# Qwen3.5-9B Heretic launch copy

Tokens in `{{double braces}}` are filled from `../promo-data.json` (checked against `../runs/`) by `./render.sh` /
`tools/prep.py`, which writes `out/copy-filled.md`. A token with no value stays as it is.
The final, counted thread with handles and alt text is `out/post.md`.

---

## X thread

**1/**
Qwen3.5-9B Heretic on a 12 GB RTX 3060: DavidAU's uncensored 9B merge, all in VRAM on stock llama.cpp, with its own MTP head (n=2).

64k window:
thinking off {{stock_off}} → {{def_off}} tok/s ({{x_def}}×)
thinking on {{stock_on}} → {{def_on}}
deep in the window {{stock_deep}} → {{def_deep}}

Acceptance {{accept}}, {{ceil_pct}}% of its ceiling.

**2/**
The BF16 output head is {{head_pct}}% of the bytes read per token, and every MTP draft reads it again.

Requantize only the head to Q8_0 (48 s on the CPU, KLD {{kld_head}}) and QH_PROFILE=fast runs {{fast_off}} tok/s ({{x_fast}}×) with a 128k window.

Opt-in: it changes the published file.

**3/**
The same family's MTP head looped on long answers with llama.cpp b12242, so I checked: {{la_n}} long answers (to 10k tokens, thinking on) behaved the same with and without MTP; a {{tok24k}}-token answer stayed coherent.

Needles 3/3 at ~50%/~95% on every profile, up to {{needle_long}} on QH_PROFILE=long.

**4/**
Uncensored: {{ref_n}} borderline prompts, thinking off, every answer read: {{ref_ans}}/{{ref_n}} answered. No base comparison (no base file on disk).

MTP costs ~{{pp_cost}}% of prompt speed ({{def_pp}} vs {{stock_pp}} tok/s at 8k). The full 262k window does not fit with the BF16 head. Quant KLD vs BF16: not measured.

**5/ thanks**
(see out/post.md: handles and links are filled there, not from data)

**6/ links**
Recipe, serve script, every run and the raw ledger: https://github.com/davidghatley/3060-recipes/tree/main/qwen35-9b-heretic

This is an uncensored model. What it is used for is up to whoever runs it.

Same card? Post your numbers.

---

## Unused fills, kept for the LinkedIn / README blurb

Deep-window gain {{x_deep}}× (MTP at 60k vs stock at 63k). Long answers finished {{la_fin}}/{{la_n}} on both. Greedy MTP text identical to plain {{g_on}} with thinking on. Fast profile deep in the window (120k) {{fast_deep}} tok/s.
