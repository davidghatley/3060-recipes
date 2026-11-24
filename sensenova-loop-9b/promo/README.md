# SenseNova-Loop-9B promo

A 28 s video (16:9 and 9:16, light and dark), three thread stills and the launch copy for the `sensenova-loop-9b`
recipe. Same family as `../../maxwell-v1-flash/promo/` and `../../inkling-2-mini-uncensored/promo/` (poster plates,
dh card close), built in Remotion.

## Re-render

```sh
cd sensenova-loop-9b/promo
./render.sh stills    # data + stills + lint (seconds)
./render.sh frames    # one frame per plate, each theme and ratio, + lint
./render.sh video     # the four cuts with the music bed (about 3 min each, CPU only)
./render.sh           # all of it
python3 -I tools/xcount.py out/post.md   # X-weighted count of each post
```

Rendering is CPU only (Chromium with SwiftShader, `--gl=swangle`, `nice -n 19`, 4 frames at a time), so it stays out
of the way of a GPU job. `node_modules` links to `../../flint/promo/node_modules` (Remotion 4.0.529).

Outputs in `out/` (gitignored):
- `sensenova-loop-9b-results-light.png` and `-flags-light.png` (1600×900), `-poster-light.png` and `-poster-dark.png`
  (1080×1350); dark results and flags cards for review in `out/stills/extra/`
- `sensenova-loop-9b-video-{light,dark}-{16x9,9x16}.mp4` (60 fps, with music); silent masters in `out/video/silent/`
- `out/frames/`: review frames; `out/copy-filled.md`: `copy.md` with the numbers in; `out/post.md`: the final thread
  with counts, alt text and the handle table

## Where the numbers come from

`../promo-data.json` holds the headline numbers from `../RESULTS.md`, `../README.md` and `../best-config.json`, each
naming its source. `tools/prep.py` reads that source and prints a PROBLEM for any mismatch, and the plates then say
`DRAFT` instead of `MEASURED`:

| Value | Checked against |
|---|---|
| decode / prefill / TTFT / acceptance, `[value, label, case]` | `../runs/ledger.jsonl` (`code-*-med`, `pp-*-med`, `needle-*`) |
| decode ranges (20.7 etc.) | the same rows' `min` / `max` |
| needles | `../runs/ledger.jsonl` (`found`) |
| greedy identity (3/8, 0/8), the prose prompt (22.6 vs 24.3 at 39%) and the plate 02 bars | `../runs/greedy/*.json` (texts compared exactly) |
| codeeval 6/8, 4/8 | `../runs/codeeval-b06-def-nothink.json`, `-b08-unc-nothink.json` |
| refusal classifier counts | `../runs/refusal-*.json` (the hand-read 4/20 and 20/20 are text checks) |
| image input on both | `../runs/smoke-b06-def-mmproj.json`, `-b08-unc-mmproj.json` |
| PR, spread, greedy, >256k, TTFT, refusal reading, image, no KLD, uncensored speed, 70–74% | statements matched word for word in RESULTS.md / README.md |

Control means (24.4 thinking off, 24.3 on), gains (+30%, +38%), the prefill cost (−3%) and acceptance are computed in
prep and compared with the rounded figures RESULTS.md states. Numbers round half up in both the plates and the copy.

## Plates (`src/Plates.tsx`, timings in `src/timeline.json`)

01 the result (24.4 → 31.7 thinking off, +30%; 24.3 → 33.5 thinking on; prefill 857 → 829) · 02 MTP spread (per-prompt
MTP speed on the greedy set against the plain line, acceptance and same-text marks; the prose prompt under the line) ·
03 the window (128k with MTP, 256k without, 384k / 512k do not fit; 552 s to the first token on a 247k prompt) ·
04 uncensored (probe cells 4/20 vs 20/20 with 4 softened, codeeval, stock = tuned speed, image input) · 05 limits
(greedy 3/8, KLD not measured, nothing above 256k, needs PR #32588) · 06 run it (serve commands, credits) · dh card.
`src/Stills.tsx` builds the stills from the same data.

Type: Hopscotch for titles and the name on the dh card, Stem 7 for numbers and labels, IBM Plex Mono for flags and
commands. Palette from secret-sauce `tokens.json` (`tools/sauce_palette.py`). One vermilion per plate: +30% on 01, the
prose bar on 02, 552 S on 03, the DEFAULT stamp on the flags card; the social cards (results, poster) use sun + cobalt.

## Music

Video fits the music: `public/audio/bed.m4a` is the Flint promo's 30 s bed (117.5 BPM, sound ends at 23.86 s), copied
in unchanged from the Maxwell promo, not looped or stretched. Plates cut on its bars (one bar = 2.043 s: 0, 4.09, 8.17,
12.26, 16.34, 20.43, dh card at 24.51); the mux keeps the video's 28 s, so the last 4 s are the dh card after the bed
ends, as in the earlier cuts. No new bed was generated, so the shared GPU was not used.

## Credits on screen

SenseNova (model, GGUF, mmproj), satellitedown (abliterated GGUF), niushengxiao and SenseTime (llama.cpp PR #32588),
llama.cpp and ggml-org (engine), 0xSero's inference-optimisation skill (method).
