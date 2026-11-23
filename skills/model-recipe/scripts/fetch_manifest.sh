#!/usr/bin/env bash
# Fetch pinned files from Hugging Face with curl: resumable, sha256-checked, waits for free space.
#   fetch_manifest.sh <manifest.tsv>
# Manifest lines (tab-separated, # comments allowed):  repo  revision  path-in-repo  destination-file  sha256
# The sha256 is the file's `lfs.oid` from /api/models/<repo>/tree/main; leave it empty for small non-LFS files.
# Anonymous requests only. For gated repos set HF_TOKEN in the environment (never write it into the manifest).
set -euo pipefail
man=${1:?manifest.tsv}
UA='curl (generic)'
AUTH=(); [ -n "${HF_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $HF_TOKEN")
HEADROOM=${HEADROOM_BYTES:-6000000000}
grep -v '^\s*#' "$man" | grep -v '^\s*$' | while IFS=$'\t' read -r repo rev path dest sha; do
  mkdir -p "$(dirname "$dest")"
  if [ -s "$dest" ] && [ ! -e "$dest.part" ]; then echo "HAVE $dest"; continue; fi
  url="https://huggingface.co/$repo/resolve/$rev/$path"
  size=$(curl -sIL -A "$UA" "${AUTH[@]}" "$url" | tr -d '\r' | awk 'tolower($1)=="content-length:"{s=$2} END{print s+0}')
  while :; do
    free=$(df --output=avail -B1 "$(dirname "$dest")" | tail -1)
    have=$(stat -c %s "$dest.part" 2>/dev/null || echo 0)
    [ "$free" -gt $(( size - have + HEADROOM )) ] && break
    echo "WAIT space for $dest (free $(( free/1000000000 )) GB) $(date +%T)"; sleep 120
  done
  echo "GET $repo@${rev:0:9} $path ($(( size/1000000 )) MB) $(date +%T)"
  curl -fL --retry 8 --retry-delay 10 -C - -A "$UA" "${AUTH[@]}" -sS -o "$dest.part" "$url"
  got=$(sha256sum "$dest.part" | cut -d' ' -f1)
  if [ -n "$sha" ] && [ "$got" != "$sha" ]; then echo "SHA MISMATCH $dest: got $got want $sha (left as .part)"; continue; fi
  mv "$dest.part" "$dest"; echo "OK $dest sha256=$got $(date +%T)"
done
echo "MANIFEST DONE $man $(date +%T)"
