# sensenova-loop-9b

Serving [sensenova/SenseNova-Loop-9B](https://huggingface.co/sensenova/SenseNova-Loop-9B) on the RTX 3060 12 GB with
llama.cpp and PR [#32588](https://github.com/ggml-org/llama.cpp/pull/32588). It is a looped dense hybrid: 32 physical
layers, of which layers 4–27 run twice with the same weights (56 layer passes per token), Gated DeltaNet and full
attention at 3 : 1, two-stream mHC routing inside the loop, and a native 512k window. The weights are SenseNova's own
Q5_K_M GGUF (6.66 GB, with an MTP head) and, for the uncensored variant, satellitedown's abliterated Q6_K (7.37 GB, no
MTP head). Image input uses SenseNova's F16 projector.

Everything fits in VRAM, so this recipe is about three things:
- **the MTP head.** The loop reads its 3.7 GB block twice per token, so plain decode is bandwidth-heavy (36 tok/s
  ceiling) and speculation is the one big lever: +30% thinking off, +38% thinking on;
- **the window.** The PR shares each full-attention cache across the two loop visits, so K/V is small (17 KiB per
  token at q8_0). 128k fits next to the MTP draft context; 256k fits without it; 384k and 512k do not, because the
  flash-attention compute buffer will not allocate;
- **the uncensored file.** It has no MTP head, so its tuned profile runs at stock speed and only buys the window.

Numbers and quality are in [RESULTS.md](RESULTS.md). The experiment log and gate checklist are in [PLAN.md](PLAN.md),
the ceilings are in [THEORY.md](THEORY.md), and the raw data is in `runs/`.

## Result

| Single user | Stock (card flags) | **This recipe (`default`)** |
|---|---:|---:|
| Window | 129,280 (fit, f16 K/V) | **131,072 (q8_0 K/V)** |
| Decode, thinking off | 24.4 tok/s | **31.7 tok/s (+30%)** |
| Decode, thinking on | 24.3 tok/s (controls) | **33.5 tok/s (+38%)** |
| Decode at 120k context | not measured | 15.8 tok/s |
| Prefill 8k / 32k / 120k | 857 / – / – tok/s | 829 / 759 / 571 tok/s |
| Needles at 66k / 124k | not run | 3/3 / 3/3 |
| Card (incl. ~1 GB desktop) | 11.1 GB | 10.6 GB |

- Decode medians of 6 coding answers at temperature 1.0 (b03), between three controls at 24.27–24.41.
- MTP accepts 70–74% of its 2-token drafts on coding answers. Its speed follows acceptance: one thinking answer ran
  at 20.7 tok/s, and a prose prompt with 39% acceptance ran at 22.6, below plain decode. Greedy output differs from
  plain decoding (3/8 prompts identical thinking off, 0/8 thinking on), with equally coherent wording.
- Plain decode runs at 68% of the bandwidth ceiling with CUDA graphs on; the rest is ~56 layer passes of small ops.

## Which config

| `SNL_PROFILE=` | `VARIANT=` | Window, K/V | Speculation | Decode empty / deep | Prefill 8k / deep | Needles ~50% / ~95% | Card | Use |
|---|---|---|---|---:|---:|---|---:|---|
| **`default`** | `default` | 128k, q8_0 | MTP n=2 | 31.7 (33.5 thinking on) / 15.8 at 120k | 829 / 571 at 120k | 3/3 / 3/3 | 10.6 GB | chat, coding, agents |
| **`default`** | `uncensored` | 128k, q8_0 | none (no MTP head) | 22.2 / 13.9 at 120k | 820 / 587 at 120k | 3/3 / 3/3 | 10.4 GB | the abliterated model |
| `long` | `default` | 256k, q4_0 | none | 24.3 / 10.2 at 242k | 850 / 455 at 241k | 3/3 / 3/3 (130k / 248k) | 10.5 GB | whole-repo or whole-book prompts |
| `long` | `uncensored` | 256k, q4_0 | none | 22.1 / not measured | 820 at 3k | 3/3 at 130k / not run | 11.2 GB | same, abliterated; ~95% unverified |
| `stock` | either | fit: 129k (default) / 107k (uncensored), f16 | none | 24.4 (default) / 22.2 (uncensored), empty | 857 / 825 at 8k | – | 11.1 GB | the baseline |

- `SNL_MMPROJ=auto` adds image input with the official projector on either variant (+1.1 GB; 11.7 GB on the card
  with MTP at 128k, so close to full).
- `SNL_UBATCH=1024` gives +3.5% prefill with MTP for +0.38 GB. It is an option, not the default: it was not gated
  with needles or quality runs.
- The long profile is slow to start answering: a 247k prompt takes 552 s to its first token.
- Sinkhorn iterations (`--override-kv sensenova_loop.mhc.iterations=int:4`, +4.8%) and a different loop count
  (`tools/set_loops.py`) change what the model computes and were not checked against a reference. They are not
  shipped (RESULTS.md).

## Use it

```
# 1. weights (pinned in ../notes/trending-batch-1-weights.tsv; ../scripts/hf_get.sh fetches, resumes and checks sha256)
#    sensenova/SenseNova-Loop-9B-GGUF @ b489b15c -> /mnt/models/llm/sensenova-loop-9b/
#      SenseNova-Loop-9B-Q5_K_M.gguf        sha256 5f1f7fd99d4153648a5845045f407716c3a8fc8c7d3c600727cdb19ea9fc37d5
#      mmproj-SenseNova-Loop-9B-F16.gguf    sha256 1bb6afd085020f555b3dca73b6d2139f3a7b28455228b0f07285d0f0ebc61481
#    satellitedown/SenseNova-Loop-9B-abliterated-GGUF @ 2db5ad94 -> /mnt/models/llm/sensenova-loop-9b/abliterated/
#      SenseNova-Loop-9B-abliterated-upstream-Q6_K.gguf
#                                           sha256 3432d22d8073b9c2374ce031acc1ec0f995b8dea32340bdad5ecae1c11370f33
# 2. engine: llama.cpp master 29b52d398 + PR #32588 (8 commits, head 0ba8e4adf), CUDA build
#    -> /mnt/scratch/llama.cpp/pr32588-0ba8e4adf/bin (branch pr32588 in /mnt/scratch/llama.cpp/src-master)
# 3. serve (through gpu_run, OpenAI-compatible on 127.0.0.1:8103, model name sensenova-loop-9b-<variant>)
./serve.sh                                # default variant, 128k, MTP n=2
VARIANT=uncensored ./serve.sh             # abliterated Q6_K, 128k
SNL_PROFILE=long ./serve.sh               # 256k, q4_0 K/V, no MTP
SNL_MMPROJ=auto ./serve.sh                # add image input
SNL_THINK=off ./serve.sh                  # thinking off by default (per request: chat_template_kwargs.enable_thinking)
```

The launch line `serve.sh` runs for the default:

```
llama-server -m SenseNova-Loop-9B-Q5_K_M.gguf --no-mmproj -ngl 99 --fit off -c 131072 -np 1 -t 6 -b 2048 -ub 512 \
  -fa on -ctk q8_0 -ctv q8_0 --spec-type draft-mtp --spec-draft-n-max 2 --jinja --reasoning-format deepseek \
  --reasoning on --temp 1.0 --top-p 0.95 --top-k 20 --min-p 0 --host 127.0.0.1 --port 8103
```

It runs under `gpu_run` with `GPU_RUN_MEM=24G` and holds the GPU lock while serving. Every knob has an `SNL_*`
override (see the header of `serve.sh`); `SNL_DRY=1` prints the command without starting it. Sampling is the GGUF's
own (temperature 1.0, top-p 0.95). Thinking is on by default, as in the chat template; reasoning comes back in
`reasoning_content`.

## Licences

- The model and the official GGUFs: Apache-2.0 (card and GGUF metadata). The Hugging Face repo is gated; its extra
  conditions show only to logged-in users and were not read here.
- The abliterated GGUF is a derivative of the same model; its GGUF header carries no licence field.

## Files

| File | What it is |
|---|---|
| `serve.sh` | the launcher: variant, profile, K/V, MTP, image projector; holds the GPU lock while serving |
| `best-config.json` | the shipped default with its measured numbers and pins |
| `configs/<label>.json` | one per server run: exact command and ledger medians (`python3 -I tools/mkconfigs.py`) |
| `PLAN.md`, `THEORY.md`, `RESULTS.md` | experiment log and gate checklist, ceilings, results |
| `runs/` | ledger, batch logs, server logs, command lines, greedy/codeeval/refusal/smoke outputs |
| `tools/srv.sh <label> [ENV=…] -- <cmd>` | one server start/stop through `../scripts/with_server.sh` on port 8103; logs the command to `runs/cmd-<label>.txt` |
| `tools/gpu_batch.sh <batch.sh>` | one GPU-lock hold per batch (`GPU_RUN_MEM=24G`); batches live in `runs/batches/` |
| `tools/srvtest.py` | prefill, decode (with draft acceptance) and needle client on llama-server's own timings |
| `tools/measure.sh <label> <window>` | the full measurement set: prefill 8k/32k/92%, decode empty and deep, needles 50%/95% |
| `tools/greedy.py` | temperature-0 answers to fixed prompts, and `--compare` for equivalence |
| `tools/smoke.py [--image]` | chat, math, code and one synthetic image |
| `tools/params.py`, `tools/gguf_info.py` | bytes and FLOPs per token, GGUF header summary (`runs/params.txt`, `runs/gguf-info.txt`) |
| `tools/kld.sh`, `tools/set_loops.py` | KLD against a reference and a loop-count rewrite of the GGUF; prepared, not run (no reference) |
| `tools/mem.sh` | CUDA buffers, VmHWM, cgroup peak and VRAM of a running server |

## Credits

- [SenseNova](https://huggingface.co/sensenova/SenseNova-Loop-9B), for SenseNova-Loop-9B, its
  [GGUFs](https://huggingface.co/sensenova/SenseNova-Loop-9B-GGUF) with the MTP head, and the image projector.
- [satellitedown](https://huggingface.co/satellitedown/SenseNova-Loop-9B-abliterated-GGUF), for the abliterated GGUF
  and its `-upstream-` build that loads on the PR.
- niushengxiao and SenseTime, for llama.cpp PR [#32588](https://github.com/ggml-org/llama.cpp/pull/32588): the
  `sensenova_loop` architecture and the shared full-attention cache across loop visits.
- [llama.cpp](https://github.com/ggml-org/llama.cpp) and ggml-org, for the engine, MTP speculative decoding, flash
  attention and quantized K/V.
- The tuning method comes from 0xSero / Sybil Solutions'
  [inference-optimisation-skill](https://github.com/sybil-solutions/inference-optimisation-skill): ceilings first,
  one change at a time between controls, output gated as well as speed.
