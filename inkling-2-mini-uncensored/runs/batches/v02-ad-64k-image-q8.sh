# v01: AtomicChat's mmproj F16 (610 MiB) does not fit next to AD-Q4_K at 64k ub 96 (cudaMalloc OOM at load).
# Try the base recipe's mmproj Q8_0 (330 MiB; same vision tower, AtomicChat's card: "the original's, unchanged") at ub 64.
MMPROJ_SMOKE=1 UNC_MMPROJ=1 INK_MMPROJ=/mnt/models/llm/inkling-2-mini/mmproj-Inkling-2-Mini-Q8_0.gguf INK_UBATCH=64 tools/run.sh v-ad-64k-ub64-mmproj-q8 smoke
MMPROJ_SMOKE=1 UNC_MMPROJ=1 INK_MMPROJ=/mnt/models/llm/inkling-2-mini/mmproj-Inkling-2-Mini-Q8_0.gguf INK_UBATCH=64 NEEDLES=62000 tools/run.sh v-ad-64k-ub64-mmproj-q8-needle needles
