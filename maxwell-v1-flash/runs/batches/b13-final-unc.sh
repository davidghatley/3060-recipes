# the uncensored LoRA on serve.sh's default, between base controls; then its depth/needle gates
tools/run.sh u00-base-a speed || echo "u00a FAILED"
VARIANT=uncensored tools/run.sh u01-unc speed || echo "u01 FAILED"
tools/run.sh u00-base-b speed || echo "u00b FAILED"
VARIANT=uncensored DEPTH=32000 NEEDLES=32000,65000 tools/run.sh u02-unc-deep deep || echo "u02 FAILED"
# stock baseline again (the 07:00 run shared its hold with a noisy host: its control read 36.3 vs 39.6 later)
MX_PLACEMENT=fit MX_KV=f16 MX_UBATCH=512 MX_LOAD_MODE= tools/run.sh m01-stock-fit-r speed || echo "m01r FAILED"
MX_PLACEMENT=fit MX_KV=f16 MX_UBATCH=512 MX_LOAD_MODE= DEPTH=32000 NEEDLES=32000 tools/run.sh m01-stock-fit-deep deep || echo "m01d FAILED"
