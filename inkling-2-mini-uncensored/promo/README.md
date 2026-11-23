# Inkling-2-Mini uncensored promo

A 28 s video (16:9 and 9:16, light and dark), three thread stills and the launch copy for the
`inkling-2-mini-uncensored` recipe. Same family as `../../qwen38-27b-family/promo/` and `../../inkling-2-mini/promo/`
(poster plates, dh card close), built in Remotion.

## Re-render

```sh
cd inkling-2-mini-uncensored/promo
./render.sh stills    # data + stills + lint (seconds)
./render.sh frames    # one frame per plate, each theme and ratio, + lint
./render.sh video     # the four cuts with the music bed (about 3 min each, CPU only)
./render.sh           # all of it
python3 -I tools/xcount.py out/post.md   # X-weighted count of each post
```

Rendering is CPU only (Chromium with SwiftShader, `--gl=swangle`, `nice -n 19`, 4 frames at a time), so it stays out
of the way of a GPU job. `node_modules` links to `../../flint/promo/node_modules` (Remotion 4.0.529).

Outputs in `out/` (gitignored):
- `inkling-2-mini-uncensored-results-light.png` and `-flags-light.png` (1600×900), `-poster-light.png` and
  `-poster-dark.png` (1080×1350); dark results and flags cards for review in `out/stills/extra/`
- `inkling-2-mini-uncensored-video-{light,dark}-{16x9,9x16}.mp4` (60 fps, with music); silent masters in `out/video/silent/`
- `out/frames/`: review frames; `out/copy-filled.md`: `copy.md` with the numbers in; `out/post.md`: the final thread
  with counts, alt text and the verified handle table

## Where the numbers come from

`../promo-data.json` holds the headline numbers from `../RESULTS.md`, each naming its source. `tools/prep.py` reads that
source and prints a PROBLEM for any mismatch, and the plates then say `DRAFT` instead of `MEASURED`:

| Value | Checked against |
|---|---|
| decode / prefill, `[value, label, case]` | `../runs/ledger.jsonl` (`code-0k-med`, `pp-8k-med`, `code-32k-med`) |
| needles | `../runs/ledger.jsonl` (`needle-32k`, `needle-62k`, field `found`) |
| KLD, `[value, run]` | `../runs/kld/summary.txt` (`Mean KLD`), and the PPL ratio from the same file |
| refusal probe | `../runs/refusal-reread.json` (answered / hedged / refused) |
| codeeval | `../runs/codeeval-<label>.json` |
| image input | `../runs/smoke-*.json` (the answer names red, blue and the white square) |
| unedited KLD 0.0085 / 0.0088 | `../../inkling-2-mini/RESULTS.md` (base recipe, reported there) |

The unedited decode and prefill are the mean of the two controls either side of the shipped AD-Q4_K run. The speed-up
over the experts-in-RAM line, the runtime-LoRA costs (against each run's own controls), the KLD ratio and the
perplexity change are computed in prep and compared with the rounded figures RESULTS.md states. Numbers round half up
from their decimal value in both the plates and the copy.

## Plates (`src/Plates.tsx`, timings in `src/timeline.json`)

01 the result (probe 8 → 20, decode 29.0 → 29.6, KLD 0.0085 → 0.014) · 02 refusal probe (20 cells per variant,
answered / hedged) · 03 what each edit costs (KLD bars; nokeepai 3× AtomicChat) · 04 decode by variant (runtime LoRAs
−7% / −26%) · 05 what fits (24.1 at 32k, needles, image input; the model cards' line does not load, 1.72× over the
experts-in-RAM line) · 06 run it (serve commands, credits) · dh card. `src/Stills.tsx` builds the stills from the same parts.

Type: Hopscotch for titles and the name on the dh card, Stem 7 for numbers and labels, Tick 35 (32 px, words only)
for the variant names and the key, IBM Plex Mono for flags and commands. Palette from secret-sauce `tokens.json`
(`tools/sauce_palette.py`). One vermilion per plate: the 20 on 01, the 3× on 03, the −26% on 04, the card-line stamp
on 05, the DEFAULT stamp on the flags card; the social cards (results, poster) use sun + cobalt.

## Music

Video fits the music: `public/audio/bed.m4a` is the Flint promo's 30 s bed (117.5 BPM, sound ends at 23.86 s), copied
in unchanged from the Qwen promo, not looped or stretched. Plates cut on its bars (one bar = 2.043 s: 0, 4.09, 8.17,
12.26, 16.34, 20.43, dh card at 24.51); the mux keeps the video's 28 s (`-shortest`), so the last 4 s are the dh card
after the bed ends, as in the Inkling and Qwen cuts. No new bed was generated, so the shared GPU was not used.

## Credits on screen

Thinking Machines (Inkling-2-Mini), nokeepai and AtomicChat (the edits), llama.cpp and ggml-org (engine, GGUFs),
Pedro Cuenca (PR #32694, Inkling support), 0xSero's inference-optimisation skill (method).
