# Kintsugi-27B results

- GPU: RTX 3060 12 GB, driver 615.78.08, with the Hyprland desktop on the same card (~1 GB, so the launcher keeps a
  600 MiB margin). CPU i5-12500, RAM 62 GiB.
- Model: CaryPalmer/Kintsugi-27B `Kintsugi-27B-12G.gguf` (sha256 0510bae8…), drafter `dflash-Qwen3.8-27B-Q4_0.gguf`.
- Engine: author's bundle v1.1.1 (Linux x86_64, CUDA 12.8 runtime), launcher defaults: q4_0 K/V, 262,144 window,
  thinking medium, int8 prompt read, two-stage head 512.
- Measured 2026-11-21/22, single user, `../scripts/bench.py --runs 2 --max-tokens 512` (warm-run medians) plus one
  ~26k-token prompt (`max_tokens` 400, thinking off). Raw: `runs/`.

## Verdict

**Ship the default (DFlash2 drafter on): 2.2–3.8× the decode speed of no drafting at every depth measured, 0–26k.**
The drafter costs ~0.9 GB of VRAM, so the VRAM part of the K/V cache drops from 61,952 cells to 7,168 and the rest of
the window sits in system RAM. At 26k tokens that costs nothing measurable (34 tok/s vs 35–39 at 4–8k).

| Case | Prompt tok | Drafter on: prefill / decode | Drafter off: prefill / decode |
|---|---:|---:|---:|
| chat | 42 | 79 / **39.4** | 91 / 16.2 |
| code | 40 | 72 / **60.2** | 76 / 16.1 |
| ctx4k | 3,189 | 602 / **35.1** | 635 / 16.0 |
| ctx8k | 6,246 | 628 / **36.8** | 665 / 15.9 |
| ~26k (one request) | 26,158 | 591 / **34.2** | 616 / 15.2 |
| K/V cells in VRAM | | 7,168 | 61,952 |
| Card memory after warm-up | | 11,182 MiB | 10,858 MiB |

- With the drafter, decode depends on how predictable the text is: code accepts more drafts (60 tok/s) than prose
  (35–39). A short code answer through the OpenAI endpoint hit 67 tok/s (51 of 57 drafts accepted).
- Without drafting, decode is a flat ~16 tok/s: 10.5 GB of weights read per token at ~342 GB/s is a ~33 tok/s
  ceiling, so the trellis decode kernels reach about half the card's bandwidth.
- Prefill is ~600–660 tok/s, so a 26k prompt takes ~45 s the first time; the layer's saved conversations avoid
  rereading it after a restart.

## Not measured yet
- Depths past 26k (64k, 128k, 245k), where most of the K/V cache is read from RAM with the drafter on.
  `KINTSUGI_DRAFT=off` keeps ~62k tokens in VRAM and may win somewhere past that.
- `KINTSUGI_MARGIN=250` (the author's headless setting) on this card with the desktop on it.
- Answer quality on our own tasks (the card's HumanEval/AppWorld numbers are the author's).
