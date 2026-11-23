# b03: the same 6 long answers without speculation (32k f16 control layout), to compare against b02's MTP n=2.
cd "$(dirname "$0")/../.."
date; tools/srv.sh b03-long-nospec QH_CTX=32768 QH_KV=f16 -- python3 -I tools/longans.py --label b03-nospec --max 10000
date
