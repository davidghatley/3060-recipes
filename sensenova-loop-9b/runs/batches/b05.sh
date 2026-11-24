# b05: full measurement set, default variant (official Q5_K_M), shipped default profile (serve.sh defaults).
# pp 8k/32k/near, decode empty and near (x6), needles ~50% / ~95%; quality runs are in b06 (thinking-off server).
cd "$(dirname "$0")/../.."
W=${WIN:-131072}
date; tools/srv.sh b05-def -- bash -c "tools/measure.sh \$LABEL $W noeval"
date
