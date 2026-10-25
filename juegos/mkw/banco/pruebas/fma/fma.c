/* Prueba de concepto: FMA exacta y rápida en WebAssembly.
 *
 * Resumen: el procesador de la Wii (Broadway) tiene "multiplicar y sumar" fusionado (fmadd, ps_madd): a*c+b con UN
 * solo redondeo. WiiCompiled lo imita con std::fma, y la física del juego depende de que sea exacto (los ghosts
 * prueban que coincide bit a bit con la Wii). WebAssembly no tiene esa instrucción: std::fma cae en la versión de
 * software de musl, que es exacta pero lenta. Aquí se prueban dos versiones propias:
 *
 *  - fmaf_rapida (float, la de ps_madd): el producto de dos float cabe EXACTO en un double; se suma en double
 *    recuperando el error (TwoSum) y, si hubo error, se "redondea a impar" (se fuerza el último bit a 1 hacia el
 *    lado del error). Bajar ese double a float da el resultado correcto (53 bits ≥ 24 + 2: teorema de Boldo y
 *    Melquiond). Sin casos raros que evitar.
 *  - fma_rapida (double, la de fmadd): el producto se separa sin error en dos doubles (algoritmo de Dekker), se
 *    suman las tres piezas sin error (TwoSum) y se redondea una sola vez con el mismo truco del redondeo a impar.
 *    Para exponentes extremos (desborde, subnormales, infinitos, NaN, ceros) usa la de musl: son raros en un juego.
 *
 * Qué verifica: que las dos dan EXACTAMENTE los mismos bits que musl en millones de casos (al azar y empates
 * fabricados a propósito), y cuánto más rápidas son.
 */
#include <emscripten.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static inline uint64_t bits64(double x) { uint64_t u; memcpy(&u, &x, 8); return u; }
static inline double de64(uint64_t u) { double x; memcpy(&x, &u, 8); return x; }
static inline uint32_t bits32(float x) { uint32_t u; memcpy(&u, &x, 4); return u; }

/* ---------- float: ps_madd ---------- */
float fmaf_rapida(float a, float b, float c) {
    double p = (double)a * (double)b;        /* exacto: 24+24 = 48 bits ≤ 53 */
    double s = p + (double)c;                /* un redondeo (a double) */
    double bb = s - p;                       /* TwoSum: el error exacto de esa suma */
    double err = (p - (s - bb)) + ((double)c - bb);
    if (err != 0.0 && isfinite(s)) {         /* hubo error: redondear a impar (último bit en 1, hacia el error) */
        uint64_t u = bits64(s);
        if ((u & 1) == 0) u += ((err > 0) == (s > 0)) ? 1 : -1;
        s = de64(u);
    }
    return (float)s;                         /* el segundo redondeo, ahora sin doble redondeo */
}

/* ---------- double: fmadd ---------- */
static inline void dos_suma(double a, double b, double *s, double *e) {   /* s+e = a+b exacto (Knuth) */
    *s = a + b; double bb = *s - a; *e = (a - (*s - bb)) + (b - bb);
}
static inline void dos_producto(double a, double b, double *p, double *e) {   /* p+e = a*b exacto (Dekker) */
    const double K = 134217729.0;            /* 2^27 + 1: parte un double en dos mitades de 26 bits */
    double t = K * a, ah = t - (t - a), al = a - ah;
    t = K * b; double bh = t - (t - b), bl = b - bh;
    *p = a * b;
    *e = ((ah * bh - *p) + ah * bl + al * bh) + al * bl;
}
double fma_rapida(double a, double b, double c) {
    /* camino rápido solo con exponentes "tranquilos" (ni desborde, ni subnormales, ni 0/inf/NaN en a, b) */
    unsigned ea = (bits64(a) >> 52) & 0x7FF, eb = (bits64(b) >> 52) & 0x7FF, ec = (bits64(c) >> 52) & 0x7FF;
    int ep = (int)ea + (int)eb - 1023;       /* exponente del producto */
    if (ea - 1u >= 1990u || eb - 1u >= 1990u || ep < 200 || ep > 1990 || ec > 1990) return fma(a, b, c);
    double ph, pl, sh, sl, vh, vl;
    dos_producto(a, b, &ph, &pl);            /* a*b = ph + pl */
    dos_suma(ph, c, &sh, &sl);               /* ph + c = sh + sl */
    dos_suma(sl, pl, &vh, &vl);              /* lo que queda: sl + pl = vh + vl  → total = sh + vh + vl */
    if (vl != 0.0) {                         /* vh = redondeo a impar de vh+vl */
        uint64_t u = bits64(vh);
        if ((u & 1) == 0) u += ((vl > 0) == (vh > 0)) ? 1 : -1;
        vh = de64(u);
    }
    return sh + vh;                          /* un solo redondeo al más cercano */
}

/* ---------- generador pseudoaleatorio (xorshift, reproducible) ---------- */
static uint64_t gEstado = 0x9E3779B97F4A7C15ull;
static inline uint64_t azar(void) { gEstado ^= gEstado << 13; gEstado ^= gEstado >> 7; gEstado ^= gEstado << 17; return gEstado; }
static double double_azar(int emin, int emax) {   /* signo y mantisa al azar, exponente en [emin, emax] */
    uint64_t r = azar();
    uint64_t e = (uint64_t)(emin + (int)((r >> 52) % (uint64_t)(emax - emin + 1))) + 1023;
    return de64((azar() & 0x800FFFFFFFFFFFFFull) | (e << 52));
}
static float float_azar(int emin, int emax) {
    uint32_t r = (uint32_t)azar();
    uint32_t e = (uint32_t)(emin + (int)(r % (uint32_t)(emax - emin + 1))) + 127;
    uint32_t u = ((uint32_t)azar() & 0x807FFFFFu) | (e << 23);
    float f; memcpy(&f, &u, 4); return f;
}

/* ---------- resultados para la página ---------- */
static long gCasosD, gMalosD, gCasosF, gMalosF, gEmpatesD, gMalosEmpD;
static double gMsMuslD, gMsRapD, gMsMuslF, gMsRapF, gMsSueltaD;
static char gEjemplo[200] = "";
EMSCRIPTEN_KEEPALIVE double dato(int i) {
    double v[] = {gCasosD, gMalosD, gCasosF, gMalosF, gEmpatesD, gMalosEmpD, gMsMuslD, gMsRapD, gMsMuslF, gMsRapF, gMsSueltaD};
    return v[i];
}
EMSCRIPTEN_KEEPALIVE const char *ejemplo(void) { return gEjemplo; }

#define N 4000000
static double A[4096], B[4096], C[4096];
static float Af[4096], Bf[4096], Cf[4096];
static volatile double gSumidero;            /* para que el compilador no borre los cálculos de las mediciones */

EMSCRIPTEN_KEEPALIVE void corre(int millones) {
    long n = (long)millones * 1000000;
    /* 1. double al azar: exponentes variados (incluye cancelaciones: a*b ≈ -c) */
    for (long i = 0; i < n; i++) {
        double a = double_azar(-60, 60), b = double_azar(-60, 60), c;
        switch (azar() & 3) {
            case 0: c = double_azar(-60, 60); break;
            case 1: c = -(a * b) * (1 + (double)(int64_t)(azar() % 2001 - 1000) * 0x1p-52); break;   /* cancelación */
            case 2: c = double_azar(-170, 170); break;
            default: c = -(a * b); break;    /* cancelación casi total */
        }
        double r1 = fma(a, b, c), r2 = fma_rapida(a, b, c);
        gCasosD++;
        if (bits64(r1) != bits64(r2)) {
            if (!gMalosD) snprintf(gEjemplo, sizeof gEjemplo, "double: fma(%a,%a,%a) musl=%a rapida=%a", a, b, c, r1, r2);
            gMalosD++;
        }
    }
    /* 2. empates fabricados: a*b se elige con mitad exacta de ulp para que la suma caiga justo entre dos doubles */
    for (long i = 0; i < n / 4; i++) {
        double a = double_azar(-20, 20), b = (double)(int64_t)(azar() | 1) * 0x1p-63;   /* b impar: producto largo */
        double ph = a * b, pl = fma(a, b, -ph);
        double c = de64(bits64(ph) ^ 1) - ph;   /* c del tamaño de un ulp de ph: deja el resultado cerca de un empate */
        if (azar() & 1) c = -c;
        c += pl * (double)(int)(azar() % 3);    /* y mueve el error del producto adentro o afuera del empate */
        double r1 = fma(a, b, c), r2 = fma_rapida(a, b, c);
        gEmpatesD++;
        if (bits64(r1) != bits64(r2)) {
            if (!gMalosEmpD && !gMalosD) snprintf(gEjemplo, sizeof gEjemplo, "empate: fma(%a,%a,%a) musl=%a rapida=%a", a, b, c, r1, r2);
            gMalosEmpD++;
        }
    }
    /* 3. float al azar (ps_madd): exponentes del juego (-40..40) y cancelaciones */
    for (long i = 0; i < n; i++) {
        float a = float_azar(-40, 40), b = float_azar(-40, 40);
        float c = (azar() & 1) ? float_azar(-40, 40) : -(a * b) * (1 + (float)(int)(azar() % 201 - 100) * 0x1p-23f);
        float r1 = fmaf(a, b, c), r2 = fmaf_rapida(a, b, c);
        gCasosF++;
        if (bits32(r1) != bits32(r2)) {
            if (!gMalosF && !gMalosD) snprintf(gEjemplo, sizeof gEjemplo, "float: fmaf(%a,%a,%a) musl=%a rapida=%a", a, b, c, r1, r2);
            gMalosF++;
        }
    }
    /* 4. velocidad: 4096 tríos repetidos, N operaciones encadenadas de cada versión */
    for (int i = 0; i < 4096; i++) { A[i] = double_azar(-8, 8); B[i] = double_azar(-8, 8); C[i] = double_azar(-8, 8);
        Af[i] = float_azar(-8, 8); Bf[i] = float_azar(-8, 8); Cf[i] = float_azar(-8, 8); }
    double t, s;
    t = emscripten_get_now(); s = 0; for (int i = 0; i < N; i++) s += fma(A[i & 4095], B[i & 4095], C[i & 4095]); gSumidero = s; gMsMuslD = emscripten_get_now() - t;
    t = emscripten_get_now(); s = 0; for (int i = 0; i < N; i++) s += fma_rapida(A[i & 4095], B[i & 4095], C[i & 4095]); gSumidero = s; gMsRapD = emscripten_get_now() - t;
    t = emscripten_get_now(); s = 0; for (int i = 0; i < N; i++) s += A[i & 4095] * B[i & 4095] + C[i & 4095]; gSumidero = s; gMsSueltaD = emscripten_get_now() - t;
    float sf;
    t = emscripten_get_now(); sf = 0; for (int i = 0; i < N; i++) sf += fmaf(Af[i & 4095], Bf[i & 4095], Cf[i & 4095]); gSumidero = sf; gMsMuslF = emscripten_get_now() - t;
    t = emscripten_get_now(); sf = 0; for (int i = 0; i < N; i++) sf += fmaf_rapida(Af[i & 4095], Bf[i & 4095], Cf[i & 4095]); gSumidero = sf; gMsRapF = emscripten_get_now() - t;
}

int main(void) { return 0; }
