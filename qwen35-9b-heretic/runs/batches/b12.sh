# b12 (run directly, NOT through gpu_batch.sh): ./serve.sh as a user would start it (its own gpu_run hold), chat answer,
# reasoning field, lock held while serving and free afterwards. Then (inside one gpu_run hold) 4 parallel slots.
cd "$(dirname "$0")/../.."
date
PORT=8106 READY_WAIT=3600 ../scripts/with_server.sh b12-serve ./serve.sh runs -- bash -c '
  ~/anime-pipeline/tools/gpu_run --status | head -1
  curl -s http://127.0.0.1:8106/v1/chat/completions -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What is 17*23? Answer with the number.\"}],\"max_tokens\":1500}" | python3 -I -c "import json,sys; d=json.load(sys.stdin); m=d[\"choices\"][0][\"message\"]; print(\"ANSWER\", repr(m.get(\"content\")), \"reasoning_chars\", len(m.get(\"reasoning_content\") or \"\"), d[\"timings\"][\"predicted_per_second\"])"'
sleep 3; echo "after stop: $(~/anime-pipeline/tools/gpu_run --status | head -1)"
date
cat > runs/batches/b12b.sh <<'EOB'
cd "$(dirname "$0")/../.."
T='python3 -I tools/concurrent.py --label $LABEL --n 4 --rounds 3 --max 256 | tail -1; python3 -I tools/concurrent.py --label $LABEL-c1 --n 1 --rounds 3 --max 256 | tail -1; tools/mem.sh $LABEL'
date; tools/srv.sh b12-np4-ns QH_CTX=131072 QH_KV=q8_0 QH_NP=4 -- bash -c "$T"
date; tools/srv.sh b12-np4-mtp QH_CTX=98304 QH_KV=q8_0 QH_NP=4 QH_SPEC=mtp -- bash -c "$T"
date
EOB
tools/gpu_batch.sh runs/batches/b12b.sh
echo "end rc=$? $(date)"
