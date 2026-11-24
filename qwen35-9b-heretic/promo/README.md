# Qwen3.5-9B Heretic promo

A 28 s video (16:9 and 9:16, light and dark), three thread stills and the launch copy for the `qwen35-9b-heretic`
recipe. Same family as `../../sensenova-loop-9b/promo/` (poster plates, dh card close), built in Remotion.

## Re-render

```sh
cd qwen35-9b-heretic/promo
./render.sh stills    # data + stills + lint (seconds)
./render.sh frames    # one frame per plate, each theme and ratio, + lint
./render.sh video     # the four cuts with the music bed (about 3 min each, CPU only)
./render.sh           # all of it
python3 -I tools/xcount.py out/post.md   # X-weighted count of each post
```

Rendering is CPU only (Chromium with SwiftShader, `--gl=swangle`, `nice -n 19`, 4 frames at a time), so it stays out
of the way of a GPU job. `node_modules` links to `../../flint/promo/node_modules` (Remotion 4.0.529).

Outputs in `out/` (gitignored):
- `qwen35-9b-heretic-results-light.png` and `-flags-light.png` (1600×900), `-poster-light.png` and `-poster-dark.png`
  (1080×1350); dark results and flags cards for review in `out/stills/extra/`
- `qwen35-9b-heretic-video-{light,dark}-{16x9,9x16}.mp4` (60 fps, with music); silent masters in `out/video/silent/`
- `out/frames/`: review frames; `out/copy-filled.md`: `copy.md` with the numbers in; `out/post.md`: the final thread
  with counts, alt text and the handle table

## Where the numbers come from

`../promo-data.json` holds the headline numbers from `../RESULTS.md`, `../README.md`, `../THEORY.md` and
`../best-config.json`, each naming its source. `tools/prep.py` reads that source and prints a PROBLEM for any mismatch,
and the plates then say `DRAFT` instead of `MEASURED` (77 values checked at the last render, no problems):

| Value | Checked against |
|---|---|
| decode / prefill / TTFT / acceptance, `[value, label, case]` | `../runs/ledger.jsonl` (`code-*-med`, `pp-*-med`, `needle-*`) |
| needles, with their prompt lengths (32.8k, 61.8k … 186.0k) | `../runs/ledger.jsonl` (`found`, `prompt_n`) |
| head A/B (39.4 controls, 44.3 plain Q8_0 head, 64.6 / 76.3 with MTP) | `../runs/ledger.jsonl` (b04) |
| codeeval 5/8 = 5/8 | `../runs/codeeval-b08-stock.json`, `-b13-default.json` (and `-b07-fast.json`) |
| refusal classifier | `../runs/refusal-b10-think-off.json` (the hand-read 20/20 is a text check) |
| greedy identity (3/4 thinking on, 3/3 off) | `../runs/greedy/*.json` (texts compared exactly) |
| long answers (5/6 both, 1 capped, 0 loops, 24,000 tokens) | `../runs/longans/` (b02, b03, b10) |
| KLD 0.0001 (head), 0.00036 / 0.0013 (q8_0 K/V) | `../runs/kld/summary.txt` ("Mean KLD") |
| 11.4 GB on the card | `../best-config.json` |
| bytes per token (5.672 / 2.034 / 0.10 / 7.81, Q8_0 head 1.08 → 6.86, draft 2.23), b12242, the 24k answer, refusal reading, no base, no quant KLD, 262k does not fit, 48 s requant | statements matched word for word in RESULTS.md / README.md / THEORY.md |

The speed-ups (1.6×, 2.0×), the head's share of the bytes (26%), the draft's share (29%), percent of ceiling (90%),
acceptance (85% / 79%) and the prefill cost (−6%) are computed in prep and compared with the rounded figures RESULTS.md
and README.md state. Numbers round half up in both the plates and the copy.

## Plates (`src/Plates.tsx`, timings in `src/timeline.json`)

01 the result (39.4 → 64.3 thinking off, 1.6×; 39.4 → 61.5 thinking on; 31.5 → 49.9 deep) · 02 the BF16 head (stacked
bars of GB read per token: published file 7.81 with the head at 26%, Q8_0 head 6.86, the draft step's reread; 78.3 for
fast) · 03 long answers (MTP n=2 against no speculation on six prompts, both 5/6 with no loops; 24k tokens coherent;
greedy 3/4 and 3/3) · 04 the window (64k with MTP, 128k with the Q8_0 head, 192k without MTP, 262k does not fit; 189 s to
the first token at 186k) · 05 uncensored (20 refusal-probe cells, prefill cost, codeeval, quantization KLD and base probe
marked NOT RUN) · 06 run it (serve commands, credits) · dh card. `src/Stills.tsx` builds the stills from the same data.

Type: Hopscotch for titles and the name on the dh card, Stem 7 for numbers and labels, IBM Plex Mono for flags and
commands. Palette from secret-sauce `tokens.json` (`tools/sauce_palette.py`). One vermilion per plate: 1.6× on 01, 78.3
on 02, 24K on 03, 189 S on 04, the DEFAULT stamp on the flags card; the social cards (results, poster) use sun + cobalt.

## Music

Video fits the music: `public/audio/bed.m4a` is the Flint promo's 30 s bed (117.5 BPM, sound ends at 23.86 s), copied
in unchanged, not looped or stretched. Plates cut on its bars (one bar = 2.043 s: 0, 4.09, 8.17, 12.26, 16.34, 20.43,
dh card at 24.51); the mux keeps the video's 28 s, so the last 4 s are the dh card after the bed ends, as in the earlier
cuts. No new bed was generated, so the shared GPU was not used.

## Credits on screen

DavidAU (model, MAX/MTP GGUF), Nightmedia (merge co-author), Qwen (Qwen3.5-9B, base model), llama.cpp and ggml-org
(engine), 0xSero's inference-optimisation skill (method).
