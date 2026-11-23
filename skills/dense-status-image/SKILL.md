---
name: dense-status-image
description: Make a single information-dense status image (one PNG) that shows the progress of long-running work - what changed since the last image, where each work item stands, charts of the measured numbers, and what is waiting on the owner - built by a script that reads only the project's real run files. Use when asked to "send me an update image", "status image", "dense image report", "put the progress in an image", "update image of progress since the last one", for regular updates during a long agent run, or when a status has to be readable on a phone without opening a page. For an interactive page use a visual-recap or dashboard skill instead.
---

# Dense status image

One image a person can read on a phone in a minute and trust. It replaces a status message, so it has to carry
the numbers, and it has to be right.

Scope: shareable, no machine-specific facts. Use your house style skill for the look and your own delivery
skill for sending it; this skill covers what the image contains and how to produce it reliably.

## Rules

1. **A script builds it, from run files only.** Write a generator (`status_report.py` or similar) and keep it in
   the repo. It reads ledgers, result JSON, logs, `df`, queue state. It never contains a typed-in result. A
   number with no source is left out; a chart with no data says "no runs yet" in its place.
2. **One small hand-written file for the words.** Headline, one-line subhead, per-item notes, decisions, what
   is next. Everything countable comes from the run files. Keep the two apart so a re-render can't go stale in
   one half.
3. **Headline says what changed since the last image.** "Since the last image: gate passed, test split
   running", not "Status report". Number the images (`update 3`) and timestamp them.
4. **Use the space.** No big margins, no hero block, no decorative blanks. If a column ends short, move a plate
   into it. Dense does not mean small type: keep body text at a size readable when the image is fit to a phone
   screen's width and zoomed once.
5. **Visual first.** A bar, a dot plot, a timeline or a stage grid beats a sentence. Text is for labels, one
   caption per chart, and decisions.
6. **Say what is uncertain.** In-sample vs held-out, estimate vs measured, still running at render time: label
   it on the chart.

## Layout that works

Top to bottom, at a fixed width (about 2400 px for a 3-column sheet, or about 1080 CSS px at 2x for a
phone-tall single column):

- **Spine or header strip**: project, update number, date and time.
- **Headline + subhead**, with a legend for the 3–4 fill styles used everywhere (done, in progress, not
  started, baseline).
- **Tile row**: one tile per work item (model, experiment, phase): name, state word, thin progress bar, one line.
- **Numbered plates** in columns. Each plate: a header (`PLATE n · TITLE · STATUS WORD`), one chart, one
  caption that tells the reader how to read it and what it shows. Typical plates:
  - progress against a manifest (files fetched, rows evaluated, tests run)
  - stage grid: items × stages, filled to where each stands
  - measured results: baseline vs best vs ceiling, with ranges
  - quality gates passed / failed / not run
  - resources: disk, memory, queue or lock holder
  - timeline of batches
  - work streams table (what is running in the background)
- **Decisions and next**: a small table (question, finding, decision) and a row of numbered next-step cards.
  Exactly one card in the accent colour: the thing waiting on the owner. If nothing is waiting, no accent card.
- **Footer strip**: commit, engine or tool versions, seeds, where the raw data is.

Draw charts as inline SVG with a `viewBox` equal to the column's real pixel width, so text is not scaled.
Use 3–4 fill classes consistently across every chart.

## Reading ledgers defensively

Run logs differ between sub-projects. Don't assume a schema:

- Parse line by line; skip lines that are not JSON objects.
- Count rows and distinct config labels (try `label`, `config`, `id`, `session`).
- Find metrics by key pattern (for example keys containing `tps`, `prefill`, `decode`, `acc`, `loss`) and plot
  min, max and best rather than a specific field.
- Use file mtime for "last activity".

## Render

Headless Chromium, no GPU:

1. End the page with a script that writes the page height into the title once fonts are loaded:
   `document.fonts.ready.then(()=>{document.title=String(document.documentElement.scrollHeight)})`
2. Dump the DOM once at a short window (`--dump-dom --virtual-time-budget=8000 --window-size=W,800`) and read
   the height from `<title>`.
3. Screenshot at `--window-size=W,H` with `--hide-scrollbars`. For a phone-tall image use
   `--force-device-scale-factor=2`.

Name it `status-YYYYMMDD-n.png`, keep the HTML beside it, and commit both with the generator.

## Check your own image

Open the PNG and look at it before sending. Common faults and fixes:

- text clipped at a chart's right edge: the `viewBox` is wider than the column, or a label is too long;
  shorten or truncate the middle of long filenames
- a grid column pushed wide by a long word: `min-width: 0` on grid children, `minmax(0, 1fr)` tracks
- overlapping axis labels: fewer ticks or shorter stage names
- an empty area: move a plate or add one
- a number that looks wrong: trace it to its file; fix the reader, never the picture

Run your style linter if you have one. Re-render and look again after every fix.

## Hand over

Send or attach the image, and beside it write 3–5 short lines in chat: what changed, the key numbers, what is
waiting on the owner, where the file is. The image is the report; the chat lines are the index to it.

## When to send

On events, not on a clock: a stage finishes, a result changes the plan, something needs a decision, or the
owner asks. Don't re-send an image whose only change is the timestamp.
