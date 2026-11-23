# Brief template for one-agent-per-recipe batches

Keep the common part in one file in the repo; each agent's prompt then holds only what is unique to it.

## Common brief (one file, every agent reads it first)
- **Machine**: GPU and VRAM (and how much the desktop holds), RAM, CPU cores, which drive holds weights, measured bandwidths.
- **Method**: follow the tuning skill end to end; read the GPU-sharing rules before the first GPU job.
- **Hard rules**: GPU only through the shared queue; never signal a process you did not start; never delete;
  no privileged commands; no downloads beyond the manifest (state a size above which the agent must stop and report);
  weights outside the repo; isolated-mode Python for downloaded files; cap `max_tokens`; work only in your folder;
  no commits, no edits to shared files (report bugs in shared scripts instead).
- **Shared tools**: server helper, bench client, code eval, refusal probe, engine builds and how to run them.
- **Prior art**: which recipes to read, and "do not rerun what they rejected without a new reason".
- **Deliverables**: the folder template and the measurement set.
- **Style**: every number traces to a run file; say what was not measured; credit the stack.
- **Final report** (word limit): best config and launch line; baseline/tuned/ceiling table; quality gates;
  what failed or is unverified; files created outside the repo; credits with links seen; decisions needed.

## Per-agent prompt
- Recipe folder name and port.
- The model(s): repo, file paths on disk, sizes, what the card says about samplers/templates/engine version.
- The engine build to use, and sibling recipes to read.
- "Things to test rather than assume": the open questions for this model, each phrased so a measurement answers it.
- Stretch items, time-boxed, with an explicit "stop and report if this needs a download over N GB".
- Credits to collect.
