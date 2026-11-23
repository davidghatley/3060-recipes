# control / candidate / control: ubatch, one more GPU layer, load mode, MoE cache
C() { MX_NCMOE=33 tools/run.sh "$1" speed || echo "$1 FAILED"; }
C m03-ctl-a
MX_NCMOE=33 MX_UBATCH=2048 tools/run.sh m03-ub2048 speed || echo "m03-ub2048 FAILED"
C m03-ctl-b
MX_NCMOE=32 tools/run.sh m04-ncmoe32 speed || echo "m04-ncmoe32 FAILED"
C m03-ctl-c
MX_NCMOE=33 MX_LOAD_MODE=none tools/run.sh m05-loadmode-none speed || echo "m05-loadmode-none FAILED"
C m03-ctl-d
MX_PLACEMENT=cpu MX_MOE_CACHE_MIB=4800 tools/run.sh m06-cpumoe-cache4800 speed || echo "m06-cpumoe-cache4800 FAILED"
C m03-ctl-e
