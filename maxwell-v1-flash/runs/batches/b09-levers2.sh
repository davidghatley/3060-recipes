# control 09 (every expert in RAM, MoE cache 2100, f16 KV, load-mode none); one change each
B="MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=2100 MX_LOAD_MODE=none MX_KV=f16"
C() { env $B tools/run.sh "$1" speed || echo "$1 FAILED"; }
C c09-a
env $B MX_MOE_CACHE_SHARE=0.90 tools/run.sh m10-share090 speed || echo "m10 FAILED"
C c09-b
env $B MX_PLACEMENT=ncmoe MX_NCMOE=42 MX_MOE_CACHE_MIB=850 tools/run.sh m11-hybrid42 speed || echo "m11 FAILED"
C c09-c
env $B MX_UBATCH=1024 MX_MOE_CACHE_MIB=1700 tools/run.sh m12-ub1024 speed || echo "m12 FAILED"
C c09-d
