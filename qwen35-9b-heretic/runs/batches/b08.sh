# b08: full measurement set on the stock command line (fit picks 4 slots x 69,376 unified K/V), the baseline.
cd "$(dirname "$0")/../.."
date; tools/srv.sh b08-stock QH_PROFILE=stock -- tools/measure.sh b08-stock 69376
date
