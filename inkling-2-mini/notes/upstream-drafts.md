# Upstream drafts (not posted)

Two drafts for ggml-org/llama.cpp, written 2026-11-22 from the round-2 runs. Raw logs are named next to each number.
Nothing here has been posted.

## (a) Comment for the op-offload NaN issues (#32710; also fits #32755 and #32778)

> Post on #32710, which has the scheduler analysis. A one-line pointer on #32755 and #32778 is enough.

Still reproduces on master `225a5345b` (build 12627), and the placement matrix below fits the scheduler explanation
above (looped layers' host experts are an input of the first pass's split only).

**Setup:** RTX 3060 12 GB (sm_86, driver 615.78.08, CUDA 12.9), i5-12500, 62 GB RAM, Linux. Source build with
`-DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=86`. Model: ggml-org `Inkling-2-Mini-IQ4_NL.gguf` (17627940768 bytes).

```sh
llama-perplexity -m Inkling-2-Mini-IQ4_NL.gguf -f wikitext-2-raw/wiki.test.raw --chunks 3 \
  -c 512 -b 512 -ub 512 -ngl 99 --fit off -fa on -t 6 -ot "<pattern>" [--no-op-offload]
```

| Experts kept on the host (`-ot ...=CPU`) | Op offload | `-ub` | PPL, 3 chunks |
|---|---|---:|---:|
| all (`exps=CPU`) | on | 512 | **nan, nan, nan** |
| all | off (`--no-op-offload`) | 512 | 6.0074 |
| all | on | 32 | **nan, nan, nan** |
| all | on | 31 | 6.0212 |
| layers 0-5 and 18-23, so the looped core 6-17 is on the GPU (`blk\.([0-5]\|1[89]\|2[0-3])\.ffn_.*_exps=CPU`) | on | 512 | 6.0297 |
| same | off | 512 | 6.0131 |
| layers 0-6 and 18-23, so one looped layer (6) is on the host (`blk\.([0-6]\|1[89]\|2[0-3])\.ffn_.*_exps=CPU`) | on | 512 | **nan, nan, nan** |
| layers 0-17 and 20-23, so only 18-19 are on the GPU (`blk\.([0-9]\|1[0-7]\|2[0-3])\.ffn_.*_exps=CPU`) | on | 512 | **nan, nan, nan** |

What this adds to the thread:

- **The threshold is exact with llama-perplexity: `-ub 31` is fine, `-ub 32` is NaN.** That is the op-offload batch
  threshold, measured rather than read from the source.
- **One looped layer on the host is enough** (layer 6 alone, with the other eleven core layers on the GPU). Any number
  of non-looped layers on the host is fine.
- The same five placement rows gave the same results on `29b52d398` (b12600), so nothing between the two changed it.
- Decode (batch 1) never takes the offload path, so `llama-bench` tg numbers and short prompts look healthy. On
  llama-server the first symptom we saw was an image prompt answering `????`: the 49-token image batch crosses the
  threshold.

**Workarounds that hold here:**

1. Keep the experts of layers 6-17 on the GPU and put only layers 0-5 and 18-23 on the host
   (`-ot 'blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'`). On a 12 GB card with IQ4_NL that is also the fast placement:
   29.3 tok/s against 17.6 with every expert on the host, because each core expert is read three times per token.
   With this placement op offload stays on and long prompts are correct: 3 of 3 needles found in a 62k-token prompt.
2. `--no-op-offload` for any placement that leaves a looped layer on the host. It costs prefill speed (the host
   experts are then computed on the CPU): 41.7 tok/s against 175 tok/s for placement 1 with op offload on.

Logs: `runs/nanprobe/r2-master-225a5345b-*.log` in https://github.com/davidghatley/3060-recipes (inkling-2-mini).

## (b) Note for #32740 (compact attention bias on FLASH_ATTN_EXT)

Numbers from a 12 GB card, where this buffer decides what context fits. PR head 808fd1c4e merged onto master
225a5345b. RTX 3060 12 GB (sm_86, CUDA 12.9), ~0.95 GB of the card held by the desktop. `-fa on`, q8_0 KV, `-np 1`.

**Compute buffer at load (CUDA0, MiB).** IQ4_NL with the experts of layers 0-5 and 18-23 on the host (op offload on,
so ~0.9 GB of every figure is staging for those host experts), and UD-IQ2_XXS with everything on the GPU:

| Case | master 225a5345b | F16 cast (below) | #32752 | **#32740** |
|---|---:|---:|---:|---:|
| IQ4_NL, 64k, ub 128 | 1775 | 1391 | 1007 | **928** |
| IQ4_NL, 64k, ub 256 | OOM (3368) | OOM (2600) | 1448 | **985** |
| IQ4_NL, 64k, ub 512 | OOM | OOM | OOM (2459) | **1100** |
| IQ2_XXS all on GPU, 64k, ub 128 | 1630 | | | **339** |
| IQ2_XXS all on GPU, 64k, ub 512 | OOM (6524) | | | **594** |
| IQ2_XXS all on GPU, 128k, ub 128 | OOM (3214) | | | **643** |

**Speed, IQ4_NL, same flags (llama-bench, tg64 x6 / pp2048 x6, ub 128):** master 29.28 and 29.17 tok/s decode,
174.1 and 174.2 tok/s prefill; this PR **29.71 / 192.7** (+1.4% decode, +10.5% prefill), with master runs on both
sides.

**What it changes on this card:** master loads 64k with this placement and then dies on the first request
(`cudaGraphInstantiate`: out of memory). With this PR it runs, and the smaller buffer leaves room for `-ub 512`
(llama-server, medians of 3, cold unique code prompts, capped coding answers; 3 needles hidden in a 62k-token prompt):

| 64k context, IQ4_NL, core experts on the GPU | Decode, empty | Decode after 62k | Prefill, 8k prompt | Prefill, 62k prompt | Needles at 62k |
|---|---:|---:|---:|---:|---|
| master 225a5345b | OOM on first request | | | | |
| master + F16 cast, ub 128 | 29.0 | 20.2 | 144.1 | 102.9 | 3/3 |
| master + #32752, ub 256 | 28.9 | 20.0 | 200.1 | 123.1 | 3/3 |
| **master + #32740, ub 128** | 29.6 | 24.2 | 166.7 | 152.1 | 3/3 |
| **master + #32740, ub 512** | 29.5 | 24.1 | **362.5** | **297.1** | 3/3 |

So on this card the PR is worth 2.5x prefill at 8k, 2.9x at 62k and +20% decode at 62k over the best we could run
before.

**128k context, same card.** Experts of layers 6-15 on the GPU (0-5 and 16-23 on the host), `--no-op-offload`,
q8_0 KV. Master with our F16 cast only runs this at `-ub 64`; with this PR `-ub 256` runs with about 1 GB to spare:

| 128k context, IQ4_NL | Decode, empty | Prefill, 124k prompt | Decode after 124k | Needles at 124k |
|---|---:|---:|---:|---|
| master + F16 cast, ub 64 | 26.4 | 56.0 | 14.6 | 3/3 |
| **master + #32740, ub 256** | 26.9 | **90.8** | **18.9** | 3/3 |

Output check, llama-perplexity 3 x 512 on wikitext-2, same placement: master 6.0297 (op offload on) and 6.0131
(`--no-op-offload`); this PR 6.0178 and 6.0279. Not bit-identical to master, but inside the spread between master's
own two paths. The unrelated op-offload NaN (#32710) is unchanged by this PR, as expected.

**For comparison, the small local patch we had been carrying:** cast the permuted bias to F16 and add the F16 mask
directly when flash attention is on, instead of F32 gather, F32 add, F16 copy. It cuts the buffer by 24%
(1632 -> 1248 MiB at 64k ub 128 and 6527 -> 4991 MiB at ub 512 without op offload; 1775 -> 1391 in the table above)
with bit-identical perplexity, because the mask only adds 0 or -inf. That was enough to run 64k here, but it keeps
the n_kv x n_tokens x n_head term. This PR removes most of it, so we would drop our patch once it merges.

One trap from that patch, in case it is useful for review: building the F16 bias with `ggml_cpy` into a new tensor
made the buffer larger (4198 MiB), because the destination is a graph leaf and every layer's mask stayed allocated.
`ggml_cast` did not have that problem.

Logs: `runs/membuf/summary-r2-core.txt`, `runs/membuf/summary-r2-allgpu.txt`, `runs/r2/benchA.log`,
`runs/r2/b128-8.log`, `runs/server-r2-pr32740-64k-ub128.log`, `runs/server-r2-pr32740-64k-ub512.log`, `runs/server-r2-pr32752-64k-ub256.log`.
