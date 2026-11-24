# baseline: the card's line (expected not to fit), stock --fit at 64k, first explicit split
MX_PLACEMENT=fit MX_KV=f16 MX_CONTEXT=32768 tools/run.sh m00-card-line load -ngl 99 || echo "m00 FAILED"
MX_PLACEMENT=fit MX_KV=f16 tools/run.sh m01-stock-fit speed || echo "m01 FAILED"
MX_PLACEMENT=ncmoe MX_NCMOE=33 MX_KV=q8_0 tools/run.sh m02-ncmoe33-q8 speed || echo "m02 FAILED"
