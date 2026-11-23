# llama-bench: decode vs number of RAM-resident MoE layers (slope = cost per RAM layer, intercept = all-GPU practical
# ceiling), and q8_0 vs f16 KV at 32k depth (same split, ub 1024 to shorten the depth prefill).
tools/lbench.sh lb01-ncmoe-sweep -p 0 -n 128 -r 3 -ctk q8_0 -ctv q8_0 -ncmoe 45,39,33,30,27,24 || echo "lb01 FAILED"
tools/lbench.sh lb02-kv-q8-depth32k -p 0 -n 64 -r 2 -d 32768 -ub 1024 -ncmoe 36 -ctk q8_0 -ctv q8_0 || echo "lb02 FAILED"
tools/lbench.sh lb03-kv-f16-depth32k -p 0 -n 64 -r 2 -d 32768 -ub 1024 -ncmoe 36 -ctk f16 -ctv f16 || echo "lb03 FAILED"
