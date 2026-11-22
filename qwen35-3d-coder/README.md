# qwen35-3d-coder

Serving [ccore/Qwen3.5-4B-3D-Coder](https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder) as fast as possible on the RTX 3060 12 GB.
The model is a Qwen3.5-4B fine-tune that reasons, then writes a complete three.js page.

It fits in VRAM at any quant. So this recipe is about decode speed on a model that already fits:

- choosing a quant;
- bringing back the base model's multi-token-prediction (MTP) head, which the release dropped;
- tuning speculation for a task that switches from prose (reasoning) to code.

Numbers, the quality eval and the CUDA-kernel analysis are in [RESULTS.md](RESULTS.md). The experiment log is [PLAN.md](PLAN.md). Raw data is in `runs/`.

## Result

| Single user, 64k context | Q8_0 official, no speculation | **This recipe: Q5_K_M** |
|---|---:|---:|
| Decode while reasoning | 62.5 tok/s | **80.7 tok/s** |
| Decode while writing the page | 58.3 tok/s | **74.0 tok/s** |
| Task-weighted decode | 60.6 tok/s | **77.5 tok/s (1.28×)** |
| Prefill, 32k prompt | | 12.9 s (2,480 tok/s) |
| KL divergence vs F16 | 0.001 | 0.007 |
| Render eval, pages that work (20 prompts) | 10 | 9 |

The restored MTP head takes Q5_K_M to **101.7 tok/s (1.68×)** on the speed sessions, and 105.7 vs 75.0 tok/s median on real 8-prompt answers. It is opt-in, not the default. Its first check, one answer per prompt, failed (1 page of 8 worked against 6) and looked like an engine bug in rolling back DeltaNet state. The follow-up did not bear that out. MTP's state matches a clean prefill through 12k tokens. It loops no more often (0/16 vs 2/16 on the prompts that looped). With 2 seeds on the same 8 prompts, 10/16 pages worked against 9/16. What keeps it off by default is a different kind of failure: 5 of its 19 finished pages had token-slip syntax errors (a duplicated `const`, a garbled identifier), against 0 of 35 for Q5_K_M without speculation (RESULTS.md, "Does MTP break long answers?"). To use it: `QC_SPEC=draft-mtp ./serve.sh`.

Q4_K_M is faster again (84.8 tok/s without speculation), but 62% of its finished pages threw errors (`THREE.Object33D`, duplicate declarations), and it passed 5 of 20 prompts.

## Use it

```bash
tools/download.sh       # pinned GGUFs, base-model MTP tensors, DFlash drafter, eval data (sha256-checked)
tools/build_quants.sh   # CPU only: graft the MTP head, convert to F16, quantize Q8_0/Q6_K/Q5_K_M/Q4_K_M
./serve.sh              # llama-server on 127.0.0.1:8083 through gpu_run, OpenAI-compatible
```

The defaults in `serve.sh` are:

- our Q5_K_M (the file carries the MTP head, unused unless `QC_SPEC=draft-mtp`);
- no speculation;
- `-fa on`, f16 KV, 64k context, one slot;
- `-ub 2048`;
- the model card's sampling (T 0.6, top-p 0.95, top-k 20).

Overrides: `QC_MODEL` (e.g. our Q4_K_M for 5% more speed and more broken pages), `QC_SPEC=draft-mtp`, `QC_DRAFT_MAX`, `QC_CONTEXT`, `QC_PORT`.

## Why the MTP head had to be restored

The config declares `mtp_num_hidden_layers: 1`, but the released safetensors (723 tensors) and the official GGUFs (`nextn_predict_layers = 0`) have no MTP weights.

`tools/fetch_mtp.py` fetches the 15 `mtp.*` tensors of base [Qwen/Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B) with HTTP range requests (241 MB). `tools/make_src.py` then adds them to the fine-tune's checkpoint. llama.cpp's converter turns that into `blk.32.nextn.*`.

The base head was never trained on the fine-tune's hidden states. Even so, it is accepted 86% of the time while the model writes code. While it reasons, the rate drops to 37%. The speed-up is real; the output-quality problem above has to be fixed in the engine before it can ship.

## Tools

| Script | What it does |
|---|---|
| `tools/ceiling.py` | per-category bytes per token and the decode ceiling of a GGUF |
| `tools/gpubw.py` | VRAM bandwidth probe (cudart memcpy + cuBLAS SGEMV), no nvcc needed |
| `tools/benchsession.sh` | a plan of llama-bench runs inside one `gpu_run` session, with telemetry |
| `tools/ab.py` | llama-server A/B sessions with interleaved controls, appended to `runs/ledger.jsonl` |
| `tools/ledger_summary.py` | per-config medians and the task-weighted rate |
| `tools/kld.sh` | KL divergence of every quant against our F16 on held-out answers |
| `tools/evalrun.sh`, `gen.py`, `render.mjs`, `score.py` | the render eval: generate, render in headless Chromium on the CPU (SwiftShader), score |
| `tools/qualify.sh` | acceptance gates for `serve.sh`: chat, scenes (`--scene-only --ids`), needles at 32k and 62k |
| `tools/eval_table.py`, `loop_check.py` | side-by-side render-eval table; flags answers that loop |

## Credits

- llama.cpp b12242 for the engine, the converter, MTP and DFlash.
- The model's author ccore, for the fine-tune and the [ThreeJS-3D-Scenes](https://huggingface.co/datasets/ccore/ThreeJS-3D-Scenes) dataset. The eval prompts come from its validation split.
- Qwen, for the Qwen3.5-4B base model and its MTP head.
- z-lab, for the [Qwen3.5-4B-DFlash](https://huggingface.co/z-lab/Qwen3.5-4B-DFlash) drafter.

## The race video

`promo/` holds a side-by-side time-lapse: the same prompt (a voxel bonsai) sent to the Q8_0 baseline and the tuned Q5_K_M server, each scene growing mesh by mesh as its code streams in. Both sides run on one clock at the same speed-up, so the gap at the finish is the real gap.

- `promo/session.sh` + `promo/capture.py` stream each answer with per-chunk timestamps into `promo/captures/<prompt>/`.
- `promo/tools/buildseq.mjs` replays each page in headless Chromium and saves a frame per batch of meshes; `promo/tools/prep.py` maps every mesh to the moment its code arrived.
- `promo/src/Race.tsx` is the Remotion composition (render with the Flint promo's `node_modules`).

The two quants write different code from the same seed, so the pages differ. The bonsai pair was picked because the token counts are close (14,097 stock, 15,213 tuned), so the finish gap understates the decode speedup rather than inflating it.
