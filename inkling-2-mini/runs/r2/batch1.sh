#!/usr/bin/env bash
# Round 2 batch 1 (one gpu_run session, tools/gpu_batch.sh): quant llama-bench with controls, NVFP4 scale check, --fit vs the regex.
cd "$(dirname "$0")/../.."
L=/mnt/scratch/llama.cpp; D=/mnt/models/llm/inkling-2-mini; U=$D/unsloth/Mainline_Support
export LD_LIBRARY_PATH=/mnt/scratch/envs/llama-build-cuda/lib
CORE='blk\.([0-5]|1[89]|2[0-3])\.ffn_.*_exps=CPU'
IQ3OT='blk\.([0-2]|2[0-3])\.ffn_.*_exps=CPU'      # IQ3_XXS: core + layers 3-5, 18-19 on the GPU
KV="-ctk q8_0 -ctv q8_0 -b 2048 -p 2048 -n 64 -r 6"
echo "#### $(date +%T) A. quants, llama-bench on stock master 225a5345b"
export INK_BIN=$L/master-225a5345b/bin
tools/bench.sh r2c-1-ctl-iq4nl-b -ot "$CORE" $KV -ub 128
for q in IQ2_XXS Q2_K_XL; do
  INK_MODEL=$U/Inkling-2-Mini-UD-$q.gguf tools/bench.sh r2c-$q-gpu-ub128-b $KV -ub 128
  INK_MODEL=$U/Inkling-2-Mini-UD-$q.gguf tools/bench.sh r2c-$q-gpu-ub512-b $KV -ub 512
done
INK_MODEL=$U/Inkling-2-Mini-UD-IQ3_XXS.gguf tools/bench.sh r2c-IQ3_XXS-core5-ub128 -ot "$IQ3OT" $KV -ub 128
INK_MODEL=$U/Inkling-2-Mini-UD-IQ3_XXS.gguf tools/bench.sh r2c-IQ3_XXS-core-ub128 -ot "$CORE" $KV -ub 128
tools/bench.sh r2c-9-ctl-iq4nl -ot "$CORE" $KV -ub 128

echo "#### $(date +%T) B. is patch 0001 redundant? NVFP4 repack PPL: old pin (expected wrong), old inkfix, new stock master"
for b in master-29b52d398 inkfix-4c836a8eb master-225a5345b; do
  NP_ROWS="core-opon" INK_MODEL=$D/own/Inkling-2-Mini-NVFP4.gguf INK_BIN=$L/$b/bin tools/nanprobe.sh r2-nvfp4-$b
done

echo "#### $(date +%T) C. --fit (stock and PR #32777) against the recipe's -ot regex"
M=$D/Inkling-2-Mini-IQ4_NL.gguf
for t in 128 0; do
  $L/pr32777-c9adddc89/bin/llama-fit-params -m $M -c 65536 -np 1 -fa on -ctk q8_0 -ctv q8_0 -b 2048 -ub 128 -t 6 --fit-target $t > runs/r2/fit-pr32777-c9adddc89-t$t.log 2>&1 < /dev/null
  echo "pr32777 --fit-target $t: $(tail -1 runs/r2/fit-pr32777-c9adddc89-t$t.log | cut -c1-160)"
done
bench() { # name build reps npp args...
  local name=$1 b=$2 r=$3 p=$4; shift 4
  $L/$b/bin/llama-bench -m $M -fa 1 -t 6 -o jsonl -ctk q8_0 -ctv q8_0 -ub 128 -b 2048 -p $p -n 64 -r $r "$@" > runs/bench-$name.jsonl 2> runs/bench-$name.err
  python3 -I tools/summarize.py runs/bench-$name.jsonl
}
args_of() { tail -1 "$1" | python3 -I -c "
import sys, re, shlex
s = sys.stdin.read().strip(); m = re.search(r'-ngl (\d+)', s); o = re.search(r'-ot \"(.*)\"', s)
print('-ngl ' + m.group(1) + (' -ot ' + shlex.quote(o.group(1).replace(',', ';')) if o else ''))"; }
bench r2f-1-ctl-regex pr32777-c9adddc89 6 2048 -ngl 99 -ot "$CORE"
for f in master-225a5345b-t1024 pr32777-c9adddc89-t1024 master-225a5345b-t256 pr32777-c9adddc89-t512 pr32777-c9adddc89-t256 pr32777-c9adddc89-t128 pr32777-c9adddc89-t0; do
  b=${f%-t*}; a=$(args_of runs/r2/fit-$f.log); echo "   $f fit args: ${a:0:150}"
  eval "timeout 600 bash -c 'true'"; eval "bench r2f-fit-$f $b 2 512 $a"
done
bench r2f-9-ctl-regex pr32777-c9adddc89 6 2048 -ngl 99 -ot "$CORE"
echo "#### done $(date +%T)"
