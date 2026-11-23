# control = 06 (every routed expert in RAM + 4800 MiB MoE cache); candidates: + load-mode none, cache 5600
C() { MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=4800 tools/run.sh "$1" speed || echo "$1 FAILED"; }
C c06-a
MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=4800 MX_LOAD_MODE=none tools/run.sh m07-cache-lmnone speed || echo "m07 FAILED"
C c06-b
MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=5600 tools/run.sh m08-cache5600 speed || echo "m08 FAILED"
C c06-c
