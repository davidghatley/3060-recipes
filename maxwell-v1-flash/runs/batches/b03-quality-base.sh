# quality gates on the base file (thinking off on the server: the template reads enable_thinking), control split
MX_NCMOE=33 MX_THINK=0 tools/run.sh q01-base quality || echo "q01-base FAILED"
