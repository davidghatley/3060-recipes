# depth trade: control 07 (q8_0 KV, cache 4800, load-mode none) vs 09 (f16 KV, cache 2100). deep = 6 answers after 32k + needles
C() { MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=4800 MX_LOAD_MODE=none tools/run.sh "$1" deep || echo "$1 FAILED"; }
C d07-a
MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=2100 MX_LOAD_MODE=none MX_KV=f16 tools/run.sh d09-f16kv deep || echo "d09 FAILED"
NEEDLES=32000 C d07-b
