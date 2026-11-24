# Nemotron-3.5-Bolt-E4B promo

A 28 s video (16:9 and 9:16, light and dark), three thread stills and the launch copy for the `nemotron-bolt-e4b`
recipe. Same family as `../../maxwell-v1-flash/promo/` and `../../inkling-2-mini-uncensored/promo/` (poster plates,
dh card close), built in Remotion.

## Re-render

```sh
cd nemotron-bolt-e4b/promo
./render.sh stills    # data + stills + lint (seconds)
./render.sh frames    # one frame per plate, each theme and ratio, + lint
./render.sh video     # the four cuts with the music bed (about 3 min each, CPU only)
./render.sh           # all of it
python3 -I tools/xcount.py out/post.md   # X-weighted count of each post
```

Rendering is CPU only (Chromium with SwiftShader, `--gl=swangle`, `nice -n 19`, 4 frames at a time), so it never
takes the GPU lock. `node_modules` links to `../../flint/promo/node_modules` (Remotion 4.0.529).

Outputs in `out/` (gitignored):
- `nemotron-bolt-e4b-results-light.png` and `-flags-light.png` (1600×900), `-poster-light.png` and `-poster-dark.png`
  (1080×1350); dark results and flags cards for review in `out/stills/extra/`
- `nemotron-bolt-e4b-video-{light,dark}-{16x9,9x16}.mp4` (60 fps, with music); silent masters in `out/video/silent/`
- `out/frames/`: review frames; `out/copy-filled.md`: `copy.md` with the numbers in; `out/post.md`: the final thread
  with counts, alt text and the handle table

## Where the numbers come from

`../promo-data.json` holds the headline numbers from `../RESULTS.md`, `../README.md` and `../best-config.json`, each
naming its source. `tools/prep.py` reads that source and prints a PROBLEM for any mismatch, and the plates then say
`DRAFT` instead of `MEASURED`:

| Value | Checked against |
|---|---|
| decode / prefill / aggregate, `[value, label, case]` | `../runs/ledger.jsonl` (`code-0k-med`, `code-60k-med`, `pp-*-med`, `c4-agg-med`) |
| acceptance, TTFT, VRAM | the same ledger rows (`accept`, `ttft_s`, `vram_mib`) |
| needles at 32k / 61k, the four 30k soak needles | `../runs/ledger.jsonl` (`found`) |
| codeeval thinking off (stock and default) | `../runs/codeeval-lenient-b10-*-nothink.json` |
| 4 × 64k + DFlash out of memory | `../runs/server-b08-multi.log` |
| KLD not measured, acceptance corpus, `-bs` experimental, needles on every profile, the 71% wall, `-bs` gains, 3.9 tokens per step, both licences | statements matched word for word in RESULTS.md / README.md |

Speed-ups (2.5×, 2.8×, 2.9×), the prefill ratio (0.62×), the isolated lever gains (DFlash 2.4×, q8_0 −22%,
`-ub 1024` +3.3% / +6.8%), the share of the ceiling (71%) and tokens per step (3.9) are computed in prep from the
measured values and compared with the rounded figures the recipe states. Numbers round half up in the plates and copy.

## Plates (`src/Plates.tsx`, timings in `src/timeline.json`)

01 the result (thinking on 75.9 → 190.4, 2.5×; thinking off 76.3 → 216.7; 54.2 → 157.8 at 60k) · 02 the drafter
(card / no drafter / DFlash bars at empty and 60k; plain is 71% of its 109 tok/s ceiling; 3.9 tokens per step) ·
03 the price (prefill at 8k / 32k / 60k and TTFT at 61k for card, DFlash and nospec; 0.62×) · 04 four users (4 × 32k
+ DFlash 270.7 total, 4 × 64k without it 164.6, 4 × 64k with it out of memory) · 05 checks and limits (needles,
KLD, acceptance corpus, `-bs`) · 06 run it (serve commands, credits) · dh card. `src/Stills.tsx` builds the stills
from the same data.

Type: Hopscotch for titles and the name on the dh card, Stem 7 for numbers and labels, Tick 35 (32 px, words only)
for short descriptions, IBM Plex Mono for flags and commands. Palette from secret-sauce `tokens.json`
(`tools/sauce_palette.py`). One vermilion per plate: 2.5× on 01, 3.9 on 02, 0.62× on 03, the out-of-memory rule on
04, the DEFAULT stamp on the flags card; the social cards (results, poster) use sun + cobalt. Table column headers sit
in right-aligned columns at least 200 px wide with a 24–32 px gap, so CARD / DFLASH / GAIN never touch.

## Music

Video fits the music: `public/audio/bed.m4a` is the Flint promo's 30 s bed (117.5 BPM, sound ends at 23.86 s), copied
in unchanged from the Maxwell promo, not looped or stretched. Plates cut on its bars (one bar = 2.043 s: 0, 4.09,
8.17, 12.26, 16.34, 20.43, dh card at 24.51); the mux keeps the video's 28 s, so the last 4 s are the dh card after
the bed ends, as in the earlier cuts. No new bed was generated, so the shared GPU was not used.

## Credits on screen

NVIDIA (model, GGUF, DFlash drafter), Google (Gemma-4-E4B-it base), llama.cpp and ggml-org (engine), 0xSero's
inference-optimisation skill (method).
