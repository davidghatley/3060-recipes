# quality gates with AtomicChat's uncensored rank-1 LoRA at runtime (scale 1), same split, thinking off
VARIANT=uncensored MX_NCMOE=33 MX_THINK=0 tools/run.sh q02-uncensored quality || echo "q02-uncensored FAILED"
