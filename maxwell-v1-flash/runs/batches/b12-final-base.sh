# qualification of serve.sh's default (config 13) on the base file. NEEDLES 65000 lands at ~62k tokens (srvtest sizes ~5% under)
tools/run.sh f01-base speed || echo "f01 FAILED"
DEPTH=32000 NEEDLES=32000,65000,65000 tools/run.sh f02-base-deep deep || echo "f02 FAILED"
PP=8000,32000,65000 tools/run.sh f03-base-pp pp || echo "f03 FAILED"
MX_THINK=0 tools/run.sh f04-base-code code || echo "f04 FAILED"
