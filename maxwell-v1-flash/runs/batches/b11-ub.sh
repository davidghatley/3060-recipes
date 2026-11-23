# ubatch / MoE cache frontier on 09 (f16 KV, load-mode none, every expert in RAM)
B="MX_PLACEMENT=cpu MX_LOAD_MODE=none MX_KV=f16"
C() { env $B MX_MOE_CACHE_MIB=2100 tools/run.sh "$1" speed || echo "$1 FAILED"; }
C c09-e
env $B MX_UBATCH=1024 MX_MOE_CACHE_MIB=1900 tools/run.sh m13-ub1024-c1900 speed || echo "m13 FAILED"
C c09-f
env $B MX_UBATCH=2048 MX_MOE_CACHE_MIB=1100 tools/run.sh m14-ub2048-c1100 speed || echo "m14 FAILED"
C c09-g
