cd "$(dirname "$0")/../.."
tools/gpu_batch.sh runs/batches/b07.sh > runs/batches/b07.log 2>&1
tools/gpu_batch.sh runs/batches/b08.sh > runs/batches/b08.log 2>&1
echo CHAIN-DONE >> runs/batches/b08.log
