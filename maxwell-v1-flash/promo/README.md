# Maxwell-V1-Flash promo

A 28 s video (16:9 and 9:16, light and dark), three thread stills and the launch copy for the `maxwell-v1-flash`
recipe. Same family as `../../inkling-2-mini-uncensored/promo/` and `../../qwen38-27b-family/promo/` (poster plates,
dh card close), built in Remotion.

## Re-render

```sh
cd maxwell-v1-flash/promo
./render.sh stills    # data + stills + lint (seconds)
./render.sh frames    # one frame per plate, each theme and ratio, + lint
./render.sh video     # the four cuts with the music bed (about 3 min each, CPU only)
./render.sh           # all of it
python3 -I tools/xcount.py out/post.md   # X-weighted count of each post
```

Rendering is CPU only (Chromium with SwiftShader, `--gl=swangle`, `nice -n 19`, 4 frames at a time), so it stays out
of the way of a GPU job. `node_modules` links to `../../flint/promo/node_modules` (Remotion 4.0.529).

Outputs in `out/` (gitignored):
- `maxwell-v1-flash-results-light.png` and `-flags-light.png` (1600×900), `-poster-light.png` and `-poster-dark.png`
  (1080×1350); dark results and flags cards for review in `out/stills/extra/`
- `maxwell-v1-flash-video-{light,dark}-{16x9,9x16}.mp4` (60 fps, with music); silent masters in `out/video/silent/`
- `out/frames/`: review frames; `out/copy-filled.md`: `copy.md` with the numbers in; `out/post.md`: the final thread
  with counts, alt text and the handle table

## Where the numbers come from

`../promo-data.json` holds the headline numbers from `../RESULTS.md`, `../README.md` and `../best-config.json`, each
naming its source. `tools/prep.py` reads that source and prints a PROBLEM for any mismatch, and the plates then say
`DRAFT` instead of `MEASURED`:

| Value | Checked against |
|---|---|
| decode / prefill, `[value, label, case]` | `../runs/ledger.jsonl` (`code-0k-med`, `code-32k-med`, `pp-*-med`, `needle-32k`) |
| needles at 32k | `../runs/ledger.jsonl` (`found`) |
| LoRA KLD | `../runs/kld/summary.txt` |
| codeeval | `../runs/codeeval-f04-base-code.json` |
| card line, 19,397 MiB | the failed CUDA0 allocation in `../runs/server-m00-card-line.log` |
| needles at ~62k, f16 crossover, LoRA halving, quant drift, card line | statements matched word for word in RESULTS.md / README.md |

Means of controls (the five pinned-split controls, the two q8_0 runs at 32k, the two f16 runs, the two LoRA base
controls), speed-ups and lever gains are computed in prep and compared with the rounded figures RESULTS.md states.
Numbers round half up in both the plates and the copy. The needle `found` field at 65k says 3/3 because it only
checks presence; RESULTS.md reads the answers (not clean), and the package follows RESULTS.md.

## Plates (`src/Plates.tsx`, timings in `src/timeline.json`)

01 the result (decode 35.9 → 48.0, 1.34×; 27.4 → 33.6 at 32k; prefill 364 → 787) · 02 expert cache (12 pinned MoE
layers 39.6 vs the same VRAM as a hot-expert cache 52.7, +33%) · 03 KV at depth (q8_0 vs f16, empty and at 32k;
q8_0 −35% at 32k) · 04 prefill (`--load-mode none` +38%, `-ub 1024` +58%; 2.16×) · 05 limits (needles, LoRA speed,
card line, drift vs BF16 not measured) · 06 run it (serve commands, credits) · dh card. `src/Stills.tsx` builds the
stills from the same data.

Type: Hopscotch for titles and the name on the dh card, Stem 7 for numbers and labels, Tick 35 (32 px, words only)
for short descriptions, IBM Plex Mono for flags and commands. Palette from secret-sauce `tokens.json`
(`tools/sauce_palette.py`). One vermilion per plate: 1.34× on 01, +33% on 02, −35% on 03, 2.16× on 04, −51% on 05,
the DEFAULT stamp on the flags card; the social cards (results, poster) use sun + cobalt. sauce-lint flags the 240 px
1.34× on plate 01 as two vermilion regions (the "1" stands apart); it is one number, as on the Qwen promo's 2.1×.

## Music

Video fits the music: `public/audio/bed.m4a` is the Flint promo's 30 s bed (117.5 BPM, sound ends at 23.86 s), copied
in unchanged from the Inkling uncensored promo, not looped or stretched. Plates cut on its bars (one bar = 2.043 s:
0, 4.09, 8.17, 12.26, 16.34, 20.43, dh card at 24.51); the mux keeps the video's 28 s (`-shortest` on the 28 s
picture), so the last 4 s are the dh card after the bed ends, as in the earlier cuts. No new bed was generated, so
the shared GPU was not used.

## Credits on screen

The Maxwell team (Maxwell-V1-Flash), AtomicChat (port patch, GGUF, LoRA), llama.cpp and ggml-org (engine),
0xSero's inference-optimisation skill (method).
