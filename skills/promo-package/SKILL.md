---
name: promo-package
description: Build the launch package for a technical result (a benchmark, a tuning recipe, a library release, a research finding) - a short data-driven video, still cards, post/thread copy, alt text and a verified thanks list - where every number on screen is read from the project's own result files. Use whenever someone asks for a promo, launch video, social package, share video, "something to post", an X/Twitter thread, a results card, or a README header for a project with measured numbers, even if they only say "make the post for this". Covers the Remotion data pipeline, stills-first review, light/dark and 16:9 + 9:16 cuts, music fitting, CPU rendering, frame checks, thread structure, handle verification and the copy-button review page. The agent never posts; it hands over a package.
---

# Promo package

A promo for a technical result fails in two ways: a number on screen that does not match the repo, and a
slide that explains instead of showing. This skill is built around preventing both.

The package, when finished:

- video: one cut per aspect ratio (16:9 and 9:16) and theme (light and dark)
- stills: results card, "how" card (flags / config / diff), poster or README header
- copy: main post, thread replies, a longer version for a second network, a README blurb
- alt text for every image and the video
- thanks list with a verified handle or "unconfirmed" for every person and org
- a review page with a copy button per item

Nothing is posted by you. The owner posts. Your job ends at a package they can paste from.

## 1. One data file, nothing typed by hand

Every figure in the video, the stills and the copy comes from one JSON file that the measuring work wrote
(`promo-data.json` next to the results). A prep script turns it into the data the compositions import.

```
<project>/promo-data.json      written from the results, by the run that measured them
<project>/promo/
  tools/prep.py                promo-data.json -> src/data.json ; fills copy.md -> out/copy-filled.md
  src/data.json                generated, never edited
  src/*.tsx                    Remotion compositions, read data.json only
  src/timeline.json            every beat as a named timestamp
  copy.md                      post copy with {{tokens}}
  render.sh                    prep -> stills -> video -> lint -> "which numbers are still placeholders"
  out/                         gitignored renders
```

Rules for prep, and why:

- A missing or null value stays null. On screen it prints as a dash, and every plate header and card says
  `DRAFT` until the headline set is complete. A promo started before the numbers are final is normal; a
  made-up placeholder that survives to the final render is the failure to design out.
- In copy, an unfilled `{{token}}` is left as it is, so it is obvious in the review page.
- Derived numbers (speed-up, percent gain) are computed in prep from the two measured values, not written by hand.
- Facts that come from someone else's page (model size, licence, a published benchmark) live in one clearly
  labelled block with their source, and any plate showing them says they are reported, not measured here.
- Have prep print the keys it did not use, so a renamed key is noticed.

`references/pipeline.md` has a prep and render skeleton to adapt.

## 2. Stills first

Render one still per plate plus the social cards, and get them reviewed before any video render. Stills take
seconds; a video takes minutes per variant, and layout and wording changes are nearly all decided at the
still stage. Because stills are frames of the same scene code, what is approved is what the video shows.

Show stills on a review page (section 8) with a version label per round ("v2: shorter copy, 9:16 added").
Only render video once the stills are accepted.

## 3. What goes on screen

These rules come from repeated review feedback on real promos. Each has its reason; apply the reason when a
case is not covered.

- **Lead with the result.** The first plate and the first post state what was run on what, and the headline
  number. Viewers decide in two seconds; an introduction plate loses them.
- **Write for people who already know the field.** Do not explain standard concepts (what a mixture-of-experts
  is, what a quantized model is). The audience is practitioners, and explanation reads as padding. One plate
  for a genuinely new mechanism is fine; say it in a figure, not a paragraph.
- **Few words.** If a plate has a sentence, try a label. If it has three numbers of equal weight, pick the one.
- **Before and after at the same size.** Show "old → new" with both values in the same type size and an arrow.
  A small "before" hides the comparison that makes the result believable.
- **Gains as big as the values they describe.** A multiplier or percent gain uses the same face and size as
  the headline numbers, set apart by colour only.
- **Benchmarks on one plate.** One table or chart with everything, not a plate per metric.
- **Use the frame.** Type should be large enough to read on a phone at arm's length, and the composition
  should fill the frame. Large empty margins on a 9:16 cut are the most common fault.
- **Animate the comparison.** Bars that grow from baseline to tuned, a line across context depth: motion
  should carry the result, not decorate it. Keep entries quick; slow reveals are only for the one plate that
  needs reading time.
- **One typeface family for display, one mono for code and flags.** Mixing display faces across plates looks
  like separate projects.
- **Burn the numbers into the video.** Many viewers watch muted.
- **Number plates last.** If plates carry numbers, renumber after cutting one.

## 4. Variants

- **Themes:** light and dark, from one palette file. Check both; a colour that works on light often fails contrast on dark.
- **Aspect ratios:** 16:9 and 9:16. The vertical cut is a re-layout (stack, larger type), not a crop; dense
  cards are often easier to read vertical.
- **Stills:** social card (1200×675 or 1600×900), square (1080×1080), and a README header pair for
  `<picture>` with `prefers-color-scheme`.
- **Length:** 20–35 s for the result video. A longer explainer is a separate cut with its own purpose.

## 5. Music

Pick one direction and say which:

- **Music fits the video:** generate or cut a bed at the video's exact length. Never loop or stretch a track;
  a loop point or an early stop is audible and reads as unfinished.
- **Video fits the music:** when an existing bed is right, keep it unchanged and move the plate timings so
  cuts land on its beats.

Record how the bed was made (tool, seed, tempo, key, tags) in the promo README so it can be regenerated.
Check it has no vocals unless intended, and check loudness on the final muxed file. Mux with stream copy for
video so the picture is not re-encoded.

## 6. Rendering

Render on CPU so a GPU job elsewhere is not disturbed, at low priority:

```sh
nice -n 19 npx remotion render src/index.ts <CompId> out/video/<name>-<theme>-<ratio>.mp4 \
  --gl=swangle --concurrency=4 --codec=h264 --pixel-format=yuv420p --crf=18
ffmpeg -y -i <silent>.mp4 -i public/audio/bed.m4a -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k \
  -movflags +faststart -shortest <name>-music.mp4
```

`yuv420p` and `+faststart` matter: without them some phones and social players refuse the file. Name files
`<project>-<kind>-<theme>-<ratio>` so the review page can refer to them exactly.

## 7. Check frames, not just the render log

You cannot watch the video, but you can read frames. Render one still per plate at a frame where everything
has entered, plus one mid-animation, in each theme and ratio, then look at each for:

- text clipped by the frame edge or by another element (short labels such as "1.7×" clip most often)
- overlapping chart labels
- anything still showing a dash or `DRAFT`
- a number that differs from the results file
- contrast in the dark theme

Fix and re-render the still before re-rendering video. If the project has a style linter, run it on the stills.

## 8. Copy

Write `copy.md` with tokens; prep fills it. Thread shape that has worked for technical results (5–6 posts):

1. **Result.** What ran on what, the headline before → after numbers, the video attached. No link here.
2. **The lever.** The one change that mattered most, with the actual flag or line. One image.
3. **What fits / gotchas.** Limits, the thing that breaks on stock settings, quality numbers. One image.
4. **Thanks.** People and orgs, each with what they contributed (section 9).
5. **Links.** Repo, weights or package, and an invitation ("Same hardware? Post your numbers.").

Rules:

- Every post within the platform limit: 280 characters on X, where any link counts as 23. Count, do not estimate.
- Links go in the last post. Put the result in the first.
- State which numbers are the publisher's and which are yours whenever both appear.
- Copy describes what was built and credits the stack and inspirations. Do not add lines about tools having
  written it unless the owner asks.
- Write alt text for each image and the video: what it shows and the key numbers, one or two sentences.
- If the link target is a private repo or an unpushed branch, say so at the top of the review page. A post
  pointing at a 404 is the most common launch mistake.

## 9. Thanks list: verify every handle

A wrong tag sends thanks to a stranger and is public. Handles are never written from memory.

For each person or org to credit, record:

| who | what they contributed | handle | where verified |
|---|---|---|---|

Verify from a primary page, in this order: the official site (often the footer), the organisation or user
profile on the model/package host, the GitHub profile's linked account, the project README. A code-host
login and a social handle are often different for the same person; confirm the social one separately.
If no primary page gives it, write the name in plain text and mark it **unconfirmed** in the review page.

Credit what was actually used: the authors of the thing being run, whoever made the files or packages you
depended on, authors of specific patches or PRs, the method you followed, and maintainers. Note sponsor or
donation links where they exist so the owner can add them.

## 10. Review page

Give the owner one page (HTML; a hosted private page if the environment offers one) with:

- a status line: draft or measured, and anything blocking posting (private repo, unconfirmed handles)
- each post as a card: text, a copy button, the character count, and the exact filename to attach
- the thanks table with verified / unconfirmed marks
- alt text with copy buttons
- still thumbnails that enlarge on click
- the list of media files and where they were delivered

Then deliver the media files the way the owner prefers, and commit the promo sources (not `out/`).

## Checklist before handing over

- [ ] prep reports no placeholders; no plate says DRAFT
- [ ] stills were reviewed before video was rendered
- [ ] every figure matches the results file
- [ ] frames checked in each theme and ratio
- [ ] every post counted and within the limit
- [ ] every handle verified or marked unconfirmed
- [ ] link targets are public, or the page says they are not
- [ ] nothing was posted
