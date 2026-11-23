---
title: "A port-based health check can be answered by someone else's server"
date: 2026-11-22
group: box-and-harness
recipes: [flint, qwen35-3d-coder]
provenance: ours
provenance_note: "Bug found and fixed here in our own harness scripts."
credit: []
evidence: ["flint/experiments/RESULTS.md:44", "README.md:17", "qwen35-3d-coder/PLAN.md:258"]
applies_to: "Any benchmark harness on a machine where more than one job can start a server."
---

A harness that waits for `/health` on a port and then runs its tests will measure whatever answers on that port.

It happened here on a shared GPU. While a Flint test server was still queued for the GPU lock, another session's server on the same port answered the health check. The tests ran against the wrong model and failed. The stop step found nothing to stop, and the queued server started later with no owner, holding the lock. The whole run was void. The 3D-coder harness had the same bug.

The fix in both: trust health only from the script's own server child process, identified by its process tree and model alias, wait as long as the lock wait, and end a still-queued launcher on exit. Give each recipe its own port as well.

The repo's `scripts/with_server.sh` is the shared helper that does this.
