#!/usr/bin/env bash
# Build our GGUFs from the pinned downloads (CPU only; GPU hidden). Run tools/download.sh first.
#  1. official FP16 safetensors + the base model's 15 MTP tensors -> F16 GGUF with the MTP head (blk.32.nextn.*)
#  2. llama-quantize -> Q8_0, Q6_K, Q5_K_M, Q4_K_M (no imatrix, same recipe as the official files)
#  3. z-lab DFlash drafter -> F16 and Q8_0 GGUF (tokenizer from the target)
# Converter env: a private uv venv (torch 2.11.0+cpu, transformers 5.20.2: 4.57 lacks Qwen3_5Tokenizer).
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
D=${QC_MODELS:-/mnt/models/llm/qwen3.5-4b-3d-coder}
PY=${QC_CONVERT_PY:-/mnt/scratch/envs/llama-convert-b12242/bin/python}
BIN=${QC_BIN:-/mnt/scratch/llama.cpp/b12242/bin/llama-b12242}
export LD_LIBRARY_PATH="$BIN:/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64"
export CUDA_VISIBLE_DEVICES=""
if [[ ! -x $PY ]]; then
  UV_CACHE_DIR=/mnt/scratch/uv uv venv -p 3.12 "$(dirname "$(dirname "$PY")")"
  UV_CACHE_DIR=/mnt/scratch/uv uv pip install -p "$PY" --extra-index-url https://download.pytorch.org/whl/cpu \
    --index-strategy unsafe-best-match "torch==2.11.0+cpu" "numpy~=2.2.6" "sentencepiece>=0.1.98,<0.3.0" \
    "transformers==5.20.2" "protobuf>=4.21.0,<5.0.0" safetensors pyarrow pillow
fi
mkdir -p "$D/own"
python3 -I "$ROOT/tools/make_src.py" "$D/hf-fp16" "$D/base-mtp/mtp.safetensors" "$D/hf-fp16-mtp"
F16=$D/own/Qwen3.5-4B-3D-Coder-MTP-F16.gguf
[[ -s $F16 ]] || "$PY" -I "$ROOT/tools/convert.py" "$D/hf-fp16-mtp" --outtype f16 --outfile "$F16"
for q in Q8_0 Q6_K Q5_K_M Q4_K_M; do
  out=$D/own/Qwen3.5-4B-3D-Coder-MTP-$q.gguf
  [[ -s $out ]] || "$BIN/llama-quantize" "$F16" "$out" $q 6
done
DF=$D/own/Qwen3.5-4B-DFlash-F16.gguf
[[ -s $DF ]] || "$PY" -I "$ROOT/tools/convert.py" "$D/dflash-hf" --target-model-dir "$D/hf-fp16" --outtype f16 --outfile "$DF"
[[ -s $D/own/Qwen3.5-4B-DFlash-Q8_0.gguf ]] || "$BIN/llama-quantize" "$DF" "$D/own/Qwen3.5-4B-DFlash-Q8_0.gguf" Q8_0 6
# Check: trunk tensors of our Q8_0 must be byte-identical to the official Q8_0 (F32 norms differ ~3e-5).
python3 -I "$ROOT/tools/cmp_gguf.py" "$D/Qwen3.5-4B-3D-Coder-Q8_0.gguf" "$D/own/Qwen3.5-4B-3D-Coder-MTP-Q8_0.gguf" | head -3
