# SenseNova-Loop-9B (parked, come back after Inkling-2-Mini)

Source: https://huggingface.co/sensenova/SenseNova-Loop-9B (read 2026-11-20). All figures are the publisher's own claims.

## Model
- Looped dense transformer, about 9B parameters (about 14.6B "inference-equivalent").
  - 32 layers; layers 4–27 run twice with shared weights, so each token takes 56 layer passes.
  - The card reports gains at 3–4 loops. The loop count could be tuned for speed against quality.
- Hidden 4096, FFN 12288, vocabulary 248,320.
- Hybrid attention: three linear-attention layers to one full-attention layer (16 heads, 4 KV heads).
- mHC: two residual streams with Sinkhorn routing; the routing parameters are FP32.
- Input text and images, output text. Context 512k. Ships an MTP head (`mtp.safetensors`, 487 MB).
- License Apache-2.0.

## Gate
- Hugging Face gate: "You need to agree to share your Hugging Face information to access this model."
- The condition text shows only to logged-in users. Still to check: do any terms go beyond Apache-2.0?
- Downloading needs `hf auth login`. No token is on this machine yet.

## Engines (none in mainline)
- llama.cpp: the OpenSenseNova/llama.cpp fork at commit 24ea7bb78410e0f0f7bbb362e37c60cd9ecfc761.
- vLLM: PR #64832.
- SGLang: PR #47281.
- transformers 5.18.0 with trust_remote_code.

## Files
- BF16: about 18.8 GB.
- Official GGUFs: Q8_0 9.8 GB, Q5_K_M 6.67 GB, Q4_K_M 5.82 GB. No mmproj is listed.
- An official AWQ exists (about 4.9 GB of weights). EXL3 and FP8 conversions are community uploads.

## Plan when we return
Download BF16, make our own quants, and measure KLD (the same method as qwen35-3d-coder).
Levers to try: loop count (2/3/4), MTP, KV quant.
