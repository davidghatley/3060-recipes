# image smoke tests at 32k like the base recipe's (#41): base mmproj Q8_0 for the IQ4_NL-based variants, AtomicChat's F16 mmproj for its baked file
MMPROJ_SMOKE=1 UNC_MMPROJ=1 INK_CONTEXT=32768 VARIANT=nokeepai-merged tools/run.sh s-nokeepai-merged-32k smoke
MMPROJ_SMOKE=1 UNC_MMPROJ=1 INK_CONTEXT=32768 VARIANT=atomicchat-lora tools/run.sh s-atomicchat-lora-32k smoke
MMPROJ_SMOKE=1 UNC_MMPROJ=1 INK_CONTEXT=32768 INK_UBATCH=64 VARIANT=atomicchat tools/run.sh s-atomicchat-32k smoke
