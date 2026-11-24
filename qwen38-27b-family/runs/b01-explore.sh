# Batch 1: what --fit picks, and the stock baseline. Run via tools/gpu_batch.sh.
set -u
cd "$(dirname "$0")/.."
B=/mnt/scratch/llama.cpp/master-225a5345b/bin; export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
M=$(readlink -f /mnt/models/llm/qwen38-27b-family/pi-adapted/Qwen3.8-27B-pi-IQ3_XXS.gguf); echo "model $M"
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
for kv in f16 q8_0; do for c in 32768 131072; do
  echo "== fit-params ctk=$kv c=$c"; $B/llama-fit-params -m "$M" -c $c -fa on -ctk $kv -ctv $kv 2>&1 | grep -viE '^llama_model_loader|print_info|load_tensors: *(CPU|CUDA)_Mapped|^\s*$' | tail -25
done; done > runs/b01-fitparams.txt 2>&1
# Stock baseline: what a user types (fit on, f16 KV, ub 512), 32k window.
tools/srv.sh b01-baseline-stock Q38_NGL=auto Q38_FIT=on Q38_KV=f16 -- \
  python3 -I tools/srvtest.py --label b01-baseline-stock --pp 8000 --depths 0 --reps 6 --max 256
