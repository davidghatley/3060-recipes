#!/usr/bin/env bash
# Stop Kintsugi-27B (engine + layer); serve.sh then exits and releases the GPU lock.
exec "${KINTSUGI_BUNDLE:-/mnt/models/llm/kintsugi-27b/bundle/Kintsugi-27B}/stop.sh"
