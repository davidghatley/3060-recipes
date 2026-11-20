"""Measure achievable VRAM bandwidth without nvcc: cudaMemcpy D2D and a cuBLAS SGEMV (read-bound matvec).

    ~/anime-pipeline/tools/gpu_run --need 3000 python3 -I tools/gpubw.py [cudart_dir]

GEMV y = A x with A = 1 GiB fp32 reads A once: bytes / time is the read bandwidth a decode matvec can reach.
D2D copy moves 2 x size (read + write). Best of 20 after 3 warm-ups, timed with CUDA events.
"""
import ctypes as C, sys

d = sys.argv[1] if len(sys.argv) > 1 else "/mnt/scratch/llama.cpp/b12242/cudart/cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64"
rt = C.CDLL(f"{d}/libcudart.so.12")
C.CDLL(f"{d}/libcublasLt.so.12", mode=C.RTLD_GLOBAL)
bl = C.CDLL(f"{d}/libcublas.so.12")


def ck(e, what):
    if e:
        raise SystemExit(f"{what} failed: {e}")


def malloc(n):
    p = C.c_void_p()
    ck(rt.cudaMalloc(C.byref(p), C.c_size_t(n)), "cudaMalloc")
    return p


ev0, ev1 = C.c_void_p(), C.c_void_p()
rt.cudaEventCreate(C.byref(ev0)); rt.cudaEventCreate(C.byref(ev1))


def timed(fn, reps=20, warm=3):
    for _ in range(warm):
        fn()
    best = 1e9
    for _ in range(reps):
        rt.cudaEventRecord(ev0, None); fn(); rt.cudaEventRecord(ev1, None); rt.cudaEventSynchronize(ev1)
        ms = C.c_float(); rt.cudaEventElapsedTime(C.byref(ms), ev0, ev1); best = min(best, ms.value)
    return best / 1e3


N = 1 << 30
a, b = malloc(N), malloc(N)
rt.cudaMemset(a, 1, C.c_size_t(N)); rt.cudaMemset(b, 0, C.c_size_t(N))
t = timed(lambda: ck(rt.cudaMemcpy(b, a, C.c_size_t(N), 3), "memcpy"))
print(f"D2D memcpy 1 GiB: {2 * N / t / 1e9:.1f} GB/s (read+write)")

h = C.c_void_p(); ck(bl.cublasCreate_v2(C.byref(h)), "cublasCreate")
rows = cols = 16384  # 1 GiB fp32
rt.cudaMemset(a, 0, C.c_size_t(N))
x, y = malloc(cols * 4), malloc(rows * 4)
rt.cudaMemset(x, 0, C.c_size_t(cols * 4))
one, zero = C.c_float(1.0), C.c_float(0.0)
for trans, label in ((0, "N"), (1, "T")):
    t = timed(lambda: ck(bl.cublasSgemv_v2(h, trans, rows, cols, C.byref(one), a, rows, x, 1, C.byref(zero), y, 1), "sgemv"))
    print(f"cuBLAS SGEMV-{label} 1 GiB matrix: {N / t / 1e9:.1f} GB/s (read)")
for mb in (8, 32, 128):  # per-layer-sized matvecs: launch + tail effects at decode sizes
    r_ = mb * (1 << 20) // 4 // 2560
    t = timed(lambda: ck(bl.cublasSgemv_v2(h, 1, 2560, r_, C.byref(one), a, 2560, x, 1, C.byref(zero), y, 1), "sgemv"), reps=200)
    print(f"cuBLAS SGEMV-T {mb} MiB (2560 x {r_}): {mb * (1 << 20) / t / 1e9:.1f} GB/s, {t * 1e6:.1f} us")
