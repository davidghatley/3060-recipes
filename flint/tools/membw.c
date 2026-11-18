// Multi-threaded read bandwidth probe: sums a 2 GiB buffer with N threads, best of 5.
// Build: gcc -O3 -march=native -fopenmp membw.c -o membw   Run: ./membw [threads]
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <omp.h>
#include <immintrin.h>

int main(int argc, char **argv) {
    int nt = argc > 1 ? atoi(argv[1]) : omp_get_max_threads();
    size_t n = (2UL << 30) / sizeof(__m256i);
    __m256i *a = aligned_alloc(64, n * sizeof(__m256i));
    #pragma omp parallel for num_threads(nt)
    for (size_t i = 0; i < n; i++) a[i] = _mm256_set1_epi64x(i);
    double best = 0;
    for (int r = 0; r < 5; r++) {
        double t0 = omp_get_wtime();
        __m256i acc = _mm256_setzero_si256();
        #pragma omp parallel num_threads(nt)
        {
            __m256i s0 = _mm256_setzero_si256(), s1 = s0, s2 = s0, s3 = s0;
            #pragma omp for nowait
            for (size_t i = 0; i < n; i += 4) {
                s0 = _mm256_add_epi64(s0, _mm256_load_si256(a + i));
                s1 = _mm256_add_epi64(s1, _mm256_load_si256(a + i + 1));
                s2 = _mm256_add_epi64(s2, _mm256_load_si256(a + i + 2));
                s3 = _mm256_add_epi64(s3, _mm256_load_si256(a + i + 3));
            }
            __m256i s = _mm256_add_epi64(_mm256_add_epi64(s0, s1), _mm256_add_epi64(s2, s3));
            #pragma omp critical
            acc = _mm256_add_epi64(acc, s);
        }
        double dt = omp_get_wtime() - t0, gbs = n * sizeof(__m256i) / dt / 1e9;
        if (gbs > best) best = gbs;
        volatile int64_t sink = _mm256_extract_epi64(acc, 0); (void)sink;
    }
    printf("threads=%d read_GBps=%.1f\n", nt, best);
    return 0;
}
