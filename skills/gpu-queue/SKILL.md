---
name: gpu-queue
description: Share one consumer GPU safely between several agents, sessions or projects on the same machine - a single lock that every GPU job takes, a VRAM check before start, a RAM cap that remembers page cache counts, and the rule never to kill processes you did not start. Use when more than one agent or project uses the same GPU, before starting any GPU job on a shared machine, when a job fails with CUDA out-of-memory because something else holds VRAM, when asked "what is using the GPU", or when setting up a benchmark that must not be disturbed.
---

# One GPU, many agents

On a single-GPU machine, two jobs at once means both run slower, the benchmark numbers are wrong, and one of them
usually dies with an out-of-memory error. The fix is one lock that every GPU job takes, and a few rules.

## The lock

Use a `flock` wrapper so every GPU job is serialised:

```sh
#!/usr/bin/env bash
# gpu_run: run a command while holding the machine's GPU lock.  gpu_run [--wait SECONDS] <command...>
lock=${GPU_LOCK:-/var/tmp/gpu.lock}
wait=0; [ "${1:-}" = "--wait" ] && { wait=$2; shift 2; }
exec 9>"$lock"
if [ "$wait" -gt 0 ]; then flock -w "$wait" 9 || { echo "GPU busy (lock held: $(cat "$lock.owner" 2>/dev/null))" >&2; exit 75; }
else flock 9; fi
echo "$$ $(date -Is) $*" > "$lock.owner"
trap 'rm -f "$lock.owner"' EXIT
"$@"
```

- Every GPU job goes through it: servers, benchmarks, training, image generation, video encodes with NVENC.
- A server that is "up" holds the lock for as long as it serves. If a launcher detaches (forks and exits),
  wrap it so the wrapper stays alive and keeps the lock until the server is stopped.
- Keep held time short. Long batches should release the lock between chunks so others can get in.

## Check before you start

```sh
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader
nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv
cat /var/tmp/gpu.lock.owner 2>/dev/null
```

A desktop session holds roughly 1 GB of VRAM on its own. Plan layouts against what is free, not the card's total.

## Cap RAM, and count page cache

Jobs that keep weights in system RAM can push the whole machine into swap. Run them under a memory cap
(`systemd-run --user --scope -p MemoryMax=44G <cmd>` or a cgroup). **A cgroup memory cap counts page cache.**
Engines that `mmap` the weights file (llama.cpp with experts in RAM, engines that stream from disk) have the file's
pages charged to their cgroup, so the cap has to be at least the file size plus working memory. A cap sized for
"process memory" will throttle or kill them.

## Never

- Kill a process you did not start, or use `pkill -f` / `killall` with a pattern. Stop only your own
  process tree: record the PID you launched and signal it and its descendants.
- Trust a server because something answered on the port. Another session may own it. Confirm through your own
  launcher's log or PID that the server is yours.
- Edit a running shell script. Bash reads scripts as it goes; edits land at shifted offsets and run garbage.
- Leave a queued launcher behind when you give up waiting. It will start a server later that nobody owns.
