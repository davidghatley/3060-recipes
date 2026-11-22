#!/usr/bin/env bash
# Kintsugi-27B (Qwen3.8-27B, EXL3 trellis 2.47 bpw GGUF) on the author's llama.cpp fork bundle v1.1.1.
# Clients: http://127.0.0.1:8080/v1 (OpenAI), /v1/messages (Anthropic). Engine on 127.0.0.1:18080 behind the layer.
# The bundle's start-server.sh detaches the engine and returns, which would drop the shared GPU lock. This wrapper holds
# the lock (via gpu_run) until the engine exits. Stop with ./stop.sh (or Ctrl-C here), then the lock is released.
#   ./serve.sh                   foreground, holds the GPU lock while serving
#   ./serve.sh --dry-run         print the engine command line only
# Settings: any KINTSUGI_* variable from the bundle's start-server.sh (KINTSUGI_DRAFT=off, KINTSUGI_CTX=65536, ...).
set -euo pipefail
W=/mnt/models/llm/kintsugi-27b
B=${KINTSUGI_BUNDLE:-$W/bundle/Kintsugi-27B}
export KINTSUGI_MODEL=${KINTSUGI_MODEL:-$W/Kintsugi-27B-12G.gguf}
export KINTSUGI_DRAFTER=${KINTSUGI_DRAFTER:-$W/dflash-Qwen3.8-27B-Q4_0.gguf}
export KINTSUGI_SLOT_SAVE_PATH=${KINTSUGI_SLOT_SAVE_PATH:-$W/slots}
export KINTSUGI_HOST=127.0.0.1
if [ "${1:-}" = --dry-run ]; then exec "$B/start-server.sh" --dry-run; fi
# The tiered K/V cache keeps ~90k tokens (with the drafter) in VRAM and the rest of the 262k window in RAM.
# memcap counts page cache, so 20G would bind on long chats (3060-recipes AGENTS.md traps).
export GPU_RUN_MEM=${GPU_RUN_MEM:-40G}
exec "$HOME/anime-pipeline/tools/gpu_run" --free --need 11000 --wait "${KINTSUGI_GPU_WAIT:-600}" bash -c '
  B="$1"
  trap "\"$B/stop.sh\"" INT TERM
  "$B/start-server.sh" --wait || { "$B/stop.sh"; exit 1; }
  SP=$(cat "$B/logs/server-8080.pid")
  echo "serving; ./stop.sh (or Ctrl-C) to stop and free the GPU"
  while kill -0 "$SP" 2>/dev/null; do sleep 5 & wait $!; done
  echo "engine exited"' _ "$B"
