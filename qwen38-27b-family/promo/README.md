# Qwen3.8-27B family promo

A 28 s video (16:9 and 9:16, light and dark), three thread stills and the launch copy for the `qwen38-27b-family`
recipe. Same family as `inkling-2-mini/promo/` and `flint/promo/` (poster plates, dh card close), built in Remotion.

## Re-render

```sh
cd qwen38-27b-family/promo
./render.sh stills    # data + stills + lint (seconds)
./render.sh frames    # one frame per plate, each theme and ratio, + lint
./render.sh video     # the four cuts with the music bed (about 3 min each, CPU only)
./render.sh           # all of it
```

Rendering is CPU only (Chromium with SwiftShader, `--gl=swangle`, `nice -n 19`, 4 frames at a time), so it stays out
of the way of a GPU job.

Outputs in `out/` (gitignored):
- `qwen38-27b-family-results-light.png` (1600×900), `qwen38-27b-family-flags-light.png` (1600×900),
  `qwen38-27b-family-poster-light.png` and `-poster-dark.png` (1080×1350); dark results and flags cards for review in
  `out/stills/extra/`
- `qwen38-27b-family-video-{light,dark}-{16x9,9x16}.mp4` (60 fps, with music); silent masters in `out/video/silent/`
- `out/frames/`: review frames; `out/copy-filled.md`: `copy.md` with the numbers in; `out/post.md`: the final thread
  with counts, alt text and the verified handle table

## Where the numbers come from

`../promo-data.json` holds the headline numbers from `../RESULTS.md`. Each measured value is written as
`[value, ledger label, ledger case]`, and `tools/prep.py` looks every one up in `../runs/ledger.jsonl`: any mismatch
is printed as a PROBLEM and the plates say `DRAFT` instead of `MEASURED`. Speed-ups and the mean of two stock controls
are computed in prep, never typed. Numbers round half up from their decimal value (14.35 shows as 14.4) in both the
plates and the copy.

## Plates (`src/Plates.tsx`, timings in `src/timeline.json`)

01 stock vs tuned (7.9 → 16.6, 2.1×; 19.7 at 16k) · 02 what stays in RAM (64 layer cells, stock 16 whole layers vs tuned
FFN 0–2, ~29 ms per GB) · 03 the four flags · 04 four finetunes, one config · 05 the window (16k / 32k / 128k, needles)
and MTP not kept · 06 run it (serve commands, credits) · dh card. `src/Stills.tsx` builds the stills from the same parts.

Type: Hopscotch for titles and the name on the dh card, Stem 7 for numbers and labels, Tick 35 (32 px, words only)
for the finetune names and the key, IBM Plex Mono for flags and commands. Palette from secret-sauce `tokens.json`
(`tools/sauce_palette.py`). One vermilion per plate: the 2.1× on 01, the ~29 ms on 02, the MTP stamp on 05; the
social cards use sun + cobalt.

## Music

Video fits the music: `public/audio/bed.m4a` is the Flint promo's 30 s bed (117.5 BPM, sound ends at 23.86 s), copied
in unchanged, not looped or stretched. Plates cut on its bars (one bar = 2.043 s: 0, 4.09, 8.17, 12.26, 16.34, 20.43,
dh card at 24.51); the mux keeps the video's 28 s (`-shortest`), so the last 4 s are the dh card after the bed ends,
as in the Inkling cut. No new bed was generated, so the shared GPU was not used.

## Credits on screen

Qwen (base), harness-hub, huihui-ai, RadixArk, DavidAU (finetunes), netprojects, bartowski, huihui-ai with ISTA-DASLab's
GSQ-RCO (GGUFs), llama.cpp (engine), 0xSero's inference-optimisation skill (method).
