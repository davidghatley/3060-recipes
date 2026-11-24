# empty-context cost of 09 (f16 KV, cache 2100) against control 07 (q8_0 KV, cache 4800); both load-mode none
C() { MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=4800 MX_LOAD_MODE=none tools/run.sh "$1" speed || echo "$1 FAILED"; }
C c07-a
MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=2100 MX_LOAD_MODE=none MX_KV=f16 tools/run.sh m09-f16kv speed || echo "m09 FAILED"
C c07-b
MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=2100 MX_LOAD_MODE=none MX_KV=f16 tools/run.sh m09-f16kv-r speed || echo "m09r FAILED"
C c07-c
