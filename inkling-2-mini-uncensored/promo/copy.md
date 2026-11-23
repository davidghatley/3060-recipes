# Inkling-2-Mini uncensored launch copy

Tokens in `{{double braces}}` are filled from `../promo-data.json` (checked against `../runs/`) by `./render.sh` /
`tools/prep.py`, which writes `out/copy-filled.md`. A token with no value stays as it is.
The final, counted thread with handles and alt text is `out/post.md`.

The base recipe's post already claimed the layout and its speed over stock flags (29.0 tok/s). This thread is about the
two edits: what they change on the probe, what they cost in KLD and speed, and which file to use.

---

## X thread

**1/**
Inkling-2-Mini, uncensored, on a 12 GB RTX 3060.

Two published edits on my base Inkling layout. AtomicChat's baked AD-Q4_K:
{{ad_dec}} tok/s (unedited {{base_dec}}), {{ad_32k}} at 32k
answers {{ad_ans}} borderline prompts (unedited: {{base_ans}}, hedged on {{base_hedged}})
KLD vs Q8_0 {{ad_kld}} (unedited {{base_kld}})

**2/**
The probe: 20 borderline prompts, temp 0, every answer read. Unedited: {{base_ans}} answered, {{base_hedged}} hedged ("I can’t…", then a softer version).

AtomicChat's file and nokeepai merged: {{ad_ans}}, codeeval {{ad_code}}.

Cost: nokeepai's edit is {{kld_ratio}}× as far from Q8_0 as AtomicChat's (KLD {{nkm_kld}} vs {{ad_kld}}).

**3/**
Which file:
AtomicChat AD-Q4_K is the default. It needs -ub 96 instead of 128 to fit, so prefill is {{ad_pp}} vs {{base_pp}}.
nokeepai: merge its rank-64 LoRA into the IQ4_NL (tools/merge_lora.py) and it runs at base speed, {{nkm_dec}}.
LoRA at runtime costs {{nk_cost}}% (nokeepai) and {{acl_cost}}% (AtomicChat).

**4/**
Neither model card's line (-ngl 99 -c 32768) loads on 12 GB: they ask for {{card_mib_ad}} and {{card_mib_nk}} MiB on the GPU.

The usual experts-in-RAM line runs AD-Q4_K at {{stock_dec}} tok/s. This layout: {{ad_dec}}, {{speedup}}.

Needles 3/3 at 32k and 62k. Image input works.

**5/** thanks, **6/** links: see `out/post.md` (handles verified there).

---

## LinkedIn

Inkling-2-Mini, uncensored, on a 12 GB RTX 3060.

Two groups have published uncensored edits of Thinking Machines' Inkling-2-Mini: nokeepai's Unbound (a rank-64 LoRA on the attention projections) and AtomicChat's Uncensored (a rank-1 LoRA on attention output, the routed experts and the embeddings, also sold baked into their own AD-Q4_K GGUF). I ran both on the layout from my base Inkling recipe (looped-core experts on the GPU, the rest in RAM, 64k context) and measured what each one changes and what it costs.

- Refusal probe, 20 borderline prompts, every answer read: the unedited model answered {{base_ans}} and hedged on {{base_hedged}}; both edits answered all 20. Codeeval {{ad_code}} on every variant.
- Distance from the Q8_0 reference (mean KLD, wikitext): unedited IQ4_NL {{base_kld}}, AtomicChat AD-Q4_K {{ad_kld}}, nokeepai {{nkm_kld}} (+{{nkm_ppl}}% wiki perplexity).
- Speed: AtomicChat's baked file decodes at {{ad_dec}} tok/s (unedited {{base_dec}}), {{ad_32k}} at 32k, needles 3/3 at 32k and 62k. nokeepai merged into the IQ4_NL runs at {{nkm_dec}}. As runtime LoRAs they cost {{nk_cost}}% and {{acl_cost}}%.
- Neither model card's launch line loads on a 12 GB card; the usual experts-in-RAM line gets {{stock_dec}} tok/s, this layout {{ad_dec}} ({{speedup}}).

These models answer requests the original refuses. What they are used for is up to whoever runs them.

Built on Thinking Machines' Inkling-2-Mini, nokeepai's and AtomicChat's edits, llama.cpp and ggml-org's GGUFs (Inkling support by Pedro Cuenca, PR #32694), and 0xSero's inference-optimisation method.

The recipe, the merge script and every run: github.com/davidghatley/3060-recipes

---

## README blurb

**Inkling-2-Mini uncensored on a 12 GB RTX 3060.** Two published uncensored edits on the base Inkling layout. AtomicChat's baked AD-Q4_K decodes at {{ad_dec}} tok/s ({{ad_32k}} at 32k, needles 3/3 at 32k and 62k), answers {{ad_ans}} refusal-probe prompts where the unedited model hedged on {{base_hedged}}, and stays closest to Q8_0 (KLD {{ad_kld}} vs {{base_kld}} unedited). nokeepai's Unbound merged into the IQ4_NL runs at base speed ({{nkm_dec}}) with a heavier edit (KLD {{nkm_kld}}). Runtime LoRAs cost {{nk_cost}}% and {{acl_cost}}%.
