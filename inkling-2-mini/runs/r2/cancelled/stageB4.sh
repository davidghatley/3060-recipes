#!/usr/bin/env bash
# Round 2, step 1: speed of what --fit chooses (stock master and PR #32777) against the recipe's -ot regex.
# Same flags otherwise (IQ4_NL, 64k-style q8_0 KV, ub 128). The fit outputs come from runs/r2/fit-*.log (stage B2).
cd "$(dirname "$0")/../.."
until grep -q "^== done" runs/r2/${AFTER:-stageC2}.log; do sleep 10; done
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib GPU_RUN_MEM=44G
L=/mnt/scratch/llama.cpp; M=/mnt/models/llm/inkling-2-mini/Inkling-2-Mini-IQ4_NL.gguf
G="$HOME/anime-pipeline/tools/gpu_run --need 10000 --wait 7200"
# does a smaller margin make #32777 pick the recipe's placement?
for t in 128 0; do
  echo "== $(date +%T) pr32777 --fit-target $t"
  $G $L/pr32777-c9adddc89/bin/llama-fit-params -m $M -c 65536 -np 1 -fa on -ctk q8_0 -ctv q8_0 -b 2048 -ub 128 -t 6 --fit-target $t > runs/r2/fit-pr32777-c9adddc89-t$t.log 2>&1 < /dev/null
  tail -1 runs/r2/fit-pr32777-c9adddc89-t$t.log | cut -c1-200
done
bench() { # name build reps npp args...
  local name=$1 b=$2 r=$3 p=$4; shift 4
  echo "== $(date +%T) $name ($b)"
  $G $L/$b/bin/llama-bench -m $M -fa 1 -t 6 -o jsonl -ctk q8_0 -ctv q8_0 -ub 128 -b 2048 -p $p -n 64 -r $r "$@" > runs/bench-$name.jsonl 2> runs/bench-$name.err
  python3 -I tools/summarize.py runs/bench-$name.jsonl
}
args_of() { tail -1 "$1" | python3 -I -c "
import sys, re, shlex
s = sys.stdin.read().strip(); m = re.search(r'-ngl (\d+)', s); o = re.search(r'-ot \"(.*)\"', s)
print('-ngl ' + m.group(1) + (' -ot ' + shlex.quote(o.group(1).replace('=CPU', '=CPU').replace(',', ';')) if o else ''))"; }
CORE='blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'
bench r2f-1-ctl-regex pr32777-c9adddc89 6 2048 -ngl 99 -ot "$CORE"
for f in master-225a5345b-t1024 pr32777-c9adddc89-t1024 master-225a5345b-t256 pr32777-c9adddc89-t512 pr32777-c9adddc89-t256 pr32777-c9adddc89-t128 pr32777-c9adddc89-t0; do
  b=${f%-t*}; a=$(args_of runs/r2/fit-$f.log); echo "   fit args: ${a:0:160}"
  eval "bench r2f-fit-$f $b 3 512 $a"
done
bench r2f-9-ctl-regex pr32777-c9adddc89 6 2048 -ngl 99 -ot "$CORE"
echo "== done $(date +%T)"
