# b07: full measurement set, uncensored variant (satellitedown abliterated -upstream- Q6_K; no MTP head).
cd "$(dirname "$0")/../.."
W=${WIN:-131072}
date; tools/srv.sh b07-unc VARIANT=uncensored -- bash -c "tools/measure.sh \$LABEL $W noeval"
date
