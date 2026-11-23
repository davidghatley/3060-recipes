# Nemotron-3.5-Bolt-E4B launch copy

Tokens in `{{double braces}}` are filled from `../promo-data.json` (checked against `../runs/`) by `./render.sh` /
`tools/prep.py`, which writes `out/copy-filled.md`. A token with no value stays as it is.
The final, counted thread with handles and alt text is `out/post.md`.

---

## X thread

**1/**
Nemotron-3.5-Bolt-E4B (NVIDIA, Gemma-4-E4B base) in VRAM on a 12 GB RTX 3060, stock llama.cpp.

Card's command → + NVIDIA's DFlash drafter, tok/s:
thinking on {{stock_think}} → {{think}} ({{x_think}})
thinking off {{stock_off}} → {{off}} ({{x_off}})
at 60k {{stock_60k}} → {{d60k}} ({{x_60k}})

4 users × 32k: {{c4}} tok/s total.

**2/**
The lever is speculative decoding. Plain decode is already at {{wall_pct}}% of the bandwidth ceiling, so the card's drafter is the one big win:

--spec-type draft-dflash --spec-draft-n-max 7

It accepts {{accept}} of its 7-token drafts, about {{tps}} tokens per step. Plus -ub 1024 and -bs.

**3/**
The price is prefill: the drafter reads the whole prompt too.
8k prompt {{pp_stock}} → {{pp}} tok/s ({{pp_ratio}})
61k prompt, first token {{ttft_stock}} → {{ttft}} s

For long prompts with short answers, NB_PROFILE=nospec drops the drafter: {{pp_ns}} tok/s at 8k, first token at 61k in {{ttft_ns}} s.

**4/**
Checks and limits:
- needles {{needles}} at 61k on every profile; 4 × 30k at once on multi
- q8_0 K/V is {{q8_slower}}% slower at 32k here, so f16 stays
- KLD not measured (no reference file)
- drafter acceptance measured on code-heavy prompts; chat may accept less
- -bs is experimental upstream

**5/ thanks**
Thanks:
Method: @0xSero's inference-optimisation skill
Model, Q4_K_M GGUF and DFlash drafter: @nvidia
Base: Gemma-4-E4B-it by @GoogleDeepMind
Engine: llama.cpp by @ggerganov and @ggml_org (Gemma-4 support, DFlash, backend sampling)

**6/ links**
Recipe, serve script with its four profiles, every run and the raw ledger: https://github.com/davidghatley/3060-recipes/tree/main/nemotron-bolt-e4b

Same card? Post your numbers.

---

## Unused fills, kept for the LinkedIn / README blurb

nospec decode {{ns_dec}} tok/s. 4 × 64k without the drafter {{c4_64k}} tok/s total. Card {{vram}} GB with the drafter.
-ub 1024 +{{ub_gain}}% prefill at 8k. codeeval thinking off {{code_off}} (same as stock).
