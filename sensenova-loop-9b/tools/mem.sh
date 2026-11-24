#!/usr/bin/env bash
# Print the server's CUDA buffers (from its log) and its RAM high-water marks (VmHWM, cgroup peak incl. page cache).
#   tools/mem.sh <label>      (run as part of a tools/srv.sh test command, while the server on $PORT is up)
cd "$(dirname "$0")/.."
l=$1
grep -E 'CUDA0 (model|KV|RS|compute) buffer|CUDA_Host (model|compute) buffer|n_ctx *=|llama_context: n_ctx|fit' "runs/server-$l.log" | sed 's/^[0-9.]* [IWE] //' | sort -u | head -30
pid=$(ss -ltnpH "sport = :$PORT" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
[ -n "$pid" ] && echo "MEM $l $(grep -E 'VmHWM|VmRSS' /proc/$pid/status | tr -s ' \n' ' ')$(cat /sys/fs/cgroup$(cut -d: -f3 /proc/$pid/cgroup)/memory.peak 2>/dev/null | sed 's/^/ cgroup_peak=/') vram_now=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader)"
