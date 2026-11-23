# 3060-recipes

How to run models that don't fit in VRAM on a single RTX 3060 12 GB (with 62 GB RAM and NVMe), with measured tokens/s.

| Recipe | Model | Engine | Decode | Prefill |
|---|---|---|---|---|
| [deepseek-v41-strata](deepseek-v41-strata/) | DeepSeek-V4.1-Flash 763B, IQ2_XXS 2.00 bpw | Strata | 4.6–5.0 tok/s | 90–125 tok/s |
| [flint](flint/) | Flint 40B-A2.5B MoE, Q4_K_M, 128k ctx | llama.cpp b12242 (experts in RAM + MoE cache) | 58.8 tok/s (stock 48.2); 47 @ 32k | 1,708 tok/s (stock 329) |
| [qwen35-3d-coder](qwen35-3d-coder/) | Qwen3.5-4B-3D-Coder, Q5_K_M | llama.cpp | 77.5 tok/s task-weighted (81 reasoning, 74 code); Q8_0 baseline 61. Restored MTP head gives 102 but breaks long answers on this build | 2,480 tok/s (32k prompt) |
| [inkling-2-mini](inkling-2-mini/) | Inkling-2-Mini 26.4B MoE (looped core ×3), IQ4_NL, 64k ctx | llama.cpp master + 2 patches (loop-core experts on GPU, rest in RAM) | 29.0 tok/s (stock 17.5); 23.7 @ 32k | 145 tok/s at 8k (stock 39) |
| [kintsugi-27b](kintsugi-27b/) | Kintsugi-27B (Qwen3.8-27B dense), EXL3 trellis 2.47 bpw, 262k ctx | author's llama.cpp fork v1.1.1 (tiered K/V, DFlash2 drafter) | 35–39 tok/s prose, 60 code with the drafter (~16 without) | ~600–660 tok/s |
| [qwen38-27b-family](qwen38-27b-family/) | Qwen3.8-27B finetunes: pi-adapted, Huihui abliterated, DaisyRose, Heretic; IQ2_M–IQ3_XXS | llama.cpp master (q4_0 K/V, FFN of layers 0–2 in RAM) | pi 16.6 tok/s at 32k (stock 7.9), 19.7 at 16k, 7.5 at 128k; Huihui 20.8, DaisyRose 14.4, Heretic 11.6 | 543 tok/s at 8k (stock 475) |
| [inkling-2-mini-uncensored](inkling-2-mini-uncensored/) | Inkling-2-Mini uncensored: AtomicChat AD-Q4_K (default), nokeepai Unbound merged | llama.cpp master + 2 patches (base layout, ub 96) | 29.6 tok/s (base 29.0); 24.1 @ 32k; answers 20/20 probe prompts (base 8), KLD 0.014 | 137 tok/s at 8k |
