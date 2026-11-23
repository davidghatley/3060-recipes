# b02 and b03 as two separate gpu_run holds (release the lock between them).
cd "$(dirname "$0")/../.."
tools/gpu_batch.sh runs/batches/b02.sh > runs/batches/b02.log 2>&1
tools/gpu_batch.sh runs/batches/b03.sh > runs/batches/b03.log 2>&1
echo CHAIN-DONE >> runs/batches/b03.log
