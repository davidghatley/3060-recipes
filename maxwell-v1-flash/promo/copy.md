# Maxwell-V1-Flash launch copy

Tokens in `{{double braces}}` are filled from `../promo-data.json` (checked against `../runs/`) by `./render.sh` /
`tools/prep.py`, which writes `out/copy-filled.md`. A token with no value stays as it is.
The final, counted thread with handles and alt text is `out/post.md`.

---

## X thread

**1/**
Maxwell-V1-Flash (35B-A3B MoE) on a 12 GB RTX 3060, llama.cpp with AtomicChat's port.

Stock flags → tuned:
decode {{stock_dec}} → {{dec}} tok/s ({{x_dec}})
at 32k context {{stock_32k}} → {{dec_32k}} ({{x_32k}})
prefill, 8k prompt {{stock_pp}} → {{pp}} ({{x_pp}})

Same 20.8 GB file, 64k window, {{vram}} GB on the card.

**2/**
The lever: all routed experts in RAM, hot ones in llama.cpp's MoE cache on the card.

--cpu-moe --moe-cache-mib N

Same VRAM, q8_0 KV: 12 MoE layers pinned {{pinned}} tok/s, as a 4800 MiB cache {{cache}}, +{{cache_gain}}%. The default keeps 1900 MiB to make room for f16 KV and -ub 1024.

**3/**
q8_0 KV saves VRAM but is slow deep in the window on this card: at 32k, {{q8_32k}} tok/s vs {{f16_32k}} with f16. f16 wins from about 4k tokens, so it is the default.

Prefill: --load-mode none +{{lm_gain}}%, -ub 1024 +{{ub_pp_gain}}% for {{ub_dec_cost}}% less decode.

**4/**
Limits:
- needles 3/3 at 32k, not clean at ~62k (a code missing, misprinted or out of order)
- AtomicChat's uncensored LoRA at runtime: {{unc_dec}} tok/s, about half speed
- the card's own line (-ngl 99 -c 32768) does not load on 12 GB
- quant drift vs BF16: not measured

**5/ thanks**
Thanks:
Method: @0xSero's inference-optimisation skill
Model: the Maxwell team, Maxwell-V1-Flash
Port patch, AD-Q4_K GGUF and uncensored LoRA: @atomic_chat_hq
Engine: llama.cpp by @ggerganov and @ggml_org (MoE cache, --load-mode)

**6/ links**
Recipe, serve script, every run and the raw ledger: https://github.com/davidghatley/3060-recipes/tree/main/maxwell-v1-flash

Same card? Post your numbers.

---

## Unused fills, kept for the LinkedIn / README blurb

Prefill at 32k {{pp_32k}}, at 65k {{pp_65k}} tok/s. Load-mode control {{lm_ctl}} → {{lm}}. LoRA base controls
{{unc_ctl_a}} / {{unc_ctl_b}}. q8_0 {{q8_slower}}% slower at 32k. Needles {{needles_32k}} at 32k. Card line asks
for {{card_mib}} MiB. Codeeval {{code}}.
