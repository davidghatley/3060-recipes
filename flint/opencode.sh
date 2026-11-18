#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
export OPENCODE_CONFIG="$ROOT/opencode.json"
if [[ ${1:-} == run ]]; then
  shift
  exec opencode --standalone run --model flint-local/flint-local "$@"
fi
exec opencode --standalone "$@"
