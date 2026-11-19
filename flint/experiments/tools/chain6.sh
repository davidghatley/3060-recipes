#!/usr/bin/env bash
# After the last experiment queue: restart the production server on 8081 exactly as instructed and record /health.
cd "$(dirname "$0")/.."
until grep -q "B2b done" runs/phaseB2b.log 2>/dev/null; do sleep 15; done
sleep 10
cd .. && nohup ./serve.sh > runs/server-final-$(date +%Y%m%d-%H%M%S).log 2>&1 &
for _ in $(seq 300); do curl -sf http://127.0.0.1:8081/health > /dev/null && break; sleep 2; done
echo "$(date -Is) health: $(curl -s http://127.0.0.1:8081/health)" >> experiments/runs/restart-8081.txt
