# Contributing

Anyone with a 12 GB RTX 3060 can contribute. Your CPU, RAM and disk do not have to match the reference bench;
they are recorded next to your numbers, and that spread is what makes the recipes useful to other people.

## Three ways in

| You have | Do | Time |
|---|---|---|
| Ran an existing recipe | [Report a reproduction](https://github.com/davidghatley/3060-recipes/issues/new?template=reproduction.yml). Your numbers appear on the recipe page. | minutes |
| A setup that works, no time to package it | [Send it through the recipe form](https://github.com/davidghatley/3060-recipes/issues/new?template=recipe.yml): file, engine build, flags, numbers. | under an hour |
| A setup you want published under your name | A pull request with a folder in `community/` (below). | an evening |

Your agent can do the third one for you with the [`submit-3060-recipe`](skills/submit-3060-recipe/SKILL.md) skill,
and the first with [`find-3060-recipe`](skills/find-3060-recipe/SKILL.md).

## A full recipe

```sh
python3 scripts/new_recipe.py community/<recipe-id>     # writes README.md, RESULTS.md, recipe.json, serve.sh, runs/
# measure, fill the files
python3 scripts/validate_recipe.py community/<recipe-id>
```

### What to pin

- **Weights:** Hugging Face repo, exact file, revision, size and sha256.
- **Engine:** repo and exact tag, build or commit, plus every patch or PR applied.
- **Hardware:** GPU, driver, CUDA, CPU, RAM size, disk type.

### What to measure

| Measurement | Conditions |
|---|---|
| Decode tok/s, stock and tuned | empty context, and deep in the window (for example 32k) |
| Prefill tok/s | about 8k tokens, and near the served window |
| Time to first token | the 8k prompt |
| VRAM and RAM peaks | while serving the long prompt; include page cache when weights are memory-mapped |
| Needles | 3 facts at about 50% and 95% of the window |
| Quality | a small code eval at temperature 0, or KLD against a higher-precision file, or "not measured" |

Report medians of at least three samples. Keep raw outputs in `runs/`. Every number in `recipe.json` cites the
line in `RESULTS.md` that states it (`"source": "community/<id>/RESULTS.md:24"`); the validator checks this.

[`scripts/bench.py`](scripts/bench.py) measures prefill and decode against any OpenAI-compatible server, and
[`scripts/codeeval.py`](scripts/codeeval.py) runs the 8-task code check used by the reference recipes.

### What gets a recipe sent back

- A speed without the context length or prompt size it was measured at.
- Numbers with no raw runs behind them.
- A faster quant that fails the quality check, presented as the recommendation.
- Weights or engine not pinned.
- Missing credits for the models, files and patches used.
- Home-directory paths, hostnames, tokens or e-mail addresses in committed files.

## Credit

Your name and GitHub login go in `recipe.json` (`contributor`) and appear on the recipe page and in the
recipe table. Credit everyone whose work the recipe uses in its README and in `credits` (ids from
[`site/data/credits.json`](site/data/credits.json); add new people there in the same PR).

## Findings

If a run teaches something the next person should not have to learn again, add a file to `findings/` with the
frontmatter the others use. Say plainly what is yours and what came from someone else (`provenance`).

## Licence

By contributing you agree that text and results you add are licensed CC BY 4.0
([LICENSE-CONTENT](LICENSE-CONTENT)) and code is MIT ([LICENSE](LICENSE)).

## Corrections

A wrong number, a broken link or a missing credit is a bug. [Open a correction](https://github.com/davidghatley/3060-recipes/issues/new?template=correction.yml).
