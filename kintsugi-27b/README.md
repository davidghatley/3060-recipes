# Kintsugi-27B

Qwen3.8-27B at 2.47 bits per weight (EXL3 trellis codes after QTIP, Escha W2 layout, L0xRE-V2 bit allocation) in one
GGUF, made for a single 12 GB card with the full 262,144-token window. Source: https://huggingface.co/CaryPalmer/Kintsugi-27B
(Apache-2.0). Engine: the author's llama.cpp fork with EXL3 trellis kernels, Linux bundle v1.1.1 from
https://github.com/professorpalmer/Kintsugi-27B/releases. Stock llama.cpp and Ollama cannot load the file.

## Files (outside this repo)

| What | Path | sha256 |
|---|---|---|
| Model, 10,546,687,168 B | `/mnt/models/llm/kintsugi-27b/Kintsugi-27B-12G.gguf` | `0510bae8…c48c8a74` |
| DFlash2 drafter, 1,094,346,080 B | `/mnt/models/llm/kintsugi-27b/dflash-Qwen3.8-27B-Q4_0.gguf` | `0a994382…6ca3c4` |
| Bundle tarball, 683,713,421 B | `/mnt/models/llm/kintsugi-27b/bundle-dl/Kintsugi-27B-v1.1.1-linux-x86_64.tar.gz` | `0d55dd1b…92d701` |
| Unpacked bundle | `/mnt/models/llm/kintsugi-27b/bundle/Kintsugi-27B/` | |
| Saved conversations (layer) | `/mnt/models/llm/kintsugi-27b/slots/` (capped at 20 GB by the layer) | |

Full hashes are in `/mnt/models/llm/kintsugi-27b/download.sha256`. All three matched the published values on 2026-11-21.

To fetch again (no `hf` CLI here, so plain curl; it resumes):
```
cd /mnt/models/llm/kintsugi-27b
for f in Kintsugi-27B-12G.gguf dflash-Qwen3.8-27B-Q4_0.gguf; do
  curl -fL -C - -o "$f" "https://huggingface.co/CaryPalmer/Kintsugi-27B/resolve/main/$f"; done
gh release download v1.1.1 --repo professorpalmer/Kintsugi-27B -p '*linux-x86_64.tar.gz' -D bundle-dl
mkdir -p bundle && tar -xzf bundle-dl/*.tar.gz -C bundle
```

## Run

```
./serve.sh            # foreground; queues on the shared GPU lock, frees ComfyUI's cache, holds the lock while serving
./stop.sh             # from another shell (or Ctrl-C in serve.sh); the lock is released when the engine exits
./serve.sh --dry-run  # print the engine command line
```

- Clients: `http://127.0.0.1:8080/v1` (OpenAI chat + responses) and `http://127.0.0.1:8080/v1/messages` (Anthropic).
  Port 8080 is the bundle's Python layer (saved conversations); llama-server itself is on 127.0.0.1:18080.
- Why a wrapper: the bundle's `start-server.sh` starts the engine with `setsid nohup` and returns, so under `gpu_run`
  directly the lock would be released while the engine still holds ~11 GB of VRAM. `serve.sh` waits on the engine PID.
- `GPU_RUN_MEM=40G` by default: the tiered K/V cache puts everything past the VRAM cells in system RAM, and memcap
  counts page cache.
- Any `KINTSUGI_*` setting from the bundle's `start-server.sh` passes through, e.g. `KINTSUGI_DRAFT=off`,
  `KINTSUGI_CTX=65536`, `KINTSUGI_THINK=off`, `KINTSUGI_KV=q8_0`.
- The script sees a display process on the 3060 (Hyprland), so it keeps a 600 MiB margin. It counts VRAM cells from
  what is free at start, so start it only through `serve.sh` (which waits for the room), never while another job is
  on the card.

## Harnesses

Claude Code, per shell only (don't set these globally):
```
ANTHROPIC_BASE_URL=http://127.0.0.1:8080 ANTHROPIC_API_KEY=local \
ANTHROPIC_DEFAULT_OPUS_MODEL=kintsugi ANTHROPIC_DEFAULT_SONNET_MODEL=kintsugi ANTHROPIC_DEFAULT_HAIKU_MODEL=kintsugi \
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 claude --model kintsugi
```
Codex (`~/.codex/config.toml` profile), Pi and OpenCode configs: see the bundle's `HARNESSES.md`. Codex needs
`wire_api = "responses"`. The `kintsugi-local` provider in `../opencode.json` points at :8080.

## Review notes (2026-11-21)

The bundle was read before first run: `start-server.sh` / `stop.sh` touch only the bundle folder and localhost;
the layer (`layer/bonsai_layer.py`, `slot_cache.py`) only calls its upstream on 127.0.0.1 and runs with all its tools
(code interpreter, cards, lint) switched off; `llama-server` links only bundle libraries and standard system libs.
