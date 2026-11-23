# deepseek-v41-strata

Checking a claim: the [ISTA-DASLab DeepSeek-V4.1-Flash GSQ-RCO GGUF](https://huggingface.co/ISTA-DASLab/DeepSeek-V4.1-Flash-1017-GSQ-RCO-GGUF) card says "With Strata, every build runs on a single GPU with 12 GB of VRAM."
The model is a 763B MoE (384 routed experts per layer, 6 active). This recipe runs the 2.00 bpw IQ2_XXS build on the [Strata](https://github.com/Niko1221/Strata) engine and measures what "runs" means on this box.

This is a measurement report, not a tuned recipe. Numbers are in [RESULTS.md](RESULTS.md), the setup plan is in [PLAN.md](PLAN.md), and the raw data is in `runs/`.

## Result

| Single user, 8k context, Strata 0.1.54 | Faster mode (5 experts, default) | Full quality (6 experts) |
|---|---:|---:|
| Decode, chat | **4.98 tok/s** | 4.10 tok/s |
| Decode, code | 4.78 tok/s | 3.69 tok/s |
| Prefill, 4k / 8k prompt | 91 / 126 tok/s | 89 / 113 tok/s |
| Prefill, 60-token prompt | 4.3 tok/s (a short question waits 12–19 s) | 3.5 tok/s |
| VRAM | 11.3–11.8 GB | |
| RAM (cgroup peak) | 34.9 GB | 30.6 GB |
| Disk | 257 GB on the NVMe, 1.3–1.4 GB/s median reads while decoding | |

Strata's own numbers for a 3060 with 46 GB RAM are 8–11 tok/s. This box gets about half of that.

## What "runs on 12 GB" means

- **The GPU holds very little of the model.** The dense weights (5.86 GB) and about 260 of the 15,360 routed experts (2.5 GB) are in VRAM.
- **RAM holds a store of the hottest experts:** about 2,600 of them (27 GB). It is sized from free RAM at start.
- **Everything else is read from the NVMe.** The other ~100 GB of experts are read in place from the GGUFs, and the 111 GB Engram n-gram table is read a few rows per token. So a fast NVMe on the same box is part of the requirement, not an option. Measured: with the pack on a 7200 rpm hard disk instead, decode fell from 4.98 to 0.46 tok/s and a short question waited 200 s for its first token (RESULTS.md, not a controlled comparison).
- **The CPU does most of the expert maths.** 72–78% of expert evaluations ran on the CPU on short prompts.

So the claim is true: a 12 GB card is enough. But the card is not what sets the speed. RAM, the CPU and the SSD do.

## When you would actually want this

- **Offline or batch questions where quality matters more than time,** and an answer of a few hundred tokens in 1–3 minutes is fine.
- **Checking what a frontier-size MoE says** about a prompt, against a smaller local model, without renting a GPU.
- **Not for interactive coding or agents.** At ~5 tok/s, plus 12–19 s before the first token of even a short question, an opencode session is painful. [flint](../flint/) (58.8 tok/s at 128k) or [inkling-2-mini](../inkling-2-mini/) (29 tok/s) are the interactive options on this box.
- **You need ~260 GB of free NVMe and ~35 GB of free RAM.** On a slower drive (this box's `/mnt/scratch` SK hynix BC501), expect it to be slower still.

## Use it

```bash
# 1. Strata Terminal 0.1.54 (release v0.2.8). Read install.sh first; it verifies a SHA-256 and a signed feed, no sudo.
STRATA_DATA_DIR=/mnt/models/llm/strata HF_HOME=/mnt/models/llm/hf TMPDIR=/mnt/models/llm/tmp \
  strata install -- --family deepseek41 --model IST-DAS-2.00bpw --data-dir /mnt/models/llm/deepseek-v41-flash --yes --no-start
# 2. One benchmarked run (server on 127.0.0.1:8080, OpenAI-compatible), through the shared GPU queue:
GPU_RUN_MEM=44G ~/anime-pipeline/tools/gpu_run --free --need 11000 deepseek-v41-strata/run_variant.sh faster
#    Engine flags are appended after the label, e.g. `... run_variant.sh full --experts 6`
```

`GPU_RUN_MEM=44G` matters: gpu_run's 20 GB default cap counts page cache, and the experts read in place live in the page cache.

## Tools

| Script | What it does |
|---|---|
| `run_variant.sh LABEL [engine args]` | start the Strata server with one engine variant, wait for the engine, run `scripts/bench.py`, stop |
| `bottleneck.sh [a\|b]` | the CPU-vs-NVMe runs: `--cpu-threads` and `--ssd-cache` (RAM store size), one knob at a time, controls on both sides. Not run yet: needs the pack on an NVMe |
| `../scripts/bench.py` | prefill and decode tok/s from streaming timestamps, plus a 1 s sampler of VRAM, RAM, page cache, CPU busy % and reads on the model's disk |

## Credits

- [Strata](https://github.com/Niko1221/Strata) for the engine, the packer and the install plan.
- ISTA-DASLab for the GSQ-RCO quantisation and the GGUFs.
- DeepSeek for DeepSeek-V4.1-Flash.
