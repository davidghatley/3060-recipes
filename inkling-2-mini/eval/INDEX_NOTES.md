# What the Jev Decision Index measures

Read 2026-11-21 from local clones, not from memory:
- Space `multimodalart/jev-decision-index` @ `4ee57a16` (2026-11-19): `data/index.json` (326 entries), `README.md`, `methodology.html`.
- Kit `apolinario/decision-index` @ `25c6ec7b` (MIT): `README.md`, `docs/{suite,engines,format}.md`, `decision_index/scoring/*`.
- Every published number we cite is extracted by `eval/tools/published.py` into `eval/published.json`.

## The suite

**Public index (what we can run): 37 benchmarks in 5 areas, edition 0.3.** The board is 0.4, which uses the same public suite.

| Area | Weight | Benchmarks (catalog id) |
|---|---:|---|
| Knowledge & Reasoning | 25.8% | GPQA Diamond 25★, GSM8K 30, ChessBench 31, MuSR 32, SATA-Bench 33, CRUXEval 43, CLadder 44, HLE 45★, MMLU-Pro 57★, BBH 58★, WinoGrande 28★ |
| Language Understanding | 25.8% | ContractNLI 11, ANLI 12★, HellaSwag 29★, ACOS 38, FinEntity 39, iSarcasmEval 40, VAST 41, NLI4CT 42, RAGTruth 59 |
| Retrieval & Classification | 20.0% | BANKING77 4★, CLINC150+OOS 5★, BRIGHT 36★, Amazon ESCI 37, PhishNChips 56, HoVer 61 |
| Tools & Automation | 18.3% | BFCL 1★, ToolRet 2, API-Bank 3★, Home appliances 9, When2Call 62 |
| Arts & Human Taste | 10% | BPoMP 20, Humicroedit 21, POP909 22, cfcolor 23, Habermas Machine 50, New Yorker 64 |

★ gold, weight 1.2 inside its area. Shown but not counted: MMLU, ARC-Easy, ARC-Challenge, SimpleBench, RouterBench, SGD. Six interactive environments are not run. ForecastBench is retired in 0.3.

Size: 109,759 scoreable base requests + 30,419 for the 0.2 additions = 140,178 requests.

**The public rows are not redistributed.** The kit rebuilds them from pinned upstream sources (`suite rebuild`, about 7 GB of downloads) and checks sha256 against the lab's files. Licences vary: ANLI is CC BY-NC, RAGTruth contexts can't be republished, GPQA asks that its questions not be posted, BBH carries the BIG-bench canary, and HLE is gated. So the rebuilt suite lives outside this repo (`/mnt/work/jev-index/`) and is **never used for training**.

**Private tests (which we cannot run):**
- **Full score** (0.4, the main ranking) = 60% private same-skill tests + 40% private new-domain decision tasks.
- Each private part is mapped to the public scale using untuned stock models as the yardstick.
- The public index no longer counts toward Full. It is shown next to it and used to validate submissions.
- The maintainers run the private sets themselves on submitted models. They never publish them, and they drop a private test from a model's score if they find training overlap.
- Ties: Full scores within 0.9 points share a rank.

## Metrics

Per benchmark (kit `scoring/metrics.py`, `index02.py`):
- **Native metric**: accuracy (exact match), macro-F1, conservative macro-F1 (missing predictions count as misses), nDCG@10 (ToolRet, BRIGHT), case-exact accuracy (BFCL, SATA, Home appliances), per-review F1 (ACOS), F1 on the hallucinated class (RAGTruth). Noul (yes/no) counts as yes at p ≥ 0.5.
- **Coverage**: `raw = native × answered / requests`. Unsupported, error and abstained rows count as wrong. Linked cases (retrieval chunks, ACOS reviews) count only if every linked request succeeded.
- **Chance correction**: `skill = clip((raw − chance) / (1 − chance), 0, 1)`. Chance levels come from `data/index-0.3.json` and `chance-baselines.json`.
- **Index** = 100 × Σ area weight × area skill, where area skill is the gold-weighted mean of its benchmarks' skills. A `raw_index` is reported too.

**Calibration** (board, `index.json` per entrant: `acc, conf, ece, brier, over95, n, rel`):
- The note: *"32 benchmarks with a per-field right or wrong answer (ToolRet, BRIGHT and RouterBench excluded), each weighted equally; a 1-in-6 sample of requests; confidence is the probability placed on the chosen option."*
- `rel` lists 10 equal-width bins (lo = 0.0 … 0.9). ECE is Σ w_b |acc_b − conf_b|, and recomputing it from Jev's published bins gives Jev's published ECE (0.0799).
- Brier is published, but its code is not in the kit. Values (Decider 2B: acc 0.586, Brier 0.520; Kev 4B: 0.625, 0.485) match the multi-class sum of squared errors, not the top-label binary Brier. We use the multi-class form and mark it as our reading.
- `over95` is, from the Space's own text, "the share of answers given with at least 95% confidence that were wrong". The control matches the joint reading, P(conf ≥ 0.95 and wrong): 0.012 vs the board's 0.0097. The conditional reading, P(wrong | conf ≥ 0.95), gives 0.16.
- **Which 32 benchmarks?** Not stated. Our 0.3 sample has 34 calibration benchmarks: 37, minus ToolRet, BRIGHT and the missing HLE.
  - Decider 2B's base results date from the 0.1 board, before the 0.2 additions (56–64).
  - 27 base benchmarks + HLE + the four shown-but-not-counted sets (MMLU, ARC-E, ARC-C, SimpleBench) make exactly 32. That's our best reading, not a confirmed one.
  - On the 27 base benchmarks, the control gives acc 0.577 / conf 0.659 / ECE 0.085 (bootstrap 95% 0.068–0.109) / Brier 0.525 / over95 0.012, against the board's 0.586 / 0.663 / 0.077 / 0.520 / 0.0097.
  - On all 34, ECE rises to 0.110. Most of the rise is one benchmark: PhishNChips, where Decider answers at 0.985 confidence with 0.45 accuracy.
  - So `REPORT.md` gives calibration on both sets: "base 27" (comparable to the board) and "all 34".
- The calibration code itself is not in the kit, so our ECE/Brier follow the note and bins above (`eval/tools/metrics.py`). They are checked on the control as above.

**Latency**:
- Maintainers measure single-process, one request at a time, on one RTX PRO 6000, with the fastest path the model's code supports, on a private sample.
- Models with median, mean or p80 > 1,000 ms per request are not added to the board ("no longer Jev-like").
- The latency in a submitter's `scores.json` is only a guide.

**"Modal agreement" is not a board metric.** The closest things the board has:
- per-benchmark scores shown next to Jev's (`results[*].jev`);
- "decision agreement": the maintainers' rerun vs. the submitted rows on a held-out sample, with a 98.5% bar.

There are no published per-row answers, so we define modal agreement as **top-1 agreement with the control model's answers on the same rows**, and say so wherever it appears.

## Request/response contract (`POST /v1/systemone`)

Request (kit `engines/http.py`, `docs/format.md`):
```json
{"model": "...", "state": "<string or JSON object>",
 "questions": {"q1": {"type": "choice", "instructions": "<string or object>", "criteria": {"option_key": "description", "...": "..."}},
               "q2": {"type": "noul", "instructions": "..."}}}
```
- 2–255 options per `choice`.
- `noul` asks for the probability of yes.
- Extra fields are allowed; a bearer token comes from `DECISION_INDEX_API_KEY`.

Response:
```json
{"model": "...", "answers": {"q1": {"type": "choice", "choice": "option_key", "probabilities": {"option_key": 0.8, "...": 0.2}},
                             "q2": {"type": "noul", "noul": 0.37}},
 "usage": {"input_tokens": 123}}
```
Validation (`engines/base.validate`):
- every question is answered;
- every option has a finite probability in [0, 1];
- the probabilities sum to 1 within 0.01;
- the choice is a valid key.

Errors:
- HTTP 400/413/422 with a capacity marker ("maximum context length", "options per choice", …) means `unsupported`;
- any other non-2xx is an `error`, and errors are retried on resume.

Rules in the kit: no truncation (refuse instead), no option filtering, no per-benchmark prompt tuning.

## Submitting

1. Run the full public 0.3 suite with the kit (`pipeline` or `hf-job`).
2. Upload the run dir to a Hub dataset.
3. Open a PR adding a line to `submissions/README.md` with the model, the weights repo, the results link (`scores.json` with `"complete": true`), the engine/commit, the hardware and the exact settings.
4. The maintainers rescore the results, run the private parts themselves, and measure latency.

**We do not submit; David does.**

## What we can and cannot reproduce here

| | Status |
|---|---|
| Public suite rows | Rebuilt locally from the pinned sources, except **HLE (45)**, which is gated and needs the terms accepted plus an HF token. No token is set on this machine, so HLE is skipped and its index weight is reported as a gap. |
| Public index on the full 140k requests | Not run: at Inkling's measured 0.3–2 s per question it would take days. We run the kit's own stratified sampler (`suite sample`) and score it with the kit's scorer restricted to the sample, with bootstrap intervals over case groups (`eval/tools/score_sample.py`). |
| Scoring, chance levels, weights, index | The kit's code, unchanged. |
| Calibration (ECE, Brier) | Reimplemented from the board's stated definition, because the code isn't published. |
| Latency | Our numbers are on a 3060 + RAM experts. The board's rule is measured on an RTX PRO 6000 by the maintainers, so they're not comparable; reported for scale only. |
| Private same-skill and new-domain tests, Full score | **Cannot be run.** Never published. |
| Control model's board run | Decider 2B: weights pinned by size to tag `v10` (`model.safetensors` 3,763,692,048 B = the board's `trained_bytes`), served with the author's `decider.serve` at `f01b58d` (2026-09-21). The board ran FP8 on Hopper; the 3060 has no FP8 `_scaled_mm`, so we run bf16. The board's GSM8K rows (0.3 rebuild, 2026-10-06) may have been run on a later checkpoint. |
