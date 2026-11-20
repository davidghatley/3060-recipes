"""Run llama.cpp's convert_hf_to_gguf.py under `python -I` (which drops the script dir from sys.path).
    <venv>/bin/python -I tools/convert.py [convert_hf_to_gguf args...]"""
import runpy, sys
LL = "/mnt/scratch/src/llama.cpp-flint"
sys.path[:0] = [LL, f"{LL}/gguf-py"]
sys.argv = [f"{LL}/convert_hf_to_gguf.py"] + sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
