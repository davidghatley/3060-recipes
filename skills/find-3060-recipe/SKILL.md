---
name: find-3060-recipe
description: Find, choose and reproduce a measured recipe for running a large language model on an NVIDIA RTX 3060 12 GB (or another 12 GB card), using the 3060 Recipes site. Covers checking the user's hardware, matching a recipe to the task and context length, fetching the exact pinned weights and engine build, running the serve command, checking the result against the published numbers, and reporting a reproduction. Use when someone asks "what model can I run on my 3060", "what's the best local model for 12 GB", "how do I run <model> on a 3060", "is my speed normal", or wants a local coding or long-context model on a 12 GB card.
---

# Find and reproduce a 3060 recipe

Site: https://davidghatley.github.io/3060-recipes/ (repo: https://github.com/davidghatley/3060-recipes).
Everything is static. Read the Markdown and JSON, not the HTML.

## 1. Read the index

```sh
curl -s https://davidghatley.github.io/3060-recipes/recipes.json
```

Each entry has `use_cases`, `context_tokens`, `quant`, `placement`, `decode_tok_s` (with `decode_conditions`),
`prefill_tok_s`, `serve_command`, `hardware`, and links to the full recipe as Markdown (`markdown`) and JSON (`json`).

## 2. Check the machine before recommending anything

Collect, without guessing:

| Need | How |
|---|---|
| GPU and free VRAM | `nvidia-smi --query-gpu=name,memory.total,memory.used,driver_version --format=csv` |
| System RAM | `free -g` (Linux), `systeminfo` (Windows), `sysctl hw.memsize` (macOS) |
| CPU and cores | `lscpu` or the OS equivalent |
| Disk the weights will sit on | NVMe, SATA SSD or hard disk; free space |

Then filter:
- **VRAM.** A desktop session holds about 1 GB of VRAM. Recipes that fill the card to within 0.4 GB fail
  on a machine with a heavier desktop. Read the recipe's VRAM peak.
- **RAM.** If `placement` says experts or layers sit in RAM, the whole weights file has to fit in RAM with
  room to spare (it lives in page cache). A 23 GB file on a 32 GB machine is tight; on 16 GB it will page from disk.
- **Disk.** Recipes that stream weights from disk (for example the 763B DeepSeek one) are only usable from
  NVMe. From a hard disk they are about ten times slower.

## 3. Choose

1. Match the task to `use_cases` and the context the user actually needs to `context_tokens`.
2. Prefer the recipe with the highest decode speed **at the user's context depth**, not the empty-context number.
   The Markdown recipe has speeds at several depths.
3. Tell the user the conditions: "about 47 tok/s at 32k tokens of context", not "58 tok/s".
4. If nothing fits, say so and say why (RAM too small, disk too slow). Do not stretch a recipe to a machine it
   was not measured on without saying the numbers will differ.

## 4. Reproduce

Read the full recipe first: `curl -s https://davidghatley.github.io/3060-recipes/recipes/<id>.md`.

1. `git clone https://github.com/davidghatley/3060-recipes && cd 3060-recipes/<id>`
2. **Weights:** download the exact file and revision named under Weights. Check its sha256 against the value
   Hugging Face reports (`https://huggingface.co/api/models/<repo>/tree/<revision>` gives `lfs.oid`).
   Ask the user before any download over about 10 GB, and check free disk space first.
3. **Engine:** build or fetch the exact version listed under Engine, with any listed patches. A different
   llama.cpp build can change speed by tens of percent and some recipes need a specific commit or fork.
   Read any patch or third-party launcher before running it.
4. **Run** the serve command from the recipe folder. Every knob in a `serve.sh` has an environment override;
   leave the defaults alone for the first run.
5. **Test with a long request** before reporting success. A configuration that loads can still run out of memory
   or return garbage on its first real prompt. Cap `max_tokens` on every request.

## 5. Compare and report

- Within about 10% of the published decode speed at the same context depth is a normal result on a similar CPU
  and RAM speed. Bigger gaps usually mean: a different engine build, slower RAM (expert-in-RAM recipes depend on
  RAM bandwidth), a slow disk or a symlink to one, or less free VRAM.
- Offer to report the result. With the user's consent, open
  https://github.com/davidghatley/3060-recipes/issues/new?template=reproduction.yml and fill it with: recipe id,
  date, GPU, driver, CPU, RAM size and speed, disk, engine build, decode and prefill at the conditions measured.
  Never post on the user's behalf without asking.

## Common mistakes
- Quoting an empty-context decode speed for a long-context workload.
- Recommending an experts-in-RAM recipe on a machine whose RAM cannot hold the file.
- Downloading a different quant "because it is close": the recipe's numbers belong to its file.
- Trusting a server that answered on the port without checking it is the one you started.
