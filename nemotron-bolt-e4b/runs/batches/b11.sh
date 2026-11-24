# b11: serve.sh launched directly (its own gpu_run call, holds the lock while serving), one chat + gpu_run status.
cd "$(dirname "$0")/../.."
date
PORT=8105 READY_WAIT=3600 ../scripts/with_server.sh b11-serve-direct ./serve.sh runs -- bash -c '
  ~/anime-pipeline/tools/gpu_run --status | head -1
  curl -s 127.0.0.1:8105/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"nemotron-bolt\",\"messages\":[{\"role\":\"user\",\"content\":\"What is 17 multiplied by 23?\"}],\"max_tokens\":512}" \
  | python3 -I -c "import json,sys; d=json.load(sys.stdin); m=d[\"choices\"][0][\"message\"]; print(\"content:\", repr(m.get(\"content\"))[:200]); print(\"reasoning chars:\", len(m.get(\"reasoning_content\") or \"\")); t=d[\"timings\"]; print(\"decode\", round(t[\"predicted_per_second\"],1), \"draft\", t.get(\"draft_n\"), t.get(\"draft_n_accepted\"))"'
date
echo BATCH-DONE
