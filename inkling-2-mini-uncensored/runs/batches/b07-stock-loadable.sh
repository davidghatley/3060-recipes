# Stock master 225a5345b, AtomicChat AD-Q4_K, two placements that load (the card's own line OOMs, b06):
#  1. the card's line without -ngl 99, so llama.cpp's default --fit chooses
STOCK=atomicchat STOCK_FIT=1 SERVE=tools/stock.sh tools/run.sh u07-stock-ad-fit speed
#  2. the usual MoE offload line: every expert in RAM, op offload off (the base recipe's baseline shape), 64k
STOCK=atomicchat SERVE=tools/stock.sh tools/run.sh u07-stock-ad-expcpu speed -ot exps=CPU --no-op-offload -c 65536 -ctk q8_0 -ctv q8_0
