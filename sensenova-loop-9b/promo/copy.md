# SenseNova-Loop-9B launch copy

Tokens in `{{double braces}}` are filled from `../promo-data.json` (checked against `../runs/`) by `./render.sh` /
`tools/prep.py`, which writes `out/copy-filled.md`. A token with no value stays as it is.
The final, counted thread with handles and alt text is `out/post.md`.

---

## X thread

**1/**
SenseNova-Loop-9B on a 12 GB RTX 3060: a looped 9B (layers 4–27 run twice), llama.cpp + PR #32588.

MTP n=2, 128k window, q8_0 KV:
thinking off {{ctl_off}} → {{dec_off}} tok/s (+{{gain_off}}%)
thinking on {{ctl_on}} → {{dec_on}} (+{{gain_on}}%)
prefill at 8k {{stock_pp}} → {{pp}}

Medians vs three plain-decode controls.

**2/**
The lever is the GGUF's own MTP head:
--spec-type draft-mtp --spec-draft-n-max 2
It only fits at 128k with q8_0 KV.

Speed follows acceptance. One thinking answer ran at {{on_min}}, and a prose prompt at {{prose_acc}}% acceptance ran {{prose_mtp}} vs {{prose_plain}} plain. Coding gains most.

**3/**
SNL_PROFILE=long trades MTP for a 256k window (q4_0 KV): needles {{needle_130}} at 130k and 248k. It is for reading: a 247k prompt waits {{ttft_248}} s for the first token.

Nothing above 256k fits. Greedy MTP output matches plain on {{same_off}}/{{gn}} prompts (thinking off); the rest diverges but stays coherent.

**4/**
Uncensored: satellitedown's abliterated Q6_K. I read every answer to 20 borderline prompts: {{unc_ans}}/20 answered ({{unc_soft}} softened), vs {{def_ans}}/20 for the default.

codeeval {{unc_code}} vs {{def_code}}. No MTP head, so it runs at stock speed ({{unc_dec}} tok/s). Image input works on both. KLD not measured.

**5/ thanks**
(see out/post.md: handles and links are filled there, not from data)

**6/ links**
Recipe, serve script, every run and the raw ledger: https://github.com/davidghatley/3060-recipes/tree/main/sensenova-loop-9b

The uncensored file answers requests the original refuses. What it is used for is up to whoever runs it.

Same card? Post your numbers.

---

## Unused fills, kept for the LinkedIn / README blurb

Stock card flags {{stock_dec}} tok/s. Prefill costs {{pp_cost}}%. Greedy identical thinking on {{same_on}}/{{gn}}.
Decode at 120k {{dec_120k}} tok/s, at 242k (long) {{long_242k}}. Needles at 248k {{needle_248}}. Uncensored stock {{unc_stock}} tok/s.
