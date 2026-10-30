# Plan

Goal: a collection of measured, reproducible recipes for running big models on the 3060.

## Recipes
- [ ] deepseek-v41-strata: check the "runs on a 12 GB GPU" claim and measure tok/s (see deepseek-v41-strata/PLAN.md)

## Decisions
- 2026-10-29: Weights go in /mnt/models/llm (Micron NVMe, 359 GB free). / is 97% full.
- 2026-10-29: Use the IQ2_XXS (2.00 bpw) build only. It's ISTA's recommended build and the one Strata measured on a 3060.
