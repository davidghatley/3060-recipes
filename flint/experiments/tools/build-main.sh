#!/usr/bin/env bash
# Build mainline llama.cpp (3b4d6ab3f clone in /mnt/scratch/src/llama.cpp-flint) with the conda CUDA 12.9 / GCC 14 env.
set -euo pipefail
E=/mnt/scratch/envs/ik-cuda; export PATH=$E/bin:$PATH
cd ${SRC:-/mnt/scratch/src/llama.cpp-flint}
B=${BUILD:-build}
cmake -B $B -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo -DGGML_NATIVE=ON -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=86 \
  -DCMAKE_C_COMPILER=$E/bin/x86_64-conda-linux-gnu-gcc -DCMAKE_CXX_COMPILER=$E/bin/x86_64-conda-linux-gnu-g++ \
  -DCMAKE_CUDA_COMPILER=$E/bin/nvcc -DCMAKE_CUDA_HOST_COMPILER=$E/bin/x86_64-conda-linux-gnu-g++ -DCUDAToolkit_ROOT=$E \
  -DLLAMA_CURL=OFF -DLLAMA_OPENSSL=OFF -DCMAKE_EXE_LINKER_FLAGS="-Wl,-rpath-link,$E/lib -Wl,-rpath,$E/lib" -DCMAKE_SHARED_LINKER_FLAGS="-Wl,-rpath,$E/lib"
nice -n 15 cmake --build $B -j ${JOBS:-6} --target llama-bench llama-cli llama-server llama-perplexity llama-quantize llama-imatrix llama-eval-callback
