#!/usr/bin/env bash
# Fetch everything this recipe uses, pinned by HF revision, and check LFS sha256s.
#   tools/download.sh            # all
# Files land in /mnt/models/llm/qwen3.5-4b-3d-coder/ (weights) and qwen35-3d-coder/runs/data/ (eval prompts).
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
D=${QC_MODELS:-/mnt/models/llm/qwen3.5-4b-3d-coder}
REV_MODEL=4b9f05f3a0382725b679c5e32a338b88acaf0064     # ccore/Qwen3.5-4B-3D-Coder (Oct 27 checkpoint, FP16 release)
REV_BASE=851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a      # Qwen/Qwen3.5-4B (MTP head source)
REV_DFLASH=9a1996ccf887b79ab3af4fcbf8c1d1f4b5658bcf    # z-lab/Qwen3.5-4B-DFlash
REV_DATA=57b77a19d38eee8316c8b1f9e71c772046d9f48c      # datasets/ccore/ThreeJS-3D-Scenes

get() { # url dest [sha256]
  local url=$1 dest=$2 sha=${3:-}
  mkdir -p "$(dirname "$dest")"
  if [[ -s $dest && -n $sha ]] && echo "$sha  $dest" | sha256sum -c --status; then echo "ok   $dest"; return; fi
  curl -fL --retry 5 --retry-delay 5 -C - -o "$dest.part" "$url"
  [[ -z $sha ]] || echo "$sha  $dest.part" | sha256sum -c --status || { echo "SHA MISMATCH $dest" >&2; exit 1; }
  mv "$dest.part" "$dest"; echo "got  $dest"
}
HF=https://huggingface.co

# 1. Official GGUFs (controls)
get $HF/ccore/Qwen3.5-4B-3D-Coder/resolve/$REV_MODEL/Qwen3.5-4B-3D-Coder-Q8_0.gguf   $D/Qwen3.5-4B-3D-Coder-Q8_0.gguf   c30b02629456aa2bc32e522de0f58eb1aafd8518a7634128fed67d1486fc2a9a
get $HF/ccore/Qwen3.5-4B-3D-Coder/resolve/$REV_MODEL/Qwen3.5-4B-3D-Coder-Q4_K_M.gguf $D/Qwen3.5-4B-3D-Coder-Q4_K_M.gguf 32c37c83d3ca055d30aefa679f1a1670d3e2eb889ee7cc805792d53f219cfae8

# 2. Official FP16 safetensors (source for our own quants)
H=$D/hf-fp16
get $HF/ccore/Qwen3.5-4B-3D-Coder/resolve/$REV_MODEL/model-00001-of-00004.safetensors $H/model-00001-of-00004.safetensors ce6fa579c9933caebbe2e51e5a28d787b0c43fc32e7991b4f6a0ab972c7215f5
get $HF/ccore/Qwen3.5-4B-3D-Coder/resolve/$REV_MODEL/model-00002-of-00004.safetensors $H/model-00002-of-00004.safetensors 7476f2d4f661c9e8105ffb3b527904cd26deb4b1450c5a7d62b4050498ab9318
get $HF/ccore/Qwen3.5-4B-3D-Coder/resolve/$REV_MODEL/model-00003-of-00004.safetensors $H/model-00003-of-00004.safetensors 64784f1f9eec6a370b13c68f9631fc0d64a93cc7c2a4befb015afafdfabd4cd1
get $HF/ccore/Qwen3.5-4B-3D-Coder/resolve/$REV_MODEL/model-00004-of-00004.safetensors $H/model-00004-of-00004.safetensors 163fae81284c3a2bd539458426c68075f77d8c341ab549f5bd02a22acb2e18ed
for f in model.safetensors.index.json config.json generation_config.json tokenizer.json tokenizer_config.json chat_template.jinja preprocessor_config.json video_preprocessor_config.json; do
  get $HF/ccore/Qwen3.5-4B-3D-Coder/resolve/$REV_MODEL/$f $H/$f
done

# 3. Base model's MTP head (15 tensors, ~240 MB) by HTTP range requests
[[ -s $D/base-mtp/mtp.safetensors ]] || python3 -I "$ROOT/tools/fetch_mtp.py" "$HF/Qwen/Qwen3.5-4B/resolve/$REV_BASE" "$D/base-mtp/mtp.safetensors"

# 4. DFlash drafter (z-lab, trained on base Qwen3.5-4B)
F=$D/dflash-hf
get $HF/z-lab/Qwen3.5-4B-DFlash/resolve/$REV_DFLASH/model.safetensors $F/model.safetensors 1eb221d36abb13a5f1b972f8d031a9723fad8cbb7d275abe548b60e77577eb42
get $HF/z-lab/Qwen3.5-4B-DFlash/resolve/$REV_DFLASH/config.json $F/config.json

# 5. Eval prompts: validation split
get $HF/datasets/ccore/ThreeJS-3D-Scenes/resolve/$REV_DATA/data/validation-00000.parquet "$ROOT/runs/data/validation-00000.parquet" ac6429626f1eb72c9e8cd62d2a9c7118a5feb7f8c49e2689600c479086192f62

# 6. Small draft model candidate (same 248k vocab), ggml-org's official GGUF
REV_08B=004fd086eccea9f7cf867aa07ba328773beef81d
get $HF/ggml-org/Qwen3.5-0.8B-GGUF/resolve/$REV_08B/Qwen3.5-0.8B-Q8_0.gguf $D/draft/Qwen3.5-0.8B-Q8_0.gguf 37ae482d336108d23516fa35e8e0c4126688d81018b87178a18d752a1357814f

# 7. Base model (control for the DFlash drafter, which was trained on it), ggml-org's GGUF
REV_BASE_GGUF=8d43d974efc48399cb58957ad49c8b26bf5a109c
get $HF/ggml-org/Qwen3.5-4B-GGUF/resolve/$REV_BASE_GGUF/Qwen3.5-4B-Q4_K_M.gguf $D/base-ref/Qwen3.5-4B-Q4_K_M.gguf 217002fa8008ef4fc6d548353a3aebef055a96e6ff8e0e2c0953ef8254a89c14
