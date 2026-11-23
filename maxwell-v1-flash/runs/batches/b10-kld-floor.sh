# the engine's own floor: the same base file, no LoRA, every expert on the CPU (KLD_NCMOE=45) against the ncmoe-33 reference.
# Only the order of floating-point work changes, so whatever KLD this shows is rounding, not an edit.
KLD_NCMOE=45 tools/kld.sh cmp k02-base-placement-floor
