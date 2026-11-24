#!/usr/bin/env bash
# Re-render the Qwen3.5-9B Heretic promo from ../promo-data.json: data, stills, review frames, video, lint.
#   ./render.sh stills    data + the thread stills + lint (seconds)
#   ./render.sh frames    one frame per plate in each theme and ratio, for review + lint
#   ./render.sh video     the four cuts (16:9 and 9:16, light and dark) with the music bed
#   ./render.sh           all of the above
# CPU only: Chromium with SwiftShader (--gl=swangle), niced, 4 frames at a time, so a GPU job elsewhere is not disturbed.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
what=${1:-all}
N=qwen35-9b-heretic
R=(--public-dir=public --browser-executable=/usr/bin/chromium --gl=swangle --log=error)
REM="nice -n 19 node_modules/.bin/remotion"
LINT=$HOME/Projects/secret-sauce/tools/lint/sauce-lint.mjs

python3 -I tools/prep.py
mkdir -p out/stills out/frames out/video/silent

if [ "$what" = all ] || [ "$what" = stills ]; then
  # the four thread stills; the dark results and flags cards are rendered for review only (out/stills/extra/)
  $REM still src/index.ts ResultsLight "out/$N-results-light.png" "${R[@]}"
  $REM still src/index.ts FlagsLight   "out/$N-flags-light.png"   "${R[@]}"
  $REM still src/index.ts PosterLight  "out/$N-poster-light.png"  "${R[@]}"
  $REM still src/index.ts PosterDark   "out/$N-poster-dark.png"   "${R[@]}"
  mkdir -p out/stills/extra
  $REM still src/index.ts ResultsDark "out/stills/extra/$N-results-dark.png" "${R[@]}"
  $REM still src/index.ts FlagsDark   "out/stills/extra/$N-flags-dark.png"   "${R[@]}"
  # results and poster are social cards (sun + cobalt); the flags card is a plate (cobalt + vermilion, docs pair)
  [ -f "$LINT" ] && { node "$LINT" out/$N-results-*.png out/$N-poster-*.png out/stills/extra/*results*.png --surface social --quiet || echo "lint: see above"; }
  [ -f "$LINT" ] && { node "$LINT" out/$N-flags-*.png out/stills/extra/*flags*.png --surface docs --quiet || echo "lint: see above"; }
fi

if [ "$what" = all ] || [ "$what" = frames ]; then
  # one frame per plate once everything has entered (seconds -> frames at 60 fps), plus the dh card
  for comp in QhLight QhDark QhLightV QhDarkV; do
    for f in 228 290 468 714 960 1206 1452 1620; do
      $REM still src/index.ts $comp "out/frames/$comp-$f.png" --frame=$f "${R[@]}"
    done
  done
  [ -f "$LINT" ] && { node "$LINT" out/frames/*.png --surface docs --quiet || echo "lint: see above"; }
fi

if [ "$what" = all ] || [ "$what" = video ]; then
  # music: the Flint 30 s bed (public/audio/bed.m4a, 117.5 BPM, sound ends at 23.86 s) unchanged; plates cut on its bars
  for comp in QhLight QhDark QhLightV QhDarkV; do
    th=$(case $comp in *Dark*) echo dark;; *) echo light;; esac)
    ar=$(case $comp in *V) echo 9x16;; *) echo 16x9;; esac)
    s="out/video/silent/$N-video-$th-$ar-silent.mp4"
    $REM render src/index.ts $comp "$s" "${R[@]}" --concurrency=4 --codec=h264 --crf=16 --pixel-format=yuv420p
    ffmpeg -loglevel error -y -i "$s" -i public/audio/bed.m4a -map 0:v -map 1:a \
      -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest "out/$N-video-$th-$ar.mp4"
  done
  ls -l out/$N-video-*.mp4
fi

python3 -I -c "import json; d=json.load(open('src/data.json')); print('status:', d['status'], '| problems:', '; '.join(d['problems']) or 'none')"
