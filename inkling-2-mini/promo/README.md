# Inkling-2-Mini promo

A 30 s video, a README header and social cards for the Inkling-2-Mini recipe, plus the launch copy.
Same family as `flint/promo/` (the v3 poster plates and the dh card close), built in Remotion.

## Re-render after the numbers update

```sh
cd inkling-2-mini/promo && ./render.sh
```

That one command:
1. reads `../promo-data.json` and writes `src/data.json` (`tools/prep.py`), and fills `copy.md` into `out/copy-filled.md`;
2. renders the stills to `out/stills/` (README header, 16:9 social card at 1200×675, square at 1080×1080, each light and dark);
3. renders the video light and dark to `out/video/inkling-{light,dark}-16x9.mp4` (1920×1080, 60 fps, 30 s), plus `-music` versions with the bed;
4. runs `sauce-lint` on the stills and one frame per plate, then prints which numbers are still placeholders.

`./render.sh stills` does steps 1, 2 and 4 only (seconds instead of minutes). The video takes about 3 minutes per theme.

## Explainer (72 s, for sharing in a community)

```sh
cd inkling-2-mini/promo && ./render.sh explainer
```

Renders `ExplainerLight` / `ExplainerDark` (`src/Explainer.tsx`) to `out/video/inkling-explainer-{light,dark}-16x9.mp4` (1920×1080, 30 fps, crf 20) and `-music` versions (the 30 s bed looped, faded over the last 3 s), plus review frames `out/stills/explainer-*.png`, then lints them.
Eight plates: what it is, mixture of experts, the loop, CyberBench, coding, documents and images, on a 12 GB card, what is next; then the dh card.
Model facts and benchmark scores live in `src/explainer.json` with their sources (Thinking Machines model card, Vals AI); every score plate says they are reported numbers, not ours.
Plate 07 shows a tok/s line only once `tuned_tps` is measured in `../promo-data.json`. The post to go with it is in `out/discord-post.md`.

Rendering is CPU only: Chromium with SwiftShader (`--gl=swangle`), under `nice -n 19` with 4 frames at a time, so it stays out of the way of a tuning run on the GPU.

## Where the numbers come from

Everything on screen comes from `src/data.json`, which `tools/prep.py` builds from `../promo-data.json`.
Any number that is missing or `null` prints as `—`, and every plate header and card says `DRAFT` until the headline set is complete (then `MEASURED`). Nothing is typed in by hand.

Headline keys (`prep.py` matches common spellings, nested keys included, e.g. `baseline.tok_s`, `tuned_tps`, `vram_mib`):

| Key | Shown as |
|---|---|
| `baseline_tps`, `tuned_tps` | decode tok/s, stock → tuned |
| `speedup` | the one vermilion (sun on the cards) number; computed from the two above if absent |
| `prefill_tps` (+ optional `baseline_prefill_tps`, `prefill_prompt`) | prefill row |
| `ctx` (tokens or "128k") | context |
| `vram_gib` or `vram_mib` | VRAM used, and the 12-cell bar |
| `quant`, `gguf`, `file_gb` | quant label, file name in the command |
| `kld` (+ optional `kld_ref`) | mean KLD |
| `flags` (list of strings or `{flag, gain}`) | the flags plate and the command |
| `cmd` (string or list of lines) | the command box, if given; otherwise built from `flags` |
| `build`, `layers` | footer build tag; `layers` overrides the 24 from THEORY.md (the loop figure draws 18–23 after the core) |

`prep.py` prints any keys it did not use, so a new name is easy to add to `ALIAS`.
Model facts (26.4B / 3.4B active, 24 layers with 6–17 looped 3 times so 48 per token, 1M context, text + image, Apache-2.0, the "32 GB+" advice) come from the model card and live in `MODEL` in `prep.py`.

## README header

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="promo/out/stills/readme-header-dark.png">
  <img alt="Inkling-2-Mini on a 12 GB RTX 3060" src="promo/out/stills/readme-header-light.png">
</picture>
```

## Files

- `src/Inkling.tsx`: the video. Plates: 32 GB+ advice vs 12 GB card · the loop · stock vs tuned · the flags · what fits · run it · dh card.
- `src/Loop.tsx`: the loop figure (layers as cells, the core lit three times), shared by the video and the stills.
- `src/Stills.tsx`: README header and social cards.
- `src/kit.tsx`: palette, Stem 7 sizes, house motion and the shared pieces, taken from `flint/promo/src/v3/kit.tsx` and `house.tsx`.
- `src/timeline.json`: scene timings.
- `tools/sauce_palette.py`: writes `src/palette.json` from secret-sauce `tokens.json`.
- `public/audio/bed.m4a`: the Flint promo's 30 s music bed.
- `node_modules` links to `../../flint/promo/node_modules` (Remotion 4.0.529), the same as the Qwen promo.

Credits on screen and in the copy: Thinking Machines (model), llama.cpp and pcuenca's PR #32694 (loop architecture), ggml-org and Unsloth (GGUF quants), 0xSero (inference-optimisation method).
