---
name: submit-3060-recipe
description: Package a working local-model setup on an NVIDIA RTX 3060 12 GB as a recipe and submit it to the 3060 Recipes repository, or report a reproduction of an existing recipe. Covers scaffolding the folder, the minimum measurement set (decode and prefill at several depths, memory peaks, needles, a quality check), filling and validating recipe.json, writing the README, crediting the people whose work it uses, and opening the pull request with the owner's consent. Use when someone says "submit my recipe", "add this to 3060-recipes", "share my 3060 setup", "contribute a recipe", "report my numbers", or has a tuned config for a 12 GB card worth publishing.
---

# Submit a recipe to 3060 Recipes

Repo: https://github.com/davidghatley/3060-recipes. Read its `CONTRIBUTING.md` first; this skill is the
agent's version of it. The full method for making a recipe from scratch (survey, fit triage, tuning) is the
`model-recipe` skill; the tuning loop is 0xSero's `inference-optimisation` skill. This one is about packaging
and submitting.

## Pick the path

| The user has | Do |
|---|---|
| Ran an existing recipe and has numbers | **Reproduction**: open the reproduction issue form (step 7). Five minutes. |
| A working setup, no time to package | **Recipe form**: the issue form `recipe.yml` with file, build, flags, numbers. A maintainer packages it. |
| A working setup and wants it published under their name | **Full recipe**: steps 1 to 7. |

## 1. Scaffold

```sh
git clone https://github.com/<user>/3060-recipes   # their fork
cd 3060-recipes
python3 scripts/new_recipe.py community/<recipe-id>   # lowercase, hyphens: e.g. gemma-4-27b-q4
```

This writes `README.md`, `RESULTS.md`, `recipe.json`, `serve.sh` and an empty `runs/` from the template.

## 2. Pin everything

- Weights: Hugging Face repo, exact file name, revision (commit sha), size, sha256.
- Engine: repo URL and the exact tag, build number or commit; every patch or PR applied, by number.
- Hardware: GPU, VRAM, driver, CUDA version, CPU, RAM size (and speed if known), disk type. Any 12 GB RTX 3060
  qualifies; CPU and RAM vary and are shown next to the result.

## 3. Measure (the minimum set)

Run one GPU job at a time, with nothing else using the card. Cap `max_tokens` on every request.

| Measurement | Conditions |
|---|---|
| Decode tok/s, stock flags and tuned | empty context and deep in the window (for example 32k) |
| Prefill tok/s | a prompt of about 8k tokens, and one near the served window |
| Time to first token | the 8k prompt |
| VRAM peak and RAM peak | while serving the long prompt (`nvidia-smi`, `free`; count page cache for mmap'd weights) |
| Needles | 3 facts hidden at about 50% and 95% of the served window; report found/3 |
| Quality | a small code eval at temperature 0, or KLD against a higher-precision file; "not measured" if neither |

Take at least 3 samples per speed and report the median. Save raw outputs in `runs/` (JSON lines, logs,
telemetry CSV). Every number in `recipe.json` must point to a line in `RESULTS.md` that states it.

A configuration that loads is not a result. It counts once it has answered a long prompt at the full window.

## 4. Write the files

- `RESULTS.md`: hardware, model@revision, engine@commit, a results table (stock vs tuned, conditions), what was
  tried and rejected, quality, and "not measured" items.
- `README.md`: what it is, why it is hard on 12 GB, the result table, how to run it, credits.
- `serve.sh`: one default configuration; every knob overridable by an environment variable; no paths into the
  user's home directory, no machine names.
- `recipe.json`: see the schema at https://davidghatley.github.io/3060-recipes/schema/recipe.schema.json.
  `results[].source` is `path:line` relative to the repo root. Mark the two or three numbers that matter with
  `"headline": true`. Set `contributor` to the user's name and GitHub login.

## 5. Credit

List in README and `recipe.json` (`credits`, ids from `site/data/credits.json`; add new entries there) the model
authors, the quantizers whose file was used, engine and patch authors, and the method's source. Use links you have
actually opened. Credit what each one made and what it was used for, specifically.

## 6. Validate

```sh
python3 scripts/validate_recipe.py community/<recipe-id>
```

It checks the schema, that every source line exists and contains its number, credit ids, and that no private paths
or e-mail addresses are in the file. Fix every error. Then build the site locally if Python can install `markdown`
and `pyyaml`: `python3 site/build.py --check`.

Also remove from every committed file: home-directory paths, mount points, hostnames, tokens, e-mail addresses.

## 7. Submit (with consent)

Show the user the diff and the PR text first. Only after they say yes:

```sh
git checkout -b recipe/<recipe-id>
git add community/<recipe-id> site/data/credits.json
git commit -m "community: <model> on a 3060 12 GB (<decode> tok/s at <context>)"
git push -u origin recipe/<recipe-id>
gh pr create --repo davidghatley/3060-recipes --fill
```

For a reproduction, open https://github.com/davidghatley/3060-recipes/issues/new?template=reproduction.yml with the
recipe id, date, hardware, engine build and the decode/prefill numbers at stated conditions.

## What gets a recipe sent back
- A speed with no context length or prompt size.
- Numbers with no raw runs behind them.
- A quant that is faster but fails the quality check, presented as the recommendation.
- Weights or engine not pinned to a revision.
- Missing credits for the files and patches used.
