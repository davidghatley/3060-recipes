#!/usr/bin/env bash
# Block until the CPU has been >= ${QUIET_IDLE:-90}% idle over a 5 s window (other agents' renders share this CPU).
# Prints the idle % it saw. Gives up after ${QUIET_MAX:-1800} s and returns 1.
idle() { read -r _ u n s i w x y z _ < /proc/stat; echo $((i + w)) $((u + n + s + i + w + x + y + z)); }
start=$(date +%s)
while :; do
  read -r i0 t0 < <(idle); sleep 5; read -r i1 t1 < <(idle)
  pct=$(( 100 * (i1 - i0) / (t1 - t0) ))
  if [ "$pct" -ge "${QUIET_IDLE:-90}" ]; then echo "idle=${pct}%"; exit 0; fi
  [ $(( $(date +%s) - start )) -ge "${QUIET_MAX:-1800}" ] && { echo "never quiet (last idle=${pct}%)"; exit 1; }
done
