#!/usr/bin/env bash
# Re-render the Inkling-2-Mini promo from ../promo-data.json: data, video, stills, lint.
#   ./render.sh            everything (video light + dark, music mix, stills)
#   ./render.sh stills     stills only (a few seconds)
#   ./render.sh explainer  the 54 s explainer only (light + dark, music mix, review frames)
# CPU only: Chromium with SwiftShader (--gl=swangle), niced, 4 frames at a time, so a tuning run on the GPU is not disturbed.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
what=${1:-all}
R=(--public-dir=public --browser-executable=/usr/bin/chromium --gl=swangle --log=error)
REM="nice -n 19 node_modules/.bin/remotion"
LINT=$HOME/Projects/secret-sauce/tools/lint/sauce-lint.mjs

python3 -I tools/prep.py
mkdir -p out/stills out/video

if [ "$what" = explainer ]; then
  # 54 s at 1080p30; crf 20 keeps each file well under 10 MB. Its own bed (public/audio/explainer-bed.m4a, generated at
  # the video's length, see README) is trimmed to the video and faded out over the last 2 s; no looping.
  for th in Light Dark; do
    lc=$(echo $th | tr A-Z a-z)
    v="out/video/inkling-explainer-$lc-16x9.mp4"
    $REM render src/index.ts Explainer$th "$v" "${R[@]}" --concurrency=4 --codec=h264 --crf=20 --pixel-format=yuv420p
    dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
    ffmpeg -loglevel error -y -i "$v" -i public/audio/explainer-bed.m4a -map 0:v -map 1:a -t "$dur" \
      -af "afade=t=out:st=$(python3 -c "print(max(0,$dur-2))"):d=2" -c:v copy -c:a aac -b:a 160k -movflags +faststart \
      "out/video/inkling-explainer-$lc-16x9-music.mp4"
  done
  for f in 135 315 540 765 975 1170 1365 1485 1590; do
    $REM still src/index.ts ExplainerLight "out/stills/explainer-$f.png" --frame=$f "${R[@]}"
  done
  $REM still src/index.ts ExplainerDark "out/stills/explainer-dark-765.png" --frame=765 "${R[@]}"
  [ -f "$LINT" ] && { node "$LINT" out/stills/explainer-*.png --surface docs --quiet || echo "lint: see above"; }
  ls -l out/video/inkling-explainer-*
  exit 0
fi

for id in HeaderLight HeaderDark SocialLight SocialDark SquareLight SquareDark; do
  $REM still src/index.ts $id "out/stills/$id.png" "${R[@]}"
done
# README header pair, the names the <picture> snippet in README.md uses
cp out/stills/HeaderLight.png out/stills/readme-header-light.png
cp out/stills/HeaderDark.png out/stills/readme-header-dark.png

if [ "$what" = all ]; then
  for th in Light Dark; do
    lc=$(echo $th | tr A-Z a-z)
    $REM render src/index.ts Inkling$th "out/video/inkling-$lc-16x9.mp4" "${R[@]}" --concurrency=4 --codec=h264 --crf=16 --pixel-format=yuv420p
    ffmpeg -loglevel error -y -i "out/video/inkling-$lc-16x9.mp4" -i public/audio/bed.m4a -map 0:v -map 1:a \
      -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest "out/video/inkling-$lc-16x9-music.mp4"
  done
  # one frame per plate for review and lint
  for f in 210 640 900 1140 1400 1560 1740; do
    $REM still src/index.ts InklingLight "out/stills/frame-$f.png" --frame=$f "${R[@]}"
  done
fi

if [ -f "$LINT" ]; then
  node "$LINT" out/stills/Header*.png --surface docs --quiet || echo "lint: see above"
  node "$LINT" out/stills/Social*.png out/stills/Square*.png --surface social --quiet || echo "lint: see above"
  ls out/stills/frame-*.png >/dev/null 2>&1 && { node "$LINT" out/stills/frame-*.png --surface docs --quiet || echo "lint: see above"; }
fi
python3 -I -c "import json; d=json.load(open('src/data.json')); print('status:', d['status'], '| placeholders:', ', '.join(d['missing']) or 'none')"
