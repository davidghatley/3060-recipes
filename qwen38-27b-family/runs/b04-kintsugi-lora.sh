# Batch 4 (stretch): does the Kintsugi bundle's server load our GGUF of the pi LoRA on its EXL3 weights, and does it change the output?
set -u
cd "$(dirname "$0")/.."
L=/mnt/models/llm/qwen38-27b-family/pi-adapted/lora-gguf/Qwen3.8-27B-pi-lora-F16.gguf
export READY_RE='listening on http://127\.0\.0\.1:8101'
for cfg in nolora lora; do
  e=(); [ $cfg = lora ] && e=(KL_LORA=$L)
  env "${e[@]}" READY_WAIT=300 ../scripts/with_server.sh b04-kintsugi-$cfg tools/kintsugi_lora_serve.sh runs -- \
    python3 -I tools/greedy.py --label kintsugi-$cfg --out runs/greedy --max 300 2>&1 | grep -vi libcurl
  grep -iE 'lora|error|fail' runs/server-b04-kintsugi-$cfg.log | head -12
done
python3 -I tools/greedy.py --compare runs/greedy/greedy-kintsugi-nolora.json runs/greedy/greedy-kintsugi-lora.json
